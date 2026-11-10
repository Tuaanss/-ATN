import { Body, Controller, Get, HttpStatus, Injectable, Module, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { vnDate } from '../../common/utils/date';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { AuthUser, CurrentUser, Roles } from '../../common/auth/auth.decorators';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { AppException, forbidden, notFound } from '../../common/errors/app-exception';
import { SystemConfigService } from '../../common/config/system-config.service';
import { strs } from '../../common/utils/json';
import { NotificationsService } from '../notifications/notifications.module';

const DAY = 86_400_000;
const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .trim();
const daysLeft = (d: Date) => Math.max(0, Math.ceil((d.getTime() - Date.now()) / DAY));
const TERM: Record<string, string> = { TERM_1: 'HK1', TERM_2: 'HK2', SUMMER: 'Hè' };
const semShort = (s: { term: string; academicYear: string }) => `${TERM[s.term]} ${s.academicYear.slice(2, 4)}–${s.academicYear.slice(7)}`;

export interface SearchCriteria {
  code?: string;
  q?: string;
  cohorts?: string[];
  major?: string;
  classId?: string;
  scoreMin?: number;
  scoreMax?: number;
  topics?: string[];
  skills?: string[];
  page?: number;
}

type Access = { state: 'NONE' } | { state: 'PENDING'; since: Date } | { state: 'ACTIVE'; daysLeft: number; expiresAt: Date } | { state: 'EXPIRED'; expiresAt: Date };

/**
 * Doanh nghiệp (UC09): tìm SV đã bật "cho doanh nghiệp tìm thấy", xem hồ sơ năng lực, gửi yêu cầu xem bài;
 * Admin duyệt → DN xem bài trong thời hạn (chỉ xem, mọi lượt xem được ghi lại và SV xem được).
 */
@Injectable()
export class EnterpriseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: SystemConfigService,
    private readonly notifications: NotificationsService,
  ) {}

  async me(userId: string) {
    const e = await this.prisma.enterprise.findUnique({ where: { userId } });
    if (!e) throw forbidden('Không phải tài khoản doanh nghiệp');
    return e;
  }

  // ---------------------------------------------------------------- dữ liệu dùng chung

  /** Điểm trung bình các bài tập đã công bố điểm (thang 10). */
  private async avgScoreOf(studentIds: string[]) {
    const rows = await this.prisma.assignmentGrade.groupBy({
      by: ['studentId'],
      where: { studentId: { in: studentIds }, score: { not: null }, assignment: { deletedAt: null, gradesPublishedAt: { not: null } } },
      _avg: { score: true },
    });
    const out = new Map<string, number | null>();
    for (const r of rows) out.set(r.studentId, r._avg.score == null ? null : Math.round(Number(r._avg.score) * 10) / 10);
    return out;
  }

  /** Đề tài đã nộp của từng SV (bài chung của nhóm có SV + bài cá nhân) – chỉ bài đã nộp. */
  private async worksOf(studentIds: string[]) {
    const [members, personal] = await Promise.all([
      this.prisma.groupMember.findMany({
        where: { studentId: { in: studentIds }, group: { submissions: { some: { kind: 'GROUP_SHARED' } } } },
        include: {
          group: {
            include: {
              topic: true,
              _count: { select: { members: true } },
              submissions: { where: { kind: 'GROUP_SHARED' }, include: { files: { where: { deletedAt: null }, select: { fileType: true } } } },
              assignment: { include: { section: { include: { course: true, semester: true } } } },
            },
          },
        },
      }),
      this.prisma.submission.findMany({
        where: { studentId: { in: studentIds }, kind: 'PERSONAL', groupId: null },
        include: { topic: true, files: { where: { deletedAt: null }, select: { fileType: true } }, assignment: { include: { section: { include: { course: true, semester: true } } } } },
      }),
    ]);
    const out = new Map<string, { submissionId: string; title: string; keywords: string[]; course: string; semester: string; group: string | null; groupSize: number | null; types: string[]; submittedAt: Date }[]>();
    const types = (files: { fileType: string }[], s: { figmaUrl: string | null; gitUrl: string | null }) => {
      const t = new Set<string>();
      for (const f of files) t.add(f.fileType);
      if (s.figmaUrl) t.add('FIGMA');
      if (s.gitUrl) t.add('GIT');
      return [...t];
    };
    for (const m of members) {
      const s = m.group.submissions[0];
      const a = m.group.assignment;
      const list = out.get(m.studentId) ?? [];
      list.push({ submissionId: s.id, title: m.group.topic?.title ?? a.title, keywords: strs(m.group.topic?.keywords), course: a.section.course.name, semester: semShort(a.section.semester), group: m.group.name && m.group.name !== m.group.code ? `${m.group.code} · ${m.group.name}` : `Nhóm ${m.group.code}`, groupSize: m.group._count.members, types: types(s.files, s), submittedAt: s.submittedAt });
      out.set(m.studentId, list);
    }
    // phần cá nhân trong bài nhóm: ghi rõ thuộc nhóm nào
    const partOf = new Map((await this.prisma.groupMember.findMany({ where: { studentId: { in: studentIds }, assignmentId: { in: personal.map((p) => p.assignmentId) } }, include: { group: true } })).map((m) => [`${m.studentId}:${m.assignmentId}`, m.group]));
    for (const s of personal) {
      const list = out.get(s.studentId!) ?? [];
      const g = partOf.get(`${s.studentId}:${s.assignmentId}`);
      list.push({ submissionId: s.id, title: s.topic?.title ?? s.assignment.title, keywords: strs(s.topic?.keywords), course: s.assignment.section.course.name, semester: semShort(s.assignment.section.semester), group: g ? `Phần cá nhân · Nhóm ${g.code}` : null, groupSize: null, types: types(s.files, s), submittedAt: s.submittedAt });
      out.set(s.studentId!, list);
    }
    for (const l of out.values()) l.sort((x, y) => y.submittedAt.getTime() - x.submittedAt.getTime());
    return out;
  }

  private async accessOf(enterpriseId: string, studentIds: string[]) {
    const reqs = await this.prisma.viewRequest.findMany({ where: { enterpriseId, studentId: { in: studentIds }, status: { in: ['PENDING', 'APPROVED'] } }, orderBy: { createdAt: 'desc' } });
    const out = new Map<string, Access>();
    for (const id of studentIds) {
      const mine = reqs.filter((r) => r.studentId === id);
      const active = mine.find((r) => r.status === 'APPROVED' && r.expiresAt && r.expiresAt > new Date());
      const pending = mine.find((r) => r.status === 'PENDING');
      const expired = mine.find((r) => r.status === 'APPROVED' && r.expiresAt && r.expiresAt <= new Date());
      out.set(id, active ? { state: 'ACTIVE', daysLeft: daysLeft(active.expiresAt!), expiresAt: active.expiresAt! } : pending ? { state: 'PENDING', since: pending.createdAt } : expired ? { state: 'EXPIRED', expiresAt: expired.expiresAt! } : { state: 'NONE' });
    }
    return out;
  }

  /** Quyền xem đang còn hạn của DN với SV (dùng cho trình xem bài). */
  async activeGrant(enterpriseId: string, studentIds: string[]) {
    return this.prisma.viewRequest.findFirst({ where: { enterpriseId, studentId: { in: studentIds }, status: 'APPROVED', expiresAt: { gt: new Date() } } });
  }

  async logView(enterpriseId: string, studentId: string, kind: 'PROFILE' | 'SUBMISSION', label: string, submissionId?: string) {
    // hồ sơ: ghi tối đa 1 lượt / giờ để nhật ký không bị lặp khi tải lại trang
    if (kind === 'PROFILE' && (await this.prisma.enterpriseView.findFirst({ where: { enterpriseId, studentId, kind, createdAt: { gt: new Date(Date.now() - 3600_000) } } }))) return;
    if (kind === 'SUBMISSION' && (await this.prisma.enterpriseView.findFirst({ where: { enterpriseId, submissionId, createdAt: { gt: new Date(Date.now() - 600_000) } } }))) return;
    await this.prisma.enterpriseView.create({ data: { enterpriseId, studentId, kind, label: label.slice(0, 300), submissionId } });
  }

  // ---------------------------------------------------------------- tìm kiếm (DN_Search)

  async filters() {
    const [cohorts, majors, classes, topics, students] = await Promise.all([
      this.prisma.cohort.findMany({ orderBy: { startYear: 'desc' } }),
      this.prisma.major.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.adminClass.findMany({ orderBy: { code: 'asc' } }),
      this.prisma.topic.findMany({ select: { keywords: true } }),
      this.prisma.student.findMany({ where: { discoverable: true }, select: { skills: true } }),
    ]);
    const count = (lists: string[][]) => {
      const m = new Map<string, { label: string; n: number }>();
      for (const l of lists)
        for (const k of l) {
          const key = norm(k);
          if (!key) continue;
          const e = m.get(key) ?? { label: k.trim(), n: 0 };
          e.n++;
          m.set(key, e);
        }
      return [...m.values()].sort((a, b) => b.n - a.n).map((x) => x.label);
    };
    const cfg = (await this.config.get()).enterprise;
    return {
      viewDays: { min: cfg.viewDaysMin, max: cfg.viewDaysMax },
      cohorts: cohorts.map((c) => c.name),
      majors: majors.map((m) => m.name),
      classes: classes.map((c) => ({ id: c.id, code: c.code })),
      topics: count(topics.map((t) => strs(t.keywords))).slice(0, 30),
      skills: count(students.map((s) => strs(s.skills))).slice(0, 30),
    };
  }

  async search(userId: string, c: SearchCriteria, log: boolean) {
    const e = await this.me(userId);
    const where: Prisma.StudentWhereInput = { discoverable: true, user: { status: 'ACTIVE' } };
    if (c.code) where.studentCode = c.code.trim().toUpperCase();
    if (c.cohorts?.length) where.cohort = { in: c.cohorts };
    if (c.major) where.major = c.major;
    if (c.classId) where.adminClassId = c.classId;
    const students = await this.prisma.student.findMany({ where, include: { adminClass: true } });
    const ids = students.map((s) => s.id);
    const [avg, works, access, interests] = await Promise.all([this.avgScoreOf(ids), this.worksOf(ids), this.accessOf(e.id, ids), this.prisma.enterpriseInterest.findMany({ where: { enterpriseId: e.id, studentId: { in: ids } } })]);
    const q = c.q ? norm(c.q) : '';
    const topics = (c.topics ?? []).map(norm);
    const skills = (c.skills ?? []).map(norm);
    let rows = students
      .map((s) => {
        const w = works.get(s.id) ?? [];
        return {
          id: s.id,
          studentCode: s.studentCode,
          fullName: s.fullName,
          cohort: s.cohort,
          major: s.major,
          adminClass: s.adminClass?.code ?? null,
          avgScore: avg.get(s.id) ?? null,
          skills: strs(s.skills),
          works: w.map((x) => ({ title: x.title, keywords: x.keywords })),
          access: access.get(s.id)!,
          interested: interests.some((i) => i.studentId === s.id),
        };
      })
      .filter((r) => (c.scoreMin == null || (r.avgScore != null && r.avgScore >= c.scoreMin)) && (c.scoreMax == null || (r.avgScore != null && r.avgScore <= c.scoreMax)))
      .filter((r) => !topics.length || r.works.some((w) => w.keywords.some((k) => topics.includes(norm(k)))))
      .filter((r) => !skills.length || skills.every((sk) => r.skills.some((x) => norm(x) === sk)))
      .filter((r) => !q || norm(`${r.fullName} ${r.studentCode} ${r.works.map((w) => `${w.title} ${w.keywords.join(' ')}`).join(' ')} ${r.skills.join(' ')}`).includes(q));
    rows = rows.sort((a, b) => (b.avgScore ?? -1) - (a.avgScore ?? -1) || a.studentCode.localeCompare(b.studentCode));
    if (log) {
      const parts = [c.code && `MSV ${c.code}`, c.q && `“${c.q}”`, c.cohorts?.length && `Khóa ${c.cohorts.join(', ')}`, c.major, c.scoreMin != null && `Điểm TB ≥ ${c.scoreMin}`, ...(c.topics ?? []), ...(c.skills ?? [])].filter(Boolean);
      await this.prisma.enterpriseSearch.create({ data: { enterpriseId: e.id, criteria: c as unknown as Prisma.InputJsonValue, summary: (parts.join(' · ') || 'Tất cả sinh viên').slice(0, 300), results: rows.length } });
    }
    const page = Math.max(1, c.page ?? 1);
    const size = 20;
    return { total: rows.length, page, pages: Math.max(1, Math.ceil(rows.length / size)), rows: rows.slice((page - 1) * size, page * size) };
  }

  // ---------------------------------------------------------------- hồ sơ năng lực (DN_Profile)

  async profile(userId: string, studentId: string) {
    const e = await this.me(userId);
    const s = await this.prisma.student.findUnique({ where: { id: studentId }, include: { adminClass: { include: { major: { include: { faculty: true } } } }, user: { select: { status: true } } } });
    if (!s) throw notFound('Sinh viên');
    const access = (await this.accessOf(e.id, [s.id])).get(s.id)!;
    if (!s.discoverable && access.state !== 'ACTIVE') throw forbidden('Sinh viên đã tắt chế độ cho doanh nghiệp tìm thấy');
    const [avg, works, interest, pending] = await Promise.all([
      this.avgScoreOf([s.id]),
      this.worksOf([s.id]),
      this.prisma.enterpriseInterest.findUnique({ where: { enterpriseId_studentId: { enterpriseId: e.id, studentId: s.id } } }),
      this.prisma.viewRequest.findFirst({ where: { enterpriseId: e.id, studentId: s.id, status: 'PENDING' } }),
    ]);
    await this.logView(e.id, s.id, 'PROFILE', 'Hồ sơ năng lực');
    const granted = access.state === 'ACTIVE';
    const cfg = await this.config.get();
    return {
      id: s.id,
      studentCode: s.studentCode,
      fullName: s.fullName,
      cohort: s.cohort,
      major: s.major,
      faculty: s.adminClass?.major.faculty.name ?? null,
      hasAvatar: !!s.avatarPath,
      bio: s.bio,
      skills: strs(s.skills),
      links: { github: s.githubUrl, behance: s.behanceUrl, linkedin: s.linkedinUrl },
      avgScore: avg.get(s.id) ?? null,
      works: (works.get(s.id) ?? []).map((w) => ({ ...w, submissionId: granted ? w.submissionId : null })),
      access,
      pending: pending && { createdAt: pending.createdAt, purpose: pending.purpose, requestedDays: pending.requestedDays },
      interested: !!interest,
      viewDays: { min: cfg.enterprise.viewDaysMin, max: cfg.enterprise.viewDaysMax },
    };
  }

  async toggleInterest(userId: string, studentId: string) {
    const e = await this.me(userId);
    const key = { enterpriseId_studentId: { enterpriseId: e.id, studentId } };
    if (await this.prisma.enterpriseInterest.findUnique({ where: key })) {
      await this.prisma.enterpriseInterest.delete({ where: key });
      return { interested: false };
    }
    if (!(await this.prisma.student.findUnique({ where: { id: studentId } }))) throw notFound('Sinh viên');
    await this.prisma.enterpriseInterest.create({ data: { enterpriseId: e.id, studentId } });
    return { interested: true };
  }

  /** Mời phỏng vấn: gửi thông báo + email cho SV kèm thông tin liên hệ của DN (SV tự quyết định liên hệ lại). */
  async invite(userId: string, studentId: string, message: string) {
    const e = await this.me(userId);
    const s = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!s || !s.discoverable) throw notFound('Sinh viên');
    const sent = await this.notifications.notify([s.userId], {
      type: 'ENTERPRISE_INVITE',
      title: `${e.name} mời bạn phỏng vấn`,
      body: `${message}\nLiên hệ: ${e.contactName} · ${e.email} · ${e.phone}`,
      link: '/student/privacy',
      dedupeKey: `invite:${e.id}:${s.id}:${new Date().toISOString().slice(0, 10)}`,
    });
    if (!sent) throw new AppException('CONFLICT', 'Hôm nay bạn đã gửi lời mời cho sinh viên này', HttpStatus.CONFLICT);
    await this.audit.log({ actorId: userId, action: 'ENTERPRISE_INVITE', entityType: 'student', entityId: s.id, summary: `${e.name} mời ${s.studentCode} phỏng vấn` });
    return { ok: true };
  }

  // ---------------------------------------------------------------- yêu cầu xem bài

  async request(userId: string, studentIds: string[], purpose: string, days: number) {
    const e = await this.me(userId);
    const access = await this.accessOf(e.id, studentIds);
    const students = await this.prisma.student.findMany({ where: { id: { in: studentIds } } });
    const created: string[] = [];
    const skipped: { studentCode: string; reason: string }[] = [];
    for (const s of students) {
      const a = access.get(s.id)!;
      if (!s.discoverable) skipped.push({ studentCode: s.studentCode, reason: 'Sinh viên không cho doanh nghiệp tìm thấy' });
      else if (a.state === 'PENDING') skipped.push({ studentCode: s.studentCode, reason: `Đã có yêu cầu đang chờ duyệt từ ${vnDate(a.since)}` });
      else if (a.state === 'ACTIVE') skipped.push({ studentCode: s.studentCode, reason: `Đang có quyền xem, còn ${a.daysLeft} ngày` });
      else {
        await this.prisma.viewRequest.create({ data: { enterpriseId: e.id, studentId: s.id, purpose, requestedDays: days } });
        created.push(s.studentCode);
      }
    }
    if (created.length) {
      await this.audit.log({ actorId: userId, action: 'VIEW_REQUEST', entityType: 'enterprise', entityId: e.id, summary: `${e.name} gửi yêu cầu xem bài ${created.join(', ')}` });
      const admins = await this.prisma.user.findMany({ where: { role: 'ADMIN', status: 'ACTIVE' }, select: { id: true } });
      await this.notifications.notify(
        admins.map((a) => a.id),
        { type: 'VIEW_REQUEST', title: `${e.name} gửi ${created.length} yêu cầu xem bài`, body: purpose.slice(0, 200), link: '/admin/view-requests' },
      );
    }
    return { created, skipped };
  }

  // ---------------------------------------------------------------- bài được cấp quyền (DN_ViewSubmissions)

  async grants(userId: string) {
    const e = await this.me(userId);
    const reqs = await this.prisma.viewRequest.findMany({ where: { enterpriseId: e.id, status: { in: ['APPROVED', 'REVOKED'] }, approvedAt: { not: null } }, include: { student: true }, orderBy: { approvedAt: 'desc' } });
    const latest = new Map<string, (typeof reqs)[number]>();
    for (const r of reqs) if (!latest.has(r.studentId)) latest.set(r.studentId, r);
    const ids = [...latest.keys()];
    const [avg, works] = await Promise.all([this.avgScoreOf(ids), this.worksOf(ids)]);
    return [...latest.values()]
      .map((r) => {
        const active = r.status === 'APPROVED' && !!r.expiresAt && r.expiresAt > new Date();
        return {
          studentId: r.studentId,
          studentCode: r.student.studentCode,
          fullName: r.student.fullName,
          avgScore: avg.get(r.studentId) ?? null,
          works: (works.get(r.studentId) ?? []).length,
          active,
          revoked: r.status === 'REVOKED',
          approvedAt: r.approvedAt,
          expiresAt: r.expiresAt,
          daysLeft: active ? daysLeft(r.expiresAt!) : 0,
        };
      })
      .sort((a, b) => Number(b.active) - Number(a.active) || b.daysLeft - a.daysLeft);
  }

  async grantWorks(userId: string, studentId: string) {
    const e = await this.me(userId);
    const g = await this.activeGrant(e.id, [studentId]);
    if (!g) throw forbidden('Quyền xem bài của sinh viên này đã hết hạn hoặc chưa được duyệt');
    const works = (await this.worksOf([studentId])).get(studentId) ?? [];
    const views = await this.prisma.enterpriseView.findMany({ where: { enterpriseId: e.id, studentId, kind: 'SUBMISSION' }, orderBy: { createdAt: 'desc' }, take: 20 });
    return { expiresAt: g.expiresAt, daysLeft: daysLeft(g.expiresAt!), works, views: views.map((v) => ({ label: v.label, at: v.createdAt })) };
  }

  // ---------------------------------------------------------------- yêu cầu & thống kê (DN_Dashboard)

  async dashboard(userId: string) {
    const e = await this.me(userId);
    const now = new Date();
    const [reqs, views, searches, interests] = await Promise.all([
      this.prisma.viewRequest.findMany({ where: { enterpriseId: e.id }, include: { student: true }, orderBy: { createdAt: 'desc' } }),
      this.prisma.enterpriseView.findMany({ where: { enterpriseId: e.id, kind: 'SUBMISSION' }, select: { studentId: true } }),
      this.prisma.enterpriseSearch.findMany({ where: { enterpriseId: e.id }, orderBy: { createdAt: 'desc' }, take: 5 }),
      this.prisma.enterpriseInterest.findMany({ where: { enterpriseId: e.id }, include: { student: true }, orderBy: { createdAt: 'desc' } }),
    ]);
    const seen = await this.prisma.enterpriseView.findMany({ where: { enterpriseId: e.id, kind: 'PROFILE' }, include: { student: true }, orderBy: { createdAt: 'desc' }, take: 50 });
    const recent = [...new Map(seen.map((v) => [v.studentId, v])).values()].slice(0, 12);
    const isActive = (r: (typeof reqs)[number]) => r.status === 'APPROVED' && !!r.expiresAt && r.expiresAt > now;
    const state = (r: (typeof reqs)[number]) => (r.status === 'APPROVED' ? (isActive(r) ? 'ACTIVE' : 'EXPIRED') : r.status);
    const avg = await this.avgScoreOf([...new Set([...interests.map((i) => i.studentId), ...recent.map((v) => v.studentId)])]);
    return {
      enterprise: { name: e.name, field: e.field },
      counts: {
        pending: reqs.filter((r) => r.status === 'PENDING').length,
        approved: reqs.filter((r) => r.status === 'APPROVED').length,
        active: reqs.filter(isActive).length,
        rejected: reqs.filter((r) => r.status === 'REJECTED').length,
        expired: reqs.filter((r) => state(r) === 'EXPIRED' || r.status === 'REVOKED').length,
        studentsViewed: new Set(views.map((v) => v.studentId)).size,
        views: views.length,
      },
      active: reqs.filter(isActive).map((r) => ({ studentId: r.studentId, studentCode: r.student.studentCode, fullName: r.student.fullName, approvedAt: r.approvedAt, daysLeft: daysLeft(r.expiresAt!) })),
      history: reqs.slice(0, 12).map((r) => ({ id: r.id, studentId: r.studentId, studentCode: r.student.studentCode, fullName: r.student.fullName, state: state(r), adminNote: r.adminNote, createdAt: r.createdAt, purpose: r.purpose })),
      searches: searches.map((s) => ({ id: String(s.id), summary: s.summary, results: s.results, at: s.createdAt, criteria: s.criteria })),
      recent: recent.map((v) => ({ studentId: v.studentId, studentCode: v.student.studentCode, fullName: v.student.fullName, cohort: v.student.cohort, major: v.student.major, avgScore: avg.get(v.studentId) ?? null, at: v.createdAt })),
      interests: interests.map((i) => ({ studentId: i.studentId, studentCode: i.student.studentCode, fullName: i.student.fullName, cohort: i.student.cohort, major: i.student.major, avgScore: avg.get(i.studentId) ?? null })),
    };
  }

  // ---------------------------------------------------------------- bản đồ năng lực (DN_TalentMap) – số liệu tổng hợp, ẩn danh

  async talentMap(cohort?: string) {
    const students = await this.prisma.student.findMany({ where: cohort ? { cohort } : {}, select: { id: true, major: true, skills: true } });
    const ids = students.map((s) => s.id);
    const works = await this.worksOf(ids);
    const majorOf = new Map(students.map((s) => [s.id, s.major ?? 'Khác']));
    const withWork = ids.filter((id) => (works.get(id) ?? []).length);
    // chủ đề (từ khóa) × ngành: số SV khác nhau
    const matrix = new Map<string, { label: string; byMajor: Map<string, Set<string>>; all: Set<string> }>();
    for (const id of withWork)
      for (const w of works.get(id)!)
        for (const k of w.keywords) {
          const key = norm(k);
          if (!key) continue;
          const e = matrix.get(key) ?? { label: k.trim(), byMajor: new Map(), all: new Set() };
          const m = majorOf.get(id)!;
          e.byMajor.set(m, (e.byMajor.get(m) ?? new Set()).add(id));
          e.all.add(id);
          matrix.set(key, e);
        }
    const majors = [...new Set(withWork.map((id) => majorOf.get(id)!))].sort();
    const mask = (n: number) => (n > 0 && n < 5 ? '< 5' : n);
    const top = [...matrix.values()].sort((a, b) => b.all.size - a.all.size).slice(0, 8);
    // chủ đề mới nổi: so số bài theo học kỳ hiện tại với học kỳ trước
    const sems = await this.prisma.semester.findMany({ orderBy: { startDate: 'desc' }, take: 2 });
    const bySem = (code: string | undefined) => {
      const m = new Map<string, number>();
      if (!code) return m;
      const label = sems.find((s) => s.code === code);
      const short = label ? semShort(label) : '';
      for (const id of withWork) for (const w of works.get(id)!) if (w.semester === short) for (const k of w.keywords) m.set(norm(k), (m.get(norm(k)) ?? 0) + 1);
      return m;
    };
    const cur = bySem(sems[0]?.code);
    const prev = bySem(sems[1]?.code);
    const trending = [...cur.entries()]
      .map(([k, n]) => ({ label: matrix.get(k)?.label ?? k, n, before: prev.get(k) ?? 0 }))
      .filter((x) => x.before > 0 && x.n > x.before)
      .map((x) => ({ label: x.label, growth: Math.round(((x.n - x.before) / x.before) * 100) }))
      .sort((a, b) => b.growth - a.growth)
      .slice(0, 5);
    const fresh = sems[1] ? [] : [...cur.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, n]) => ({ label: matrix.get(k)?.label ?? k, count: n }));
    const tools = new Map<string, { label: string; n: number }>();
    for (const s of students)
      for (const k of strs(s.skills)) {
        const e = tools.get(norm(k)) ?? { label: k.trim(), n: 0 };
        e.n++;
        tools.set(norm(k), e);
      }
    return {
      semester: sems[0] ? semShort(sems[0]) : null,
      studentsWithWork: withWork.length,
      distinctTopics: matrix.size,
      majors,
      rows: top.map((t) => ({ label: t.label, cells: majors.map((m) => mask(t.byMajor.get(m)?.size ?? 0)), total: mask(t.all.size) })),
      trending,
      fresh,
      tools: [...tools.values()].sort((a, b) => b.n - a.n).slice(0, 10).map((t) => ({ label: t.label, count: mask(t.n) })),
    };
  }
}

