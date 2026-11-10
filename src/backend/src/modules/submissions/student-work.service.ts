import { Injectable } from '@nestjs/common';
import { Assignment, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { forbidden, notFound } from '../../common/errors/app-exception';
import { finalDeadline, isAcceptingSubmissions } from '../assignments/assignment-status';
import { SIMILAR_THRESHOLD, similarity } from '../topics/similarity';

/**
 * Trạng thái của SV với một bài tập – quyết định bước hiện tại trên thanh 4 bước
 * (Đề bài & nhóm → Đề tài → Nộp bài → Kết quả).
 */
export type MyStatus = 'NOT_OPEN' | 'NO_GROUP' | 'NO_TOPIC' | 'NOT_SUBMITTED' | 'SUBMITTED' | 'LATE' | 'MISSED' | 'GRADED';

const groupInclude = {
  members: { include: { student: true }, orderBy: [{ role: 'asc' }, { student: { studentCode: 'asc' } }] },
  topic: true,
} satisfies Prisma.GroupInclude;

type GroupWithMembers = Prisma.GroupGetPayload<{ include: typeof groupInclude }>;

interface StatusCtx {
  hasGroup: boolean;
  hasTopic: boolean;
  submission: { status: string } | null;
  graded: boolean;
}

@Injectable()
export class StudentWorkService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------- truy cập

  /** Bài tập SV được xem: thuộc LHP SV đang học, đã mở. */
  async accessibleAssignment(studentId: string, assignmentId: string) {
    const a = await this.prisma.assignment.findFirst({
      where: { id: assignmentId, deletedAt: null },
      include: { section: { include: { course: true, semester: true, lecturer: true } } },
    });
    if (!a) throw notFound('Bài tập');
    const enrolled = await this.prisma.sectionStudent.findUnique({ where: { sectionId_studentId: { sectionId: a.sectionId, studentId } } });
    if (!enrolled) throw forbidden('Bạn không thuộc lớp học phần của bài tập này');
    if (a.status === 'DRAFT') throw notFound('Bài tập');
    return a;
  }

  async myGroup(studentId: string, assignmentId: string): Promise<GroupWithMembers | null> {
    const m = await this.prisma.groupMember.findUnique({
      where: { assignmentId_studentId: { assignmentId, studentId } },
      include: { group: { include: groupInclude } },
    });
    return m?.group ?? null;
  }

  /** Bài cá nhân: SV làm một mình. Bài nhóm: theo danh sách GV tải lên. */
  isIndividual(a: Pick<Assignment, 'workMode'>): boolean {
    return a.workMode === 'INDIVIDUAL';
  }

  // ---------------------------------------------------------------- trạng thái

  computeStatus(a: Pick<Assignment, 'status' | 'openAt' | 'dueAt' | 'allowLate' | 'lateDueAt' | 'workMode'>, ctx: StatusCtx, now = new Date()): MyStatus {
    if (a.status === 'DRAFT' || a.openAt > now) return 'NOT_OPEN';
    if (ctx.graded) return 'GRADED';
    if (ctx.submission) return ctx.submission.status === 'LATE' ? 'LATE' : 'SUBMITTED';
    if (now > finalDeadline(a) || a.status === 'CLOSED') return 'MISSED';
    if (a.workMode === 'GROUP' && !ctx.hasGroup) return 'NO_GROUP';
    if (!ctx.hasTopic) return 'NO_TOPIC';
    return 'NOT_SUBMITTED';
  }

  /** Trạng thái của SV cho nhiều bài tập (danh sách & dashboard). */
  async statusMany(studentId: string, assignments: Assignment[]) {
    const ids = assignments.map((a) => a.id);
    const [memberships, topics, personal, grades] = await Promise.all([
      this.prisma.groupMember.findMany({
        where: { studentId, assignmentId: { in: ids } },
        include: { group: { include: { topic: true, submissions: { where: { kind: 'GROUP_SHARED' } }, _count: { select: { members: true } } } } },
      }),
      this.prisma.topic.findMany({ where: { studentId, assignmentId: { in: ids } } }),
      this.prisma.submission.findMany({ where: { studentId, kind: 'PERSONAL', assignmentId: { in: ids } } }),
      this.prisma.assignmentGrade.findMany({ where: { studentId, assignmentId: { in: ids } } }),
    ]);
    const result = new Map<
      string,
      { status: MyStatus; score: number | null; submittedAt: Date | null; groupCode: string | null; groupName: string | null; groupSize: number | null; topic: string | null }
    >();
    for (const a of assignments) {
      const m = memberships.find((x) => x.assignmentId === a.id);
      const submission = m ? (m.group.submissions[0] ?? null) : (personal.find((s) => s.assignmentId === a.id) ?? null);
      const topic = m ? m.group.topic : (topics.find((t) => t.assignmentId === a.id) ?? null);
      const g = grades.find((x) => x.assignmentId === a.id);
      const score = a.gradesPublishedAt && g?.score != null ? Number(g.score) : null;
      const status = this.computeStatus(a, { hasGroup: !!m, hasTopic: !!topic, submission, graded: score != null });
      result.set(a.id, {
        status,
        score,
        submittedAt: submission?.submittedAt ?? null,
        groupCode: m ? m.group.code : null,
        groupName: m ? m.group.name : null,
        groupSize: m ? m.group._count.members : null,
        topic: topic?.title ?? null,
      });
    }
    return result;
  }

  // ---------------------------------------------------------------- LHP & danh sách bài

  private sectionView(s: Prisma.CourseSectionGetPayload<{ include: { course: true; semester: true; lecturer: true } }>) {
    return {
      id: s.id,
      code: s.code,
      course: { code: s.course.code, name: s.course.name, credits: s.course.credits },
      semester: { code: s.semester.code, academicYear: s.semester.academicYear, term: s.semester.term, isCurrent: s.semester.isCurrent, startDate: s.semester.startDate, endDate: s.semester.endDate },
      lecturer: { fullName: s.lecturer.fullName, email: s.lecturer.email },
    };
  }

  async mySections(studentId: string) {
    const rows = await this.prisma.sectionStudent.findMany({
      where: { studentId },
      include: {
        section: {
          include: { course: true, semester: true, lecturer: true, assignments: { where: { deletedAt: null, status: { not: 'DRAFT' } } } },
        },
      },
      orderBy: { section: { code: 'asc' } },
    });
    const all = rows.flatMap((r) => r.section.assignments);
    const statuses = await this.statusMany(studentId, all);
    const done: MyStatus[] = ['SUBMITTED', 'LATE', 'GRADED'];
    const now = Date.now();
    return rows.map(({ section: s }) => {
      const list = s.assignments.map((a) => ({ a, st: statuses.get(a.id)!.status }));
      return {
        ...this.sectionView(s),
        assignmentCount: s.assignments.length,
        submittedCount: list.filter((x) => done.includes(x.st)).length,
        dueSoonCount: list.filter((x) => !done.includes(x.st) && x.st !== 'MISSED' && finalDeadline(x.a).getTime() - now < 3 * 86400_000 && finalDeadline(x.a).getTime() > now).length,
      };
    });
  }

  /** "Bài tập của tôi": bài đã mở của học kỳ hiện tại + bài của học kỳ cũ vẫn đang nhận nộp (GV mở lại để SV đăng bài cũ). */
  async myAssignments(studentId: string) {
    const assignments = await this.prisma.assignment.findMany({
      where: { deletedAt: null, status: { not: 'DRAFT' }, openAt: { lte: new Date() }, section: { students: { some: { studentId } } }, OR: [{ section: { semester: { isCurrent: true } } }, { status: 'OPEN', dueAt: { gte: new Date() } }, { status: 'OPEN', allowLate: true, lateDueAt: { gte: new Date() } }] },
      include: { section: { include: { course: true } } },
      orderBy: [{ dueAt: 'desc' }],
    });
    const statuses = await this.statusMany(studentId, assignments);
    return assignments.map((a) => this.assignmentRow(a, statuses.get(a.id)!));
  }

  /** Bảng bài tập (dùng cho trang môn học và "Bài tập của tôi"). */
  assignmentRow(a: Assignment & { section?: { id: string; code: string; course: { name: string } } }, st: ReturnType<StudentWorkService['statusMany']> extends Promise<Map<string, infer V>> ? V : never) {
    return {
      id: a.id,
      title: a.title,
      workMode: a.workMode,
      hasIndividualPart: a.hasIndividualPart,
      openAt: a.openAt,
      dueAt: a.dueAt,
      finalDeadline: finalDeadline(a),
      gradesPublished: !!a.gradesPublishedAt,
      productTypes: a.productTypes,
      hasBrief: !!a.briefFileName,
      section: a.section && { id: a.section.id, code: a.section.code, course: a.section.course.name },
      ...st,
    };
  }

  async sectionDetail(studentId: string, sectionId: string) {
    const enrolled = await this.prisma.sectionStudent.findUnique({
      where: { sectionId_studentId: { sectionId, studentId } },
      include: { section: { include: { course: true, semester: true, lecturer: true, _count: { select: { students: true } } } } },
    });
    if (!enrolled) throw forbidden('Bạn không thuộc lớp học phần này');
    const assignments = await this.prisma.assignment.findMany({
      where: { sectionId, deletedAt: null, status: { not: 'DRAFT' } },
      orderBy: { openAt: 'asc' },
    });
    const statuses = await this.statusMany(studentId, assignments);
    const ids = assignments.map((a) => a.id);
    const [groups, classmates, notices] = await Promise.all([
      this.prisma.groupMember.findMany({
        where: { studentId, assignmentId: { in: ids } },
        include: { group: { include: { members: { include: { student: true }, orderBy: [{ role: 'asc' }, { student: { studentCode: 'asc' } }] } } } },
      }),
      this.prisma.sectionStudent.findMany({ where: { sectionId }, include: { student: true }, orderBy: { student: { studentCode: 'asc' } } }),
      this.prisma.notification.findMany({
        where: { user: { student: { id: studentId } }, type: { in: ['ASSIGNMENT_OPENED', 'ASSIGNMENT_UPDATED', 'GROUP_ASSIGNED', 'GROUP_REMOVED', 'ASSIGNMENT_GRADES_PUBLISHED'] }, OR: ids.map((id) => ({ link: { contains: id } })) },
        orderBy: { createdAt: 'desc' },
        take: 6,
      }),
    ]);
    const s = enrolled.section;
    return {
      section: { ...this.sectionView(s), studentCount: s._count.students },
      assignments: assignments.map((a) => this.assignmentRow(a, statuses.get(a.id)!)),
      myGroups: assignments
        .filter((a) => a.workMode === 'GROUP')
        .map((a) => {
          const m = groups.find((g) => g.assignmentId === a.id);
          return {
            assignmentId: a.id,
            assignmentTitle: a.title,
            status: statuses.get(a.id)!.status,
            group: m && {
              seq: m.group.seq,
              code: m.group.code,
              name: m.group.name,
              role: m.role,
              members: m.group.members.map((x) => ({ fullName: x.student.fullName, studentCode: x.student.studentCode, role: x.role })),
            },
          };
        }),
      classmates: classmates.map((c) => ({ studentCode: c.student.studentCode, fullName: c.student.fullName, cohort: c.student.cohort, major: c.student.major })),
      notices: notices.map((n) => ({ id: n.id, title: n.title, body: n.body, createdAt: n.createdAt, readAt: n.readAt })),
    };
  }

  // ---------------------------------------------------------------- chi tiết bài tập của tôi

  async myWork(studentId: string, assignmentId: string) {
    const a = await this.accessibleAssignment(studentId, assignmentId);
    // ghi nhận SV đã mở đề bài (thẻ "Đã xem đề bài" của GV)
    await this.prisma.assignmentView.upsert({
      where: { assignmentId_studentId: { assignmentId: a.id, studentId } },
      create: { assignmentId: a.id, studentId },
      update: {},
    });

    const group = await this.myGroup(studentId, a.id);
    const topic = group ? group.topic : await this.prisma.topic.findUnique({ where: { assignmentId_studentId: { assignmentId: a.id, studentId } } });

    const subInclude = { files: { where: { deletedAt: null }, orderBy: { sortOrder: 'asc' } }, lastSubmittedBy: true } satisfies Prisma.SubmissionInclude;
    const [shared, personal, topicHistory, others, grade, report] = await Promise.all([
      group ? this.prisma.submission.findFirst({ where: { assignmentId: a.id, groupId: group.id, kind: 'GROUP_SHARED' }, include: subInclude }) : null,
      this.prisma.submission.findFirst({ where: { assignmentId: a.id, studentId, kind: 'PERSONAL' }, include: subInclude }),
      topic
        ? this.prisma.topicHistory.findMany({ where: { topicId: topic.id }, orderBy: { createdAt: 'desc' }, take: 10, include: { actor: { include: { lecturer: true, student: true } } } })
        : [],
      topic ? this.prisma.topic.findMany({ where: { assignmentId: a.id, id: { not: topic.id } }, include: { group: true, student: true } }) : [],
      a.gradesPublishedAt ? this.prisma.assignmentGrade.findUnique({ where: { assignmentId_studentId: { assignmentId: a.id, studentId } } }) : null,
      this.prisma.groupReport.findFirst({ where: { assignmentId: a.id, studentId }, orderBy: { createdAt: 'desc' } }),
    ]);
    const mainSubmission = group ? shared : personal;
    const events = mainSubmission
      ? await this.prisma.submissionEvent.findMany({
          where: group ? { assignmentId: a.id, groupId: group.id } : { assignmentId: a.id, studentId, kind: 'PERSONAL' },
          orderBy: { createdAt: 'desc' },
          take: 10,
        })
      : [];
    const actors = await this.prisma.user.findMany({ where: { id: { in: [...new Set(events.map((e) => e.actorId))] } }, include: { student: true } });
    const actorName = new Map(actors.map((u) => [u.id, u.student?.fullName ?? u.username]));
    // submission_events.actor_id lưu student id
    const studentNames = await this.prisma.student.findMany({ where: { id: { in: [...new Set(events.map((e) => e.actorId))] } } });
    for (const s of studentNames) actorName.set(s.id, s.fullName);

    const now = new Date();
    const feedbacks = await this.prisma.submissionFeedback.findMany({ where: { submissionId: { in: [shared?.id, personal?.id].filter((x): x is string => !!x) } }, include: { lecturer: true }, orderBy: { updatedAt: 'desc' } });
    const mapSub = (s: typeof shared) =>
      s && {
        feedback: feedbacks.filter((f) => f.submissionId === s.id).map((f) => ({ lecturer: f.lecturer.fullName, content: f.content, updatedAt: f.updatedAt })),
        id: s.id,
        kind: s.kind,
        version: s.version,
        status: s.status,
        isLate: s.isLate,
        submittedAt: s.submittedAt,
        submittedBy: s.lastSubmittedBy.fullName,
        submittedByCode: s.lastSubmittedBy.studentCode,
        syncStatus: s.syncStatus,
        figmaUrl: s.figmaUrl,
        gitUrl: s.gitUrl,
        note: s.note,
        contributionPercent: s.contributionPercent,
        files: s.files.map((f) => ({ id: f.id, name: f.originalName, fileType: f.fileType, mimeType: f.mimeType, size: Number(f.sizeBytes), syncStatus: f.syncStatus })),
      };

    const score = grade?.score != null ? Number(grade.score) : null;
    const status = this.computeStatus(a, { hasGroup: !!group, hasTopic: !!topic, submission: mainSubmission, graded: score != null });
    const lateDays = mainSubmission?.isLate ? Math.max(1, Math.ceil((mainSubmission.submittedAt.getTime() - a.dueAt.getTime()) / 86400_000)) : 0;

    return {
      assignment: {
        id: a.id,
        title: a.title,
        description: a.description,
        workMode: a.workMode,
        productTypes: a.productTypes,
        openAt: a.openAt,
        dueAt: a.dueAt,
        finalDeadline: finalDeadline(a),
        allowLate: a.allowLate,
        lateDueAt: a.lateDueAt,
        suggestedTopics: a.suggestedTopics,
        hasIndividualPart: a.hasIndividualPart,
        groupsImportedAt: a.groupsImportedAt,
        gradesPublishedAt: a.gradesPublishedAt,
        brief: a.briefFileName ? { name: a.briefFileName, size: Number(a.briefFileSize ?? 0) } : null,
        status: a.status,
        accepting: isAcceptingSubmissions(a, now),
        section: this.sectionView(a.section),
      },
      me: { studentId },
      group: group && {
        id: group.id,
        seq: group.seq,
        code: group.code,
        name: group.name,
        members: group.members.map((m) => ({ studentId: m.studentId, studentCode: m.student.studentCode, fullName: m.student.fullName, role: m.role })),
      },
      report: report && { id: report.id, content: report.content, status: report.status, resolutionNote: report.resolutionNote, createdAt: report.createdAt, resolvedAt: report.resolvedAt },
      topic: topic && {
        id: topic.id,
        title: topic.title,
        keywords: topic.keywords,
        updatedAt: topic.updatedAt,
        history: topicHistory.map((h) => ({
          action: h.action,
          title: h.title,
          note: h.note,
          actor: h.actor.lecturer?.fullName ?? h.actor.student?.fullName ?? h.actor.username,
          createdAt: h.createdAt,
        })),
        similar: others
          .map((t) => ({ t, score: similarity(topic.title, t.title) }))
          .filter((x) => x.score >= SIMILAR_THRESHOLD)
          .map(({ t }) => ({ title: t.title, owner: t.group ? t.group.code : (t.student?.fullName ?? '') })),
      },
      grade: score != null || grade?.note ? { score, note: grade?.note ?? null, publishedAt: a.gradesPublishedAt } : null,
      status,
      lateDays,
      shared: mapSub(shared),
      personal: mapSub(personal),
      events: events.map((e) => ({
        action: e.action,
        actor: actorName.get(e.actorId) ?? '',
        version: e.version,
        detail: e.detail as { added?: { name: string }[]; removed?: { name: string }[] } | null,
        createdAt: e.createdAt,
      })),
    };
  }
}
