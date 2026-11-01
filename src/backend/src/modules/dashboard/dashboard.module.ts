import { Controller, Get, Injectable, Module } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuthUser, CurrentUser, Roles } from '../../common/auth/auth.decorators';
import { AssignmentsModule } from '../assignments/assignments.module';
import { AssignmentsService } from '../assignments/assignments.service';
import { finalDeadline } from '../assignments/assignment-status';
import { SubmissionsModule } from '../submissions/submissions.module';
import { MyStatus, StudentWorkService } from '../submissions/student-work.service';
import { NotificationsService } from '../notifications/notifications.module';

const DAY = 86_400_000;
const shortTitle = (t: string) => t.split('–')[0].trim();
/** Đơn vị làm bài: bài chung của nhóm, hoặc bài của SV không thuộc nhóm nào. */
const unitFilter = { OR: [{ kind: 'GROUP_SHARED' as const }, { kind: 'PERSONAL' as const, assignment: { workMode: 'INDIVIDUAL' as const } }] };

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assignments: AssignmentsService,
    private readonly work: StudentWorkService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Tổng quan giảng viên (mẫu GV_Dashboard). */
  async lecturer(user: AuthUser) {
    const lecturerId = user.lecturerId!;
    const now = new Date();
    const sections = await this.prisma.courseSection.findMany({
      where: { lecturerId, semester: { isCurrent: true } },
      include: { course: true, semester: true, _count: { select: { students: true } } },
      orderBy: { code: 'asc' },
    });
    const sectionIds = sections.map((s) => s.id);
    const assignments = await this.prisma.assignment.findMany({
      where: { sectionId: { in: sectionIds }, deletedAt: null, status: { not: 'DRAFT' } },
      orderBy: { openAt: 'desc' },
    });
    const sectionOf = (id: string) => sections.find((s) => s.id === id)!;
    const summaries = new Map(
      await Promise.all(assignments.map(async (a) => [a.id, await this.assignments.summarize(a, sectionOf(a.sectionId)._count.students)] as const)),
    );
    const ids = assignments.map((a) => a.id);

    // ---- thẻ số liệu (chỉ số lưu trữ, không theo dõi tiến độ)
    const weekAgo = new Date(now.getTime() - 7 * DAY);
    const [newSubmissions, reports] = await Promise.all([
      this.prisma.submission.count({ where: { assignmentId: { in: ids }, submittedAt: { gte: weekAgo }, ...unitFilter } }),
      this.prisma.groupReport.findMany({ where: { assignmentId: { in: ids }, status: 'OPEN' }, select: { assignmentId: true } }),
    ]);
    const noGroups = assignments.filter((a) => a.workMode === 'GROUP' && !a.groupsImportedAt && a.status !== 'CLOSED');
    const ungraded = assignments.filter((a) => finalDeadline(a) < now && !a.gradesPublishedAt);

    // ---- cần xử lý
    const todo: { kind: 'report' | 'group' | 'grade' | 'sync'; title: string; sub: string; link: string }[] = [];
    for (const a of assignments) {
      const n = reports.filter((r) => r.assignmentId === a.id).length;
      if (n) todo.push({ kind: 'report', title: `${n} phản hồi nhóm chưa đúng`, sub: `${shortTitle(a.title)} · ${sectionOf(a.sectionId).code}`, link: `/lecturer/assignments/${a.id}?tab=groups` });
    }
    for (const a of noGroups)
      todo.push({ kind: 'group', title: 'Chưa tải danh sách nhóm', sub: `${shortTitle(a.title)} · ${sectionOf(a.sectionId).code}`, link: `/lecturer/assignments/${a.id}?tab=groups` });
    for (const a of ungraded)
      todo.push({ kind: 'grade', title: summaries.get(a.id)!.stats.graded ? 'Chưa công bố điểm' : 'Chưa tải điểm', sub: `${shortTitle(a.title)} · ${sectionOf(a.sectionId).code}`, link: `/lecturer/assignments/${a.id}?tab=grades` });

    // ---- cảnh báo Drive
    const failed = await this.prisma.submissionFile.findMany({
      where: { deletedAt: null, syncStatus: { in: ['FAILED', 'MISSING'] }, submission: { assignment: { sectionId: { in: sectionIds } } } },
      select: { submissionId: true, submission: { select: { assignment: { select: { id: true, title: true, section: { select: { code: true } } } } } } },
    });
    const driveAlert = failed.length
      ? {
          assignmentId: failed[0].submission.assignment.id,
          assignment: failed[0].submission.assignment.title,
          section: failed[0].submission.assignment.section.code,
          submissions: new Set(failed.map((f) => f.submissionId)).size,
        }
      : null;

    // ---- phổ điểm bài gần nhất có điểm
    const gradedAssignment = assignments.find((a) => a.gradesPublishedAt) ?? assignments.find((a) => summaries.get(a.id)!.stats.graded > 0);
    let histogram: { label: string; count: number }[] | null = null;
    if (gradedAssignment) {
      const scores = (await this.prisma.assignmentGrade.findMany({ where: { assignmentId: gradedAssignment.id, score: { not: null } }, select: { score: true } })).map((s) => Number(s.score));
      const bins: [string, number, number][] = [['<4', 0, 4], ['4–5', 4, 5], ['5–6', 5, 6], ['6–7', 6, 7], ['7–8', 7, 8], ['8–9', 8, 9], ['9–10', 9, 10.01]];
      histogram = bins.map(([label, from, to]) => ({ label, count: scores.filter((x) => x >= from && x < to).length }));
    }

    const sem = sections[0]?.semester;
    return {
      semester: sem && { term: sem.term, academicYear: sem.academicYear },
      totals: { sections: sections.length, students: sections.reduce((n, s) => n + s._count.students, 0) },
      driveAlert,
      stats: {
        newSubmissions,
        openAssignments: assignments.filter((a) => a.status === 'OPEN' && finalDeadline(a) > now).length,
        openReports: reports.length,
        noGroups: noGroups.length,
        ungraded: ungraded.length,
      },
      sections: sections.map((s) => {
        const list = assignments.filter((a) => a.sectionId === s.id);
        const latest = list[0];
        const sum = latest && summaries.get(latest.id)!;
        return {
          id: s.id,
          code: s.code,
          course: s.course.name,
          students: s._count.students,
          assignments: list.length,
          open: list.filter((a) => a.status === 'OPEN' && finalDeadline(a) > now).length,
          latest: sum ? { title: sum.title, submitted: sum.stats.submitted, expected: sum.stats.expected } : null,
        };
      }),
      todo: todo.slice(0, 6),
      histogram: gradedAssignment && histogram ? { title: `${gradedAssignment.title} (${sectionOf(gradedAssignment.sectionId).code})`, bins: histogram } : null,
      interest: sections.map((s) => ({ code: s.code, count: 0 })),
    };
  }

  /** Tổng quan sinh viên (mẫu SV_Dashboard). */
  async student(user: AuthUser) {
    const studentId = user.studentId!;
    const now = new Date();
    const enrollments = await this.prisma.sectionStudent.findMany({
      where: { studentId, section: { semester: { isCurrent: true } } },
      include: { section: { include: { course: true, lecturer: true, semester: true } } },
      orderBy: { section: { code: 'asc' } },
    });
    const sectionIds = enrollments.map((e) => e.sectionId);
    const assignments = await this.prisma.assignment.findMany({
      where: { sectionId: { in: sectionIds }, deletedAt: null, status: { not: 'DRAFT' }, openAt: { lte: now } },
      include: { section: { include: { course: true } } },
      orderBy: { dueAt: 'asc' },
    });
    const statuses = await this.work.statusMany(studentId, assignments);
    const done: MyStatus[] = ['SUBMITTED', 'LATE', 'GRADED'];
    const rows = assignments.map((a) => this.work.assignmentRow(a, statuses.get(a.id)!));
    const active = rows.filter((r) => r.finalDeadline > now && !['GRADED', 'MISSED'].includes(r.status));
    const due3 = active.filter((r) => !done.includes(r.status) && r.finalDeadline.getTime() - now.getTime() <= 3 * DAY);
    const published = rows.filter((r) => r.score != null).length;
    const sem = enrollments[0]?.section.semester;

    return {
      semester: sem && { term: sem.term, academicYear: sem.academicYear, week: Math.max(1, Math.floor((now.getTime() - sem.startDate.getTime()) / (7 * DAY)) + 1) },
      dueSoon: due3.length,
      stats: {
        openAssignments: active.length,
        due3Days: due3.length,
        noGroup: rows.filter((r) => r.status === 'NO_GROUP').length,
        published,
        enterpriseViews: 0,
      },
      upcoming: active.slice(0, 6),
      sections: enrollments.map((e) => {
        const list = rows.filter((r) => r.section?.id === e.sectionId);
        return {
          id: e.section.id,
          code: e.section.code,
          course: e.section.course.name,
          type: e.section.course.courseType,
          lecturer: e.section.lecturer.fullName,
          total: list.length,
          done: list.filter((r) => done.includes(r.status)).length,
        };
      }),
      notifications: await this.notifications.list(user.sub, 6),
    };
  }
}

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get('lecturer')
  @Roles('LECTURER')
  lecturer(@CurrentUser() u: AuthUser) {
    return this.service.lecturer(u);
  }

  @Get('student')
  @Roles('STUDENT')
  student(@CurrentUser() u: AuthUser) {
    return this.service.student(u);
  }
}

@Module({
  imports: [AssignmentsModule, SubmissionsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