/** Admin duyệt yêu cầu xem bài (Admin_AccessRequests). */
@Injectable()
export class ViewRequestAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: SystemConfigService,
    private readonly notifications: NotificationsService,
  ) {}

  async list() {
    const list = await this.prisma.viewRequest.findMany({ include: { enterprise: { include: { user: { select: { status: true } } } }, student: true }, orderBy: { createdAt: 'desc' }, take: 300 });
    const now = new Date();
    const cfg = await this.config.get();
    return {
      viewDays: { min: cfg.enterprise.viewDaysMin, max: cfg.enterprise.viewDaysMax },
      items: list.map((r) => ({
        id: r.id,
        enterprise: { id: r.enterpriseId, name: r.enterprise.name, field: r.enterprise.field, status: r.enterprise.user.status },
        student: { id: r.studentId, studentCode: r.student.studentCode, fullName: r.student.fullName, discoverable: r.student.discoverable },
        purpose: r.purpose,
        requestedDays: r.requestedDays,
        grantedDays: r.grantedDays,
        state: r.status === 'APPROVED' ? (r.expiresAt && r.expiresAt > now ? 'ACTIVE' : 'EXPIRED') : r.status,
        adminNote: r.adminNote,
        createdAt: r.createdAt,
        approvedAt: r.approvedAt,
        expiresAt: r.expiresAt,
      })),
    };
  }

  async decide(adminId: string, id: string, action: 'approve' | 'reject' | 'revoke', days?: number, note?: string) {
    const r = await this.prisma.viewRequest.findUnique({ where: { id }, include: { enterprise: true, student: true } });
    if (!r) throw notFound('Yêu cầu');
    const cfg = (await this.config.get()).enterprise;
    if ((action === 'approve' || action === 'reject') && r.status !== 'PENDING') throw new AppException('CONFLICT', 'Yêu cầu đã được xử lý', HttpStatus.CONFLICT);
    if (action === 'revoke' && !(r.status === 'APPROVED' && r.expiresAt && r.expiresAt > new Date())) throw new AppException('CONFLICT', 'Chỉ thu hồi được quyền đang còn hạn', HttpStatus.CONFLICT);
    if (action !== 'approve' && !note?.trim()) throw new AppException('VALIDATION_ERROR', 'Nhập lý do');
    let data: Prisma.ViewRequestUpdateInput;
    if (action === 'approve') {
      const d = days ?? r.requestedDays;
      if (d < cfg.viewDaysMin || d > cfg.viewDaysMax) throw new AppException('VALIDATION_ERROR', `Thời hạn ${cfg.viewDaysMin}–${cfg.viewDaysMax} ngày`);
      const now = new Date();
      data = { status: 'APPROVED', grantedDays: d, approvedAt: now, expiresAt: new Date(now.getTime() + d * DAY), adminNote: note?.trim() || null, decidedById: adminId };
    } else data = { status: action === 'reject' ? 'REJECTED' : 'REVOKED', adminNote: note!.trim(), decidedById: adminId, ...(action === 'revoke' ? { expiresAt: new Date() } : {}) };
    const u = await this.prisma.viewRequest.update({ where: { id }, data });
    const label = { approve: 'Duyệt', reject: 'Từ chối', revoke: 'Thu hồi' }[action];
    await this.audit.log({ actorId: adminId, action: `VIEW_REQUEST_${action.toUpperCase()}`, entityType: 'view_request', entityId: id, summary: `${label} yêu cầu xem bài của ${r.enterprise.name} với ${r.student.studentCode}${note ? ` – ${note}` : ''}` });
    const until = u.expiresAt ? vnDate(u.expiresAt) : undefined;
    await this.notifications.notify([r.enterprise.userId], {
      type: 'VIEW_REQUEST_RESULT',
      title: action === 'approve' ? `Được xem bài của ${r.student.fullName} đến ${until}` : action === 'reject' ? `Yêu cầu xem bài ${r.student.fullName} bị từ chối` : `Quyền xem bài ${r.student.fullName} đã bị thu hồi`,
      body: note ?? undefined,
      link: action === 'approve' ? '/enterprise/grants' : '/enterprise',
    });
    if (action === 'approve')
      await this.notifications.notify([r.student.userId], { type: 'ENTERPRISE_ACCESS', title: `${r.enterprise.name} được xem bài nộp của bạn đến ${until}`, body: `Mục đích: ${r.purpose}`, link: '/student/privacy' });
    return { ok: true };
  }
}

