import { Controller, Get, Injectable, Module, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuthUser, CurrentUser, Roles } from '../../common/auth/auth.decorators';
import { forbidden, notFound } from '../../common/errors/app-exception';
import { SystemConfigService } from '../../common/config/system-config.service';
import { GradesModule } from '../grades/grades.module';
import { GradesService } from '../grades/grades.service';
import { SubmissionsModule } from '../submissions/submissions.module';
import { StudentWorkService } from '../submissions/student-work.service';
import { finalDeadline } from '../assignments/assignment-status';

const REL = { FATHER: 'Bố', MOTHER: 'Mẹ', GUARDIAN: 'Người giám hộ' } as const;
const num = (v: Prisma.Decimal | number | null | undefined) => (v == null ? null : Number(v));
const f1 = (v: number) => v.toFixed(1).replace('.', ',');
/** Khóa thông báo của phụ huynh theo từng con: ph:<studentId>:… */
const key = (studentId: string, k: string) => `ph:${studentId}:${k}`.slice(0, 150);

/**
 * Cổng phụ huynh (UC08): chỉ xem điểm, GPA/CPA, bài nộp và cảnh báo học tập của các con đã liên kết.
 * Một SĐT phụ huynh có thể liên kết với nhiều sinh viên.
 */
@Injectable()
export class ParentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly grades: GradesService,
    private readonly work: StudentWorkService,
    private readonly config: SystemConfigService,
  ) {}

  private async links(userId: string) {
    const p = await this.prisma.parent.findUnique({
      where: { userId },
      include: { students: { include: { student: { include: { adminClass: { include: { major: true, cohort: true } } } } }, orderBy: { createdAt: 'asc' } } },
    });
    if (!p) throw forbidden('Không phải tài khoản phụ huynh');
    return p;
  }

  /** Phụ huynh chỉ xem được con đã liên kết (BR-PH-04). */
  async assertChild(userId: string, studentId: string) {
    const p = await this.links(userId);
    const l = p.students.find((x) => x.studentId === studentId);
    if (!l) throw forbidden('Sinh viên này không liên kết với tài khoản của bạn');
    return l;
  }

  // ---------------------------------------------------------------- danh sách con (chọn con)

  async children(userId: string) {
    const p = await this.links(userId);
    const out = [];
    for (const l of p.students) {
      await this.sync(userId, l.studentId);
      const [g, unread, warn] = await Promise.all([
        this.grades.myGrades(l.studentId),
        this.prisma.notification.count({ where: { userId, readAt: null, dedupeKey: { startsWith: key(l.studentId, '') } } }),
        this.prisma.notification.count({ where: { userId, readAt: null, type: 'PH_WARNING', dedupeKey: { startsWith: key(l.studentId, '') } } }),
      ]);
      const s = l.student;
      out.push({
        id: s.id,
        studentCode: s.studentCode,
        fullName: s.fullName,
        relation: l.relation,
        relationLabel: REL[l.relation],
        hasAvatar: !!s.avatarPath,
        adminClass: s.adminClass?.code ?? null,
        major: s.adminClass?.major.name ?? s.major,
        cohort: s.adminClass?.cohort.name ?? s.cohort,
        cpa: g.cpa,
        credits: g.credits,
        rank: g.rank,
        unread,
        warnings: warn,
      });
    }
    return { phone: p.phone, fullName: p.fullName, children: out };
  }

  // ---------------------------------------------------------------- kết quả học tập

  async results(userId: string, studentId: string) {
    await this.assertChild(userId, studentId);
    const g = await this.grades.myGrades(studentId);
    // các lớp đang học chưa công bố điểm tổng kết vẫn hiện trong học kỳ hiện tại
    const current = await this.prisma.sectionStudent.findMany({
      where: { studentId, section: { semester: { isCurrent: true } } },
      include: { section: { include: { course: true, semester: true } } },
    });
    const sem = current[0]?.section.semester;
    const terms = g.terms.map((t) => ({ ...t, inProgress: false }));
    if (sem) {
      let t = terms.find((x) => x.code === sem.code);
      if (!t) {
        t = { code: sem.code, academicYear: sem.academicYear, term: sem.term, gpa: null, credits: 0, courses: [], inProgress: true };
        terms.unshift(t);
      }
      t.inProgress = true;
      for (const e of current)
        if (!t.courses.some((c) => c.sectionId === e.sectionId))
          t.courses.push({
            sectionId: e.sectionId,
            sectionCode: e.section.code,
            course: { code: e.section.course.code, name: e.section.course.name, credits: e.section.course.credits },
            attendance: null,
            assignment: null,
            midterm: null,
            final: null,
            total: null,
            letter: null,
            gpa4: null,
          });
    }
    const cfg = await this.config.get();
    return { ...g, terms, threshold: cfg.warning.scoreThreshold, scale: cfg.grading.scale };
  }

  // ---------------------------------------------------------------- bài nộp (chỉ xem)

  async submissions(userId: string, studentId: string) {
    await this.assertChild(userId, studentId);
    const assignments = await this.prisma.assignment.findMany({
      where: { deletedAt: null, status: { not: 'DRAFT' }, openAt: { lte: new Date() }, section: { students: { some: { studentId } } } },
      include: { section: { include: { course: true, semester: true } } },
      orderBy: [{ dueAt: 'desc' }],
    });
    const ids = assignments.map((a) => a.id);
    const [statuses, members, personal, grades, topics] = await Promise.all([
      this.work.statusMany(studentId, assignments),
      this.prisma.groupMember.findMany({
        where: { studentId, assignmentId: { in: ids } },
        include: { group: { include: { topic: true, submissions: { where: { kind: 'GROUP_SHARED' }, include: { lastSubmittedBy: true, files: { where: { deletedAt: null }, select: { fileType: true } } } } } } },
      }),
      this.prisma.submission.findMany({ where: { studentId, kind: 'PERSONAL', assignmentId: { in: ids } }, include: { lastSubmittedBy: true, files: { where: { deletedAt: null }, select: { fileType: true } } } }),
      this.prisma.assignmentGrade.findMany({ where: { studentId, assignmentId: { in: ids } } }),
      this.prisma.topic.findMany({ where: { studentId, assignmentId: { in: ids } } }),
    ]);
    const fbs = await this.prisma.submissionFeedback.findMany({
      where: { submissionId: { in: [...members.flatMap((m) => m.group.submissions.map((x) => x.id)), ...personal.map((p) => p.id)] } },
      include: { lecturer: true },
      orderBy: { updatedAt: 'desc' },
    });
    return assignments.map((a) => {
      const st = statuses.get(a.id)!;
      const m = members.find((x) => x.assignmentId === a.id);
      const shared = m?.group.submissions[0] ?? null;
      const mine = personal.find((p) => p.assignmentId === a.id) ?? null;
      const main = shared ?? mine;
      const g = grades.find((x) => x.assignmentId === a.id);
      const topic = m ? m.group.topic : topics.find((t) => t.assignmentId === a.id);
      const files = main?.files ?? [];
      return {
        id: a.id,
        title: a.title,
        workMode: a.workMode,
        course: a.section.course.name,
        courseType: a.section.course.courseType,
        sectionCode: a.section.code,
        semester: { code: a.section.semester.code, academicYear: a.section.semester.academicYear, term: a.section.semester.term },
        dueAt: finalDeadline(a),
        status: st.status,
        score: st.score,
        lecturerNote: a.gradesPublishedAt ? (g?.note ?? null) : null,
        feedback: fbs.filter((f) => f.submissionId === (shared ?? mine)?.id || f.submissionId === mine?.id).map((f) => ({ id: f.id, lecturer: f.lecturer.fullName, content: f.content, updatedAt: f.updatedAt, personal: f.submissionId === mine?.id && !!shared })),
        group: m ? (m.group.name && m.group.name !== m.group.code ? `${m.group.code} · ${m.group.name}` : `Nhóm ${m.group.code}`) : null,
        topic: topic?.title ?? null,
        keywords: topic?.keywords ?? [],
        submissionId: main?.id ?? null,
        personalId: shared && mine ? mine.id : null,
        submittedBy: main?.lastSubmittedBy.fullName ?? null,
        submittedAt: main?.submittedAt ?? null,
        isLate: main?.isLate ?? false,
        images: files.filter((f) => f.fileType === 'IMAGE').length,
        videos: files.filter((f) => f.fileType === 'VIDEO').length,
        hasFigma: !!main?.figmaUrl,
        hasGit: !!main?.gitUrl,
      };
    });
  }

  // ---------------------------------------------------------------- thông báo & cảnh báo (FR-11.4)

  async notifications(userId: string, studentId: string) {
    await this.assertChild(userId, studentId);
    await this.sync(userId, studentId);
    const cfg = await this.config.get();
    const list = await this.prisma.notification.findMany({ where: { userId, dedupeKey: { startsWith: key(studentId, '') } }, orderBy: { createdAt: 'desc' }, take: 200 });
    return { threshold: cfg.warning.scoreThreshold, gpaDrop: cfg.warning.gpaDrop, items: list };
  }

  async readAll(userId: string, studentId: string) {
    await this.assertChild(userId, studentId);
    await this.prisma.notification.updateMany({ where: { userId, readAt: null, dedupeKey: { startsWith: key(studentId, '') } }, data: { readAt: new Date() } });
    return { ok: true };
  }

  /**
   * Sinh thông báo cho phụ huynh từ dữ liệu học tập của con (mỗi sự kiện một lần nhờ dedupe_key):
   * điểm mới công bố, điểm dưới ngưỡng, GPA giảm, bài nộp mới, sắp hết hạn, quá hạn chưa nộp.
   */
  async sync(userId: string, studentId: string) {
    const cfg = (await this.config.get()).warning;
    const s = await this.prisma.student.findUniqueOrThrow({ where: { id: studentId } });
    const name = s.fullName;
    const rows: Prisma.NotificationCreateManyInput[] = [];
    const add = (k: string, type: string, title: string, body: string, link: string, at?: Date | null) =>
      rows.push({ userId, dedupeKey: key(studentId, k), type, title: title.slice(0, 200), body: body.slice(0, 1000), link: `${link}?child=${studentId}`, createdAt: at ?? undefined });

    // điểm học phần
    const sg = await this.prisma.sectionGrade.findMany({ where: { studentId, status: 'PUBLISHED' }, include: { section: { include: { course: true, semester: true } } } });
    for (const g of sg) {
      const at = g.section.gradesPublishedAt ?? g.updatedAt;
      const total = num(g.total);
      add(`sg:${g.sectionId}`, 'PH_GRADE', `Điểm học phần ${g.section.course.name} đã công bố`, `${name} đạt ${total == null ? '—' : f1(total)}${g.letter ? ` (${g.letter})` : ''} · lớp ${g.section.code}.`, '/parent', at);
      const low = (
        [
          ['chuyên cần', num(g.attendance)],
          ['bài tập', num(g.assignment)],
          ['giữa kỳ', num(g.midterm)],
          ['cuối kỳ', num(g.final)],
          ['tổng kết', total],
        ] as [string, number | null][]
      ).filter(([, v]) => v != null && v < cfg.scoreThreshold);
      if (low.length)
        add(`sglow:${g.sectionId}`, 'PH_WARNING', `Điểm dưới ngưỡng · ${g.section.course.name}`, `${name} có điểm ${low.map(([k, v]) => `${k} ${f1(v!)}`).join(', ')} – thấp hơn ngưỡng ${f1(cfg.scoreThreshold)}.`, '/parent', at);
    }
    // GPA học kỳ giảm
    const res = await this.grades.myGrades(studentId);
    const done = [...res.terms].filter((t) => t.gpa != null).reverse();
    for (let i = 1; i < done.length; i++) {
      const drop = Math.round((done[i - 1].gpa! - done[i].gpa!) * 100) / 100;
      if (drop >= cfg.gpaDrop) add(`gpa:${done[i].code}`, 'PH_WARNING', `GPA học kỳ giảm ${drop.toFixed(2).replace('.', ',')} điểm`, `GPA của ${name} học kỳ ${done[i].code} là ${done[i].gpa!.toFixed(2)}, kỳ trước ${done[i - 1].gpa!.toFixed(2)}.`, '/parent');
    }
    // bài tập: điểm, bài nộp, hạn nộp
    const list = await this.submissions(userId, studentId);
    const now = Date.now();
    for (const a of list) {
      if (a.score != null) {
        add(`ag:${a.id}`, 'PH_GRADE', `Điểm bài “${a.title}”: ${f1(a.score)}`, `${a.course} · ${a.sectionCode}${a.lecturerNote ? ` · Nhận xét: ${a.lecturerNote}` : ''}`, '/parent/submissions');
        if (a.score < cfg.scoreThreshold) add(`aglow:${a.id}`, 'PH_WARNING', `Điểm bài tập dưới ngưỡng · ${a.title}`, `${name} đạt ${f1(a.score)}, thấp hơn ngưỡng ${f1(cfg.scoreThreshold)} (${a.course}).`, '/parent/submissions');
      }
      for (const f of a.feedback)
        add(`fb:${f.id}:${new Date(f.updatedAt).getTime()}`, 'PH_GRADE', `Giảng viên nhận xét bài “${a.title}”${f.personal ? ' (phần cá nhân)' : ''}`, `${f.lecturer}: ${f.content}`.slice(0, 1000), '/parent/submissions', new Date(f.updatedAt));
      if (a.submissionId && a.submittedAt)
        add(`sub:${a.submissionId}`, 'PH_SUBMISSION', `${a.workMode === 'GROUP' ? 'Nhóm của ' + name : name} đã nộp “${a.title}”${a.isLate ? ' (muộn)' : ''}`, `${a.submittedBy} nộp lúc ${new Date(a.submittedAt).toLocaleString('vi-VN')} · ${a.course}.`, '/parent/submissions', new Date(a.submittedAt));
      const due = new Date(a.dueAt).getTime();
      if (a.status === 'MISSED') add(`miss:${a.id}`, 'PH_WARNING', `Quá hạn chưa nộp · ${a.title}`, `${name} chưa nộp bài “${a.title}” (${a.course}), hạn ${new Date(a.dueAt).toLocaleString('vi-VN')}.`, '/parent/submissions', new Date(a.dueAt));
      else if (!a.submissionId && due > now && due - now < 48 * 3600_000)
        add(`due:${a.id}`, 'PH_DUE', `Sắp hết hạn nộp · ${a.title}`, `${name} chưa nộp, hạn ${new Date(a.dueAt).toLocaleString('vi-VN')} (${a.course}).`, '/parent/submissions');
    }
    if (rows.length) await this.prisma.notification.createMany({ data: rows, skipDuplicates: true });
  }
}

@Controller('parent')
@Roles('PARENT')
export class ParentController {
  constructor(private readonly svc: ParentService) {}

  @Get('children')
  children(@CurrentUser() u: AuthUser) {
    return this.svc.children(u.sub);
  }

  @Get('children/:id/results')
  results(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.results(u.sub, id);
  }

  @Get('children/:id/submissions')
  submissions(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.submissions(u.sub, id);
  }

  @Get('children/:id/notifications')
  notifications(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.notifications(u.sub, id);
  }

  @Post('children/:id/notifications/read-all')
  readAll(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.readAll(u.sub, id);
  }

  /** Số thông báo chưa đọc của con đang xem (chuông trên thanh trên cùng). */
  @Get('unread')
  async unread(@CurrentUser() u: AuthUser, @Query('child') child?: string) {
    if (!child) throw notFound('Sinh viên');
    const r = await this.svc.notifications(u.sub, child);
    return { unread: r.items.filter((n) => !n.readAt).length };
  }
}

@Module({
  imports: [GradesModule, SubmissionsModule],
  controllers: [ParentController],
  providers: [ParentService],
  exports: [ParentService],
})
export class ParentModule {}
