import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { forbidden, notFound } from '../../common/errors/app-exception';
import { AuditService } from '../../common/audit/audit.service';
import { DriveService } from '../../infra/drive/drive.service';
import { AssignmentsService } from './assignments.service';
import { finalDeadline } from './assignment-status';

type FileType = 'IMAGE' | 'VIDEO' | 'SOURCE' | 'DOCUMENT';

/**
 * Trang bài tập của GV (4 tab: Thông tin · Nhóm · Bài đã nộp · Điểm).
 * Trả thông tin chung + danh sách đơn vị làm bài (nhóm hoặc SV) kèm đề tài và bài nộp.
 * Nhóm và điểm chi tiết lấy qua API riêng của từng tab.
 */
@Injectable()
export class AssignmentDetailService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly drive: DriveService,
    private readonly assignments: AssignmentsService,
    private readonly audit: AuditService,
  ) {}

  async get(lecturerId: string, assignmentId: string) {
    const a = await this.prisma.assignment.findFirst({
      where: { id: assignmentId, deletedAt: null },
      include: {
        section: { include: { course: true, students: { include: { student: true } } } },
        groups: {
          orderBy: { seq: 'asc' },
          include: { members: { include: { student: true }, orderBy: [{ role: 'asc' }, { student: { studentCode: 'asc' } }] }, topic: true },
        },
        topics: true,
        submissions: {
          include: { lastSubmittedBy: true, files: { where: { deletedAt: null }, select: { fileType: true } }, lecturerNotes: { where: { lecturerId }, select: { content: true, isSample: true } } },
        },
      },
    });
    if (!a) throw notFound('Bài tập');
    if (a.section.lecturerId !== lecturerId) throw forbidden('Bạn không phụ trách bài tập này');

    const studentCount = a.section.students.length;
    const summary = await this.assignments.summarize(a, studentCount);
    type Sub = (typeof a.submissions)[number];

    const mapSub = (s: Sub | undefined) => {
      if (!s) return null;
      const count = (t: FileType) => s.files.filter((f) => f.fileType === t).length;
      return {
        id: s.id,
        submittedAt: s.submittedAt,
        submittedBy: s.lastSubmittedBy.fullName,
        submittedByCode: s.lastSubmittedBy.studentCode,
        isLate: s.isLate,
        lateDays: s.isLate ? Math.max(1, Math.ceil((s.submittedAt.getTime() - a.dueAt.getTime()) / 86400_000)) : 0,
        syncStatus: s.syncStatus,
        version: s.version,
        files: { images: count('IMAGE'), videos: count('VIDEO'), sources: count('SOURCE'), documents: count('DOCUMENT') },
        figma: !!s.figmaUrl,
        git: !!s.gitUrl,
        note: s.lecturerNotes[0] ? { hasText: !!s.lecturerNotes[0].content, isSample: s.lecturerNotes[0].isSample } : null,
      };
    };

    const units =
      a.workMode === 'GROUP'
        ? a.groups.map((g) => {
            const memberIds = new Set(g.members.map((m) => m.studentId));
            return {
              key: g.id,
              type: 'GROUP' as const,
              groupId: g.id,
              studentId: null as string | null,
              code: g.code,
              label: `${g.code} · ${g.name}`,
              members: g.members.map((m) => ({ studentId: m.studentId, fullName: m.student.fullName, studentCode: m.student.studentCode, role: m.role })),
              topic: g.topic && { title: g.topic.title, keywords: g.topic.keywords },
              submission: mapSub(a.submissions.find((s) => s.kind === 'GROUP_SHARED' && s.groupId === g.id)),
              personal: a.submissions
                .filter((s) => s.kind === 'PERSONAL' && s.studentId && memberIds.has(s.studentId))
                .map((s) => ({ id: s.id, studentId: s.studentId, contributionPercent: s.contributionPercent, submittedAt: s.submittedAt, isLate: s.isLate, fileCount: s.files.length, isSample: !!s.lecturerNotes[0]?.isSample, hasNote: !!s.lecturerNotes[0]?.content })),
            };
          })
        : a.section.students
            .map((x) => x.student)
            .sort((x, y) => x.studentCode.localeCompare(y.studentCode))
            .map((st) => {
              const t = a.topics.find((x) => x.studentId === st.id);
              return {
                key: st.id,
                type: 'INDIVIDUAL' as const,
                groupId: null as string | null,
                studentId: st.id as string | null,
                code: st.studentCode,
                label: st.fullName,
                members: [{ studentId: st.id, fullName: st.fullName, studentCode: st.studentCode, role: 'MEMBER' as const }],
                topic: t ? { title: t.title, keywords: t.keywords } : null,
                submission: mapSub(a.submissions.find((s) => s.kind === 'PERSONAL' && s.studentId === st.id)),
                personal: [] as { id: string; studentId: string | null; contributionPercent: number | null; submittedAt: Date; isLate: boolean; fileCount: number; isSample: boolean; hasNote: boolean }[],
              };
            });

    const [views, history] = await Promise.all([
      this.prisma.assignmentView.count({ where: { assignmentId: a.id } }),
      this.audit.history('assignment', a.id, 20),
    ]);

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
        weight: a.weight,
        suggestedTopics: a.suggestedTopics,
        hasIndividualPart: a.hasIndividualPart,
        groupsImportedAt: a.groupsImportedAt,
        gradesPublishedAt: a.gradesPublishedAt,
        status: a.status,
        autoOpen: a.autoOpen,
        createdAt: a.createdAt,
        brief: a.briefFileName ? { name: a.briefFileName, size: Number(a.briefFileSize ?? 0) } : null,
        driveFolderUrl: this.drive.folderUrl(a.driveFolderId),
        section: { id: a.section.id, code: a.section.code, studentCount, course: { name: a.section.course.name, type: a.section.course.courseType } },
      },
      ...summary,
      views,
      units,
      history: history.map((h) => ({
        action: h.action,
        summary: h.summary,
        actor: h.actor?.lecturer?.fullName ?? h.actor?.student?.fullName ?? 'Hệ thống',
        createdAt: h.createdAt,
      })),
    };
  }
}