const searchSchema = z.object({
  code: z.string().trim().max(20).optional(),
  q: z.string().trim().max(100).optional(),
  cohorts: z.array(z.string().max(10)).max(10).optional(),
  major: z.string().max(200).optional(),
  classId: z.string().uuid().optional(),
  scoreMin: z.number().min(0).max(10).optional(),
  scoreMax: z.number().min(0).max(10).optional(),
  topics: z.array(z.string().max(50)).max(10).optional(),
  skills: z.array(z.string().max(40)).max(10).optional(),
  page: z.number().int().min(1).optional(),
  log: z.boolean().optional(),
});
const requestSchema = z.object({
  studentIds: z.array(z.string().uuid()).min(1, 'Chọn sinh viên').max(50),
  purpose: z.string().trim().min(10, 'Mục đích tối thiểu 10 ký tự').max(500),
  days: z.number().int().min(1).max(365),
});

@Controller('enterprise')
@Roles('ENTERPRISE')
export class EnterpriseController {
  constructor(private readonly svc: EnterpriseService) {}

  @Get('dashboard')
  dashboard(@CurrentUser() u: AuthUser) {
    return this.svc.dashboard(u.sub);
  }
  @Get('filters')
  filters() {
    return this.svc.filters();
  }
  @Post('search')
  search(@CurrentUser() u: AuthUser, @Body(new ZodPipe(searchSchema)) d: z.infer<typeof searchSchema>) {
    const { log, ...c } = d;
    return this.svc.search(u.sub, c, !!log);
  }
  @Get('students/:id')
  profile(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.profile(u.sub, id);
  }
  @Post('students/:id/interest')
  interest(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.toggleInterest(u.sub, id);
  }
  @Post('students/:id/invite')
  invite(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(z.object({ message: z.string().trim().min(10, 'Lời mời tối thiểu 10 ký tự').max(1000) }))) d: { message: string }) {
    return this.svc.invite(u.sub, id, d.message);
  }
  @Post('requests')
  request(@CurrentUser() u: AuthUser, @Body(new ZodPipe(requestSchema)) d: z.infer<typeof requestSchema>) {
    return this.svc.request(u.sub, d.studentIds, d.purpose, d.days);
  }
  @Get('grants')
  grants(@CurrentUser() u: AuthUser) {
    return this.svc.grants(u.sub);
  }
  @Get('grants/:studentId')
  grantWorks(@CurrentUser() u: AuthUser, @Param('studentId', ParseUUIDPipe) id: string) {
    return this.svc.grantWorks(u.sub, id);
  }
  @Get('talent-map')
  talentMap(@Query('cohort') cohort?: string) {
    return this.svc.talentMap(cohort || undefined);
  }
}

@Controller('admin/view-requests')
@Roles('ADMIN')
export class AdminViewRequestsController {
  constructor(private readonly svc: ViewRequestAdminService) {}

  @Get()
  list() {
    return this.svc.list();
  }
  @Post(':id/decide')
  decide(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(z.object({ action: z.enum(['approve', 'reject', 'revoke']), days: z.number().int().optional(), note: z.string().trim().max(500).optional() }))) d: { action: 'approve' | 'reject' | 'revoke'; days?: number; note?: string },
  ) {
    return this.svc.decide(u.sub, id, d.action, d.days, d.note);
  }
}

@Module({
  controllers: [EnterpriseController, AdminViewRequestsController],
  providers: [EnterpriseService, ViewRequestAdminService],
  exports: [EnterpriseService],
})
export class EnterpriseModule {}
