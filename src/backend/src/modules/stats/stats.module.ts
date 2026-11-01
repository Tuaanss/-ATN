import { Body, Controller, Get, Injectable, Module, Patch, Query } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { notFound } from '../../common/errors/app-exception';
import { AuthUser, CurrentUser, Roles } from '../../common/auth/auth.decorators';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { stripVietnamese } from '../../common/utils/files';
import { SIMILAR_THRESHOLD, similarity } from '../topics/similarity';
import { strs } from '../../common/utils/json';

const norm = (s: string) => stripVietnamese(s).toLowerCase().replace(/\s+/g, ' ').trim();
const deadline = (a: { allowLate: boolean; lateDueAt: Date | null; dueAt: Date }) => (a.allowLate && a.lateDueAt ? a.lateDueAt : a.dueAt);

@Injectable()
export class StatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ================================================================ UC10.3 / UC10.7 – thống kê lớp & đề tài

  async lecturer(lecturerId: string, sectionId?: string) {
    const sections = await this.prisma.courseSection.findMany({
      where: { lecturerId },
      include: { course: true, semester: true, _count: { select: { students: true } } },
      orderBy: [{ semester: { startDate: 'desc' } }, { code: 'asc' }],
    });
    if (!sections.length) return { sections: [], section: null };
    const s = sectionId ? sections.find((x) => x.id === sectionId) : (sections.find((x) => x.semester.isCurrent) ?? sections[0]);
    if (!s) throw notFound('Lớp học phần');

    const assignments = await this.prisma.assignment.findMany({
      where: { sectionId: s.id, deletedAt: null },
      include: {
        groups: { include: { topic: true, members: { select: { studentId: true } } } },
        topics: true,
        submissions: { select: { kind: true, groupId: true, studentId: true, isLate: true } },
        grades: { where: { score: { not: null } }, select: { score: true } },
      },
      orderBy: { openAt: 'asc' },
    });
    const now = new Date();
    let closedUnits = 0;
    let closedOnTime = 0;
    const perAssignment = assignments.map((a) => {
      const units = a.workMode === 'GROUP' ? a.groups.length : s._count.students;
      const subs = a.submissions.filter((x) => (a.workMode === 'GROUP' ? x.kind === 'GROUP_SHARED' : x.kind === 'PERSONAL'));
      const late = subs.filter((x) => x.isLate).length;
      const onTime = subs.length - late;
      const ended = deadline(a) < now || a.status === 'CLOSED';
      if (ended) {
        closedUnits += units;
        closedOnTime += onTime;
      }
      const scores = a.grades.map((g) => Number(g.score));
      return {
        id: a.id,
        title: a.title,
        workMode: a.workMode,
        status: a.status === 'DRAFT' ? 'DRAFT' : a.openAt > now ? 'NOT_OPEN' : ended ? 'ENDED' : 'OPEN',
        dueAt: a.dueAt,
        units,
        onTime,
        late,
        missing: Math.max(0, units - subs.length),
        avgScore: scores.length ? Math.round((scores.reduce((x, y) => x + y, 0) / scores.length) * 10) / 10 : null,
      };
    });
    const open = perAssignment.filter((x) => x.status === 'OPEN').sort((x, y) => new Date(x.dueAt).getTime() - new Date(y.dueAt).getTime())[0] ?? null;

    // đề tài: theo đơn vị làm bài (nhóm hoặc SV)
    const studentIds = assignments.flatMap((a) => a.topics.map((t) => t.studentId).filter((x): x is string => !!x));
    const names = new Map((await this.prisma.student.findMany({ where: { id: { in: studentIds } }, select: { id: true, fullName: true } })).map((x) => [x.id, x.fullName]));
    const topics = assignments.flatMap((a) =>
      a.workMode === 'GROUP'
        ? a.groups.filter((g) => g.topic).map((g) => ({ title: g.topic!.title, keywords: g.topic!.keywords, owner: `Nhóm ${g.code}`, assignment: a.title }))
        : a.topics.map((t) => ({ title: t.title, keywords: t.keywords, owner: names.get(t.studentId ?? '') ?? 'Sinh viên', assignment: a.title })),
    );
    const distinct = new Set(topics.map((t) => norm(t.title))).size;
    const pairs: { a: string; b: string; titleA: string; titleB: string; score: number }[] = [];
    for (let i = 0; i < topics.length; i++)
      for (let j = i + 1; j < topics.length; j++) {
        if (topics[i].assignment !== topics[j].assignment) continue;
        const sc = similarity(topics[i].title, topics[j].title);
        if (sc >= SIMILAR_THRESHOLD) pairs.push({ a: topics[i].owner, b: topics[j].owner, titleA: topics[i].title, titleB: topics[j].title, score: Math.round(sc * 100) / 100 });
      }
    const kw = new Map<string, { label: string; n: number }>();
    for (const t of topics)
      for (const k of strs(t.keywords)) {
        const key = norm(k);
        const c = kw.get(key) ?? { label: k, n: 0 };
        c.n++;
        kw.set(key, c);
      }

    return {
      sections: sections.map((x) => ({ id: x.id, code: x.code, course: x.course.name, semester: x.semester.code, isCurrent: x.semester.isCurrent })),
      section: { id: s.id, code: s.code, course: s.course.name, semester: { code: s.semester.code, term: s.semester.term, academicYear: s.semester.academicYear }, students: s._count.students },
      summary: {
        onTimeRate: closedUnits ? Math.round((closedOnTime / closedUnits) * 100) : null,
        closedAssignments: perAssignment.filter((x) => x.status === 'ENDED').length,
        open: open && { title: open.title, missing: open.missing, dueAt: open.dueAt },
        topics: topics.length,
        distinctTopics: distinct,
        similarPairs: pairs.length,
      },
      assignments: perAssignment,
      keywords: [...kw.values()].sort((x, y) => y.n - x.n).slice(0, 10).map((x) => ({ keyword: x.label, count: x.n })),
      pairs: pairs.sort((x, y) => y.score - x.score).slice(0, 10),
    };
  }

  // ================================================================ SV: doanh nghiệp & quyền riêng tư (UC03.4, UC09.11)

  async privacy(studentId: string) {
    const s = await this.prisma.student.findUniqueOrThrow({ where: { id: studentId }, select: { discoverable: true } });
    const now = new Date();
    const [views30, grants, log] = await Promise.all([
      this.prisma.enterpriseView.findMany({ where: { studentId, createdAt: { gt: new Date(now.getTime() - 30 * 86_400_000) } }, select: { enterpriseId: true } }),
      this.prisma.viewRequest.findMany({ where: { studentId, status: 'APPROVED', expiresAt: { gt: now } }, include: { enterprise: true }, orderBy: { expiresAt: 'asc' } }),
      this.prisma.enterpriseView.findMany({ where: { studentId }, include: { enterprise: true }, orderBy: { createdAt: 'desc' }, take: 30 }),
    ]);
    return {
      discoverable: s.discoverable,
      views30d: new Set(views30.map((v) => v.enterpriseId)).size,
      activeGrants: grants.map((g) => ({ enterprise: g.enterprise.name, grantedAt: g.approvedAt, expiresAt: g.expiresAt, daysLeft: Math.ceil((g.expiresAt!.getTime() - now.getTime()) / 86_400_000) })),
      accessLog: log.map((l) => ({ enterprise: l.enterprise.name, submission: l.kind === 'PROFILE' ? 'Hồ sơ năng lực' : (l.label ?? 'Bài nộp'), at: l.createdAt })),
    };
  }

  async setDiscoverable(studentId: string, userId: string, discoverable: boolean) {
    await this.prisma.student.update({ where: { id: studentId }, data: { discoverable } });
    await this.audit.log({ actorId: userId, action: 'DISCOVERABLE', entityType: 'student', entityId: studentId, summary: discoverable ? 'Bật cho doanh nghiệp tìm thấy' : 'Tắt cho doanh nghiệp tìm thấy' });
    return this.privacy(studentId);
  }
}

@Controller('lecturer')
@Roles('LECTURER')
export class LecturerStatsController {
  constructor(private readonly service: StatsService) {}

  @Get('stats')
  stats(@CurrentUser() u: AuthUser, @Query('section') section?: string) {
    return this.service.lecturer(u.lecturerId!, section || undefined);
  }
}

@Controller('student/privacy')
@Roles('STUDENT')
export class StudentPrivacyController {
  constructor(private readonly service: StatsService) {}

  @Get()
  get(@CurrentUser() u: AuthUser) {
    return this.service.privacy(u.studentId!);
  }

  @Patch()
  set(@CurrentUser() u: AuthUser, @Body(new ZodPipe(z.object({ discoverable: z.boolean() }))) dto: { discoverable: boolean }) {
    return this.service.setDiscoverable(u.studentId!, u.sub, dto.discoverable);
  }
}

@Module({ controllers: [LecturerStatsController, StudentPrivacyController], providers: [StatsService] })
export class StatsModule {}
