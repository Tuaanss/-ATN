import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppException, forbidden, notFound } from '../../common/errors/app-exception';
import { AuditService } from '../../common/audit/audit.service';
import { IMPORT_JOB_TTL_MS, RowError, SheetColumn, buildSheet, normCode, readSheet } from '../../common/utils/excel';
import { NotificationsService } from '../notifications/notifications.module';

export const groupLabel = (seq: number, name: string) => `Nhóm ${String(seq).padStart(2, '0')} · ${name}`;

const COLUMNS: SheetColumn[] = [
  { key: 'code', header: 'MSV', width: 14, aliases: ['MSSV', 'Mã SV', 'Mã sinh viên'], required: true },
  { key: 'name', header: 'Họ tên', width: 28, aliases: ['Họ và tên', 'Tên sinh viên'] },
  // Form quen dùng: cột STT gộp ô cho cả nhóm → STT chính là số nhóm
  { key: 'group', header: 'Nhóm', width: 12, aliases: ['Mã nhóm', 'Nhóm số', 'STT nhóm', 'STT'], required: true },
  { key: 'groupName', header: 'Tên nhóm', width: 28 },
  { key: 'leader', header: 'Trưởng nhóm', width: 14, aliases: ['Nhóm trưởng'] },
];

interface PlanMember {
  studentId: string;
  studentCode: string;
  fullName: string;
  leader: boolean;
}
interface GroupPlan {
  groups: { code: string; name: string; isNew: boolean; members: PlanMember[] }[];
  moved: { studentCode: string; fullName: string; from: string; to: string; hadSubmission: boolean }[];
  ungrouped: { studentId: string; studentCode: string; fullName: string; reason: 'EMPTY' | 'NOT_IN_FILE' }[];
  removedGroups: { code: string; name: string }[];
  /** SV có dòng lỗi: giữ nguyên nhóm hiện tại khi áp dụng phần hợp lệ */
  skipped: string[];
}

/** Nhóm do GV tải lên bằng Excel (UC05.1–5.6). SV không tự lập nhóm. */
@Injectable()
export class GroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  private async ownAssignment(lecturerId: string, id: string) {
    const a = await this.prisma.assignment.findFirst({
      where: { id, deletedAt: null },
      include: { section: { include: { students: { include: { student: true }, orderBy: { student: { studentCode: 'asc' } } } } } },
    });
    if (!a) throw notFound('Bài tập');
    if (a.section.lecturerId !== lecturerId) throw forbidden('Bạn không phụ trách bài tập này');
    return a;
  }

  private groupsOf(assignmentId: string) {
    return this.prisma.group.findMany({
      where: { assignmentId },
      include: {
        members: { include: { student: true }, orderBy: [{ role: 'asc' }, { student: { studentCode: 'asc' } }] },
        topic: true,
        submissions: { where: { kind: 'GROUP_SHARED' }, select: { id: true, submittedAt: true, isLate: true, version: true } },
      },
      orderBy: { seq: 'asc' },
    });
  }

  // ------------------------------------------------------------------ UC05.1 file mẫu

  async template(lecturerId: string, assignmentId: string) {
    const a = await this.ownAssignment(lecturerId, assignmentId);
    const groups = await this.groupsOf(a.id);
    const current = new Map(groups.flatMap((g) => g.members.map((m) => [m.studentId, { g, leader: m.role === 'LEADER' }] as const)));
    const rows = a.section.students.map(({ student: s }) => {
      const c = current.get(s.id);
      return [s.studentCode, s.fullName, c?.g.code ?? '', c?.g.name ?? '', c?.leader ? 'x' : ''];
    });
    const buffer = await buildSheet('Nhom', COLUMNS, rows, [
      'Mỗi dòng là một sinh viên của lớp học phần (đã điền sẵn).',
      'Cột "Nhóm": mã nhóm, ví dụ N01, N02… Các SV cùng mã là một nhóm. Để trống = SV chưa có nhóm.',
      'Cột "Tên nhóm": tùy chọn, ghi ở một dòng bất kỳ của nhóm. Bỏ trống thì tên nhóm = mã nhóm.',
      'Cột "Trưởng nhóm": ghi x cho tối đa một SV mỗi nhóm (tùy chọn).',
      'Không đổi tên các cột. Tải lên lại sẽ thay toàn bộ danh sách nhóm theo file mới.',
    ]);
    return { buffer, fileName: `Nhom_${a.section.code}.xlsx` };
  }

  // ------------------------------------------------------------------ UC05.2–5.3 tải lên & kiểm tra

  async preview(lecturerId: string, userId: string, assignmentId: string, file: Express.Multer.File) {
    const a = await this.ownAssignment(lecturerId, assignmentId);
    if (a.workMode !== 'GROUP') throw new AppException('WORK_MODE_LOCKED', 'Bài tập làm cá nhân, không cần danh sách nhóm', HttpStatus.CONFLICT);
    const rows = await readSheet(file, COLUMNS);
    const byCode = new Map(a.section.students.map((x) => [x.student.studentCode.toUpperCase(), x.student]));
    const existing = await this.groupsOf(a.id);
    const currentOf = new Map(existing.flatMap((g) => g.members.map((m) => [m.studentId, g] as const)));

    const errors: RowError[] = [];
    const seen = new Map<string, number>();
    const plan: GroupPlan = { groups: [], moved: [], ungrouped: [], removedGroups: [], skipped: [] };
    const valid: { row: number; student: { id: string; studentCode: string; fullName: string }; group: string; groupName: string; leader: boolean }[] = [];

    for (const { row, values } of rows) {
      const code = normCode(values.code ?? '');
      const fail = (message: string) => errors.push({ row, studentCode: code || undefined, message });
      // dòng trống của nhóm (ô STT gộp nhưng chưa có SV điền) → bỏ qua
      if (!code && !(values.name ?? '').trim()) continue;
      if (!code) {
        fail('Thiếu MSV');
        continue;
      }
      const st = byCode.get(code);
      if (!st) {
        fail(`MSV ${code} không thuộc lớp ${a.section.code}`);
        continue;
      }
      if (seen.has(code)) {
        fail(`MSV ${code} lặp lại (đã có ở dòng ${seen.get(code)})`);
        plan.skipped.push(st.id);
        continue;
      }
      seen.set(code, row);
      const rawGroup = normCode(values.group ?? '');
      // số thứ tự nhóm 1, 2, 3… → N01, N02, N03…
      const group = /^\d{1,3}$/.test(rawGroup) ? `N${rawGroup.padStart(2, '0')}` : rawGroup;
      if (group.length > 20) {
        fail('Mã nhóm tối đa 20 ký tự');
        plan.skipped.push(st.id);
        continue;
      }
      if ((values.groupName ?? '').length > 100) {
        fail('Tên nhóm tối đa 100 ký tự');
        plan.skipped.push(st.id);
        continue;
      }
      valid.push({ row, student: st, group, groupName: values.groupName ?? '', leader: !!values.leader });
    }

    // gom nhóm
    for (const v of valid) {
      if (!v.group) {
        plan.ungrouped.push({ studentId: v.student.id, studentCode: v.student.studentCode, fullName: v.student.fullName, reason: 'EMPTY' });
        continue;
      }
      let g = plan.groups.find((x) => x.code === v.group);
      if (!g) {
        const old = existing.find((x) => x.code === v.group);
        plan.groups.push((g = { code: v.group, name: v.groupName || old?.name || v.group, isNew: !old, members: [] }));
      } else if (v.groupName && g.name === g.code) g.name = v.groupName;
      let leader = v.leader;
      if (leader && g.members.some((m) => m.leader)) {
        errors.push({ row: v.row, studentCode: v.student.studentCode, message: `Nhóm ${g.code} đã có trưởng nhóm, dòng này được tính là thành viên` });
        leader = false;
      }
      g.members.push({ studentId: v.student.id, studentCode: v.student.studentCode, fullName: v.student.fullName, leader });
      const from = currentOf.get(v.student.id);
      if (from && from.code !== g.code)
        plan.moved.push({ studentCode: v.student.studentCode, fullName: v.student.fullName, from: from.code, to: g.code, hadSubmission: from.submissions.length > 0 });
    }
    const inFile = new Set([...valid.map((v) => v.student.id), ...plan.skipped]);
    for (const { student: s } of a.section.students)
      if (!inFile.has(s.id) && !rows.some((r) => normCode(r.values.code ?? '') === s.studentCode.toUpperCase()))
        plan.ungrouped.push({ studentId: s.id, studentCode: s.studentCode, fullName: s.fullName, reason: 'NOT_IN_FILE' });

    // nhóm cũ không còn trong file
    const keptBySkip = new Set(plan.skipped.map((id) => currentOf.get(id)?.code).filter(Boolean));
    for (const g of existing) {
      if (plan.groups.some((x) => x.code === g.code) || keptBySkip.has(g.code)) continue;
      if (g.submissions.length)
        errors.push({ row: 0, message: `Nhóm ${g.code} (${g.name}) đã nộp bài, không thể bỏ khỏi danh sách. Giữ lại mã nhóm này trong file.` });
      else plan.removedGroups.push({ code: g.code, name: g.name });
    }

    // dòng cảnh báo trưởng nhóm không chặn áp dụng
    const blocking = errors.filter((e) => !e.message.includes('được tính là thành viên'));
    const job = await this.prisma.importJob.create({
      data: {
        type: 'ASSIGNMENT_GROUPS',
        assignmentId: a.id,
        sectionId: a.sectionId,
        fileName: file.originalname,
        totalRows: rows.length,
        errorRows: new Set(blocking.filter((e) => e.row).map((e) => e.row)).size,
        preview: plan as unknown as Prisma.InputJsonValue,
        errors: errors as unknown as Prisma.InputJsonValue,
        createdById: userId,
      },
    });
    return {
      jobId: job.id,
      fileName: job.fileName,
      totalRows: rows.length,
      errorRows: job.errorRows,
      fileErrors: blocking.filter((e) => !e.row).length,
      groups: plan.groups.map((g) => ({ ...g, size: g.members.length })),
      moved: plan.moved,
      ungrouped: plan.ungrouped,
      removedGroups: plan.removedGroups,
      errors,
    };
  }

  /** Áp dụng bản xem trước: thay danh sách nhóm theo file. */
  async commit(lecturerId: string, userId: string, assignmentId: string, jobId: string, onlyValid = false) {
    const a = await this.ownAssignment(lecturerId, assignmentId);
    const job = await this.prisma.importJob.findFirst({ where: { id: jobId, assignmentId: a.id, type: 'ASSIGNMENT_GROUPS' } });
    if (!job) throw notFound('Bản xem trước');
    if (job.status !== 'PREVIEW' || Date.now() - job.createdAt.getTime() > IMPORT_JOB_TTL_MS)
      throw new AppException('IMPORT_JOB_EXPIRED', 'Bản xem trước đã hết hạn, hãy tải file lên lại', HttpStatus.GONE);
    const plan = job.preview as unknown as GroupPlan;
    const errors = job.errors as unknown as RowError[];
    if (errors.some((e) => !e.row)) throw new AppException('GROUP_HAS_SUBMISSION', errors.find((e) => !e.row)!.message, HttpStatus.CONFLICT);
    if (job.errorRows && !onlyValid)
      throw new AppException('VALIDATION_ERROR', `File còn ${job.errorRows} dòng lỗi. Sửa file hoặc chọn "Chỉ áp dụng dòng hợp lệ".`, HttpStatus.UNPROCESSABLE_ENTITY);

    const before = await this.groupsOf(a.id);
    const beforeOf = new Map(before.flatMap((g) => g.members.map((m) => [m.studentId, g.code] as const)));
    const skipped = new Set(plan.skipped);

    await this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM assignments WHERE id = ${a.id} FOR UPDATE`;
        let seq = before.reduce((m, g) => Math.max(m, g.seq), 0);
        for (const pg of plan.groups) {
          const old = before.find((g) => g.code === pg.code);
          const group = old
            ? await tx.group.update({ where: { id: old.id }, data: { name: pg.name, importJobId: job.id } })
            : await tx.group.create({ data: { assignmentId: a.id, seq: ++seq, code: pg.code, name: pg.name, importJobId: job.id } });
          const leader = pg.members.find((m) => m.leader)?.studentId ?? null;
          for (const m of pg.members) {
            const cur = await tx.groupMember.findUnique({ where: { assignmentId_studentId: { assignmentId: a.id, studentId: m.studentId } } });
            const role = m.studentId === leader ? 'LEADER' : 'MEMBER';
            if (cur && cur.groupId === group.id) {
              if (cur.role !== role) await tx.groupMember.update({ where: { groupId_studentId: { groupId: group.id, studentId: m.studentId } }, data: { role } });
              continue;
            }
            if (cur) await tx.groupMember.delete({ where: { groupId_studentId: { groupId: cur.groupId, studentId: m.studentId } } });
            await tx.groupMember.create({ data: { groupId: group.id, studentId: m.studentId, assignmentId: a.id, role } });
          }
          await tx.group.update({ where: { id: group.id }, data: { leaderId: leader } });
        }
        for (const u of plan.ungrouped) await tx.groupMember.deleteMany({ where: { assignmentId: a.id, studentId: u.studentId } });
        // nhóm không còn thành viên và chưa nộp bài → xóa (đề tài xóa theo)
        const empty = await tx.group.findMany({ where: { assignmentId: a.id, members: { none: {} }, submissions: { none: {} } }, select: { id: true } });
        if (empty.length) await tx.group.deleteMany({ where: { id: { in: empty.map((g) => g.id) } } });
        await tx.importJob.update({ where: { id: job.id }, data: { status: 'COMPLETED', completedAt: new Date() } });
        await tx.importJob.updateMany({ where: { assignmentId: a.id, type: 'ASSIGNMENT_GROUPS', status: 'PREVIEW' }, data: { status: 'CANCELLED' } });
        await tx.assignment.update({ where: { id: a.id }, data: { groupsImportedAt: new Date() } });
      },
      { timeout: 60_000 },
    );

    // thông báo SV có thay đổi
    const after = await this.groupsOf(a.id);
    const afterOf = new Map(after.flatMap((g) => g.members.map((m) => [m.studentId, g] as const)));
    const users = new Map(a.section.students.map((x) => [x.student.id, x.student.userId]));
    const assigned: string[] = [];
    const removed: string[] = [];
    for (const { student: s } of a.section.students) {
      if (skipped.has(s.id)) continue;
      const was = beforeOf.get(s.id);
      const now = afterOf.get(s.id);
      if (now && now.code !== was) assigned.push(s.id);
      if (!now && was) removed.push(s.id);
    }
    for (const id of assigned) {
      const g = afterOf.get(id)!;
      await this.notifications.notify([users.get(id)!], {
        type: 'GROUP_ASSIGNED',
        title: `Bạn thuộc ${g.code} · ${g.name}`,
        body: `${a.title} · ${g.members.length} thành viên`,
        link: `/student/assignments/${a.id}`,
      });
    }
    if (removed.length)
      await this.notifications.notify(removed.map((id) => users.get(id)!), {
        type: 'GROUP_REMOVED',
        title: `Bạn không còn trong danh sách nhóm: ${a.title}`,
        body: 'Liên hệ giảng viên nếu chưa đúng',
        link: `/student/assignments/${a.id}`,
      });
    await this.audit.log({
      actorId: userId,
      action: 'IMPORT_GROUPS',
      entityType: 'assignment',
      entityId: a.id,
      summary: `Áp dụng file nhóm ${job.fileName}: ${after.length} nhóm${job.errorRows ? `, bỏ qua ${job.errorRows} dòng lỗi` : ''}`,
    });
    return this.list(lecturerId, a.id);
  }

  // ------------------------------------------------------------------ UC05.4 GV xem nhóm

  async list(lecturerId: string, assignmentId: string) {
    const a = await this.ownAssignment(lecturerId, assignmentId);
    const [groups, reports, jobs] = await Promise.all([
      this.groupsOf(a.id),
      this.prisma.groupReport.findMany({ where: { assignmentId: a.id }, include: { student: true }, orderBy: [{ status: 'asc' }, { createdAt: 'desc' }] }),
      this.prisma.importJob.findMany({
        where: { assignmentId: a.id, type: 'ASSIGNMENT_GROUPS', status: 'COMPLETED' },
        include: { createdBy: { include: { lecturer: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);
    const grouped = new Set(groups.flatMap((g) => g.members.map((m) => m.studentId)));
    const codeOf = new Map(groups.map((g) => [g.id, g.code]));
    return {
      importedAt: a.groupsImportedAt,
      groups: groups.map((g) => ({
        id: g.id,
        seq: g.seq,
        code: g.code,
        name: g.name,
        members: g.members.map((m) => ({ studentId: m.studentId, studentCode: m.student.studentCode, fullName: m.student.fullName, role: m.role })),
        topic: g.topic && { title: g.topic.title, keywords: g.topic.keywords },
        submission: g.submissions[0] ? { id: g.submissions[0].id, submittedAt: g.submissions[0].submittedAt, isLate: g.submissions[0].isLate } : null,
      })),
      ungrouped: a.section.students
        .filter((x) => !grouped.has(x.studentId))
        .map(({ student: s }) => ({ studentId: s.id, studentCode: s.studentCode, fullName: s.fullName })),
      reports: reports.map((r) => ({
        id: r.id,
        student: { studentCode: r.student.studentCode, fullName: r.student.fullName },
        groupCode: r.groupId ? (codeOf.get(r.groupId) ?? null) : null,
        content: r.content,
        status: r.status,
        resolutionNote: r.resolutionNote,
        createdAt: r.createdAt,
        resolvedAt: r.resolvedAt,
      })),
      imports: jobs.map((j) => ({
        id: j.id,
        fileName: j.fileName,
        totalRows: j.totalRows,
        errorRows: j.errorRows,
        by: j.createdBy.lecturer?.fullName ?? j.createdBy.username,
        completedAt: j.completedAt,
      })),
    };
  }

  // ------------------------------------------------------------------ UC05.6 SV báo nhóm chưa đúng

  async report(studentId: string, assignmentId: string, content: string) {
    const a = await this.prisma.assignment.findFirst({ where: { id: assignmentId, deletedAt: null, status: { not: 'DRAFT' } }, include: { section: { include: { lecturer: true } } } });
    if (!a) throw notFound('Bài tập');
    const enrolled = await this.prisma.sectionStudent.findUnique({ where: { sectionId_studentId: { sectionId: a.sectionId, studentId } } });
    if (!enrolled) throw forbidden('Bạn không thuộc lớp học phần của bài tập này');
    if (a.workMode !== 'GROUP') throw new AppException('WORK_MODE_LOCKED', 'Bài tập làm cá nhân');
    const open = await this.prisma.groupReport.findFirst({ where: { assignmentId: a.id, studentId, status: 'OPEN' } });
    if (open) throw new AppException('GROUP_REPORT_PENDING_EXISTS', 'Bạn đã gửi phản hồi, đang chờ giảng viên xử lý', HttpStatus.CONFLICT);
    const member = await this.prisma.groupMember.findUnique({ where: { assignmentId_studentId: { assignmentId: a.id, studentId } }, include: { student: true, group: true } });
    const me = member?.student ?? (await this.prisma.student.findUniqueOrThrow({ where: { id: studentId } }));
    await this.prisma.groupReport.create({ data: { assignmentId: a.id, studentId, groupId: member?.groupId ?? null, content } });
    await this.notifications.notify([a.section.lecturer.userId], {
      type: 'GROUP_REPORTED',
      title: `${me.fullName} báo nhóm chưa đúng`,
      body: `${a.title} · ${a.section.code}${member ? ` · ${member.group.code}` : ' · chưa có nhóm'}: ${content.slice(0, 120)}`,
      link: `/lecturer/assignments/${a.id}?tab=groups`,
    });
    return { ok: true };
  }

  async resolveReport(lecturerId: string, userId: string, reportId: string, note?: string) {
    const r = await this.prisma.groupReport.findUnique({ where: { id: reportId }, include: { assignment: { include: { section: true } }, student: true } });
    if (!r) throw notFound('Phản hồi');
    if (r.assignment.section.lecturerId !== lecturerId) throw forbidden();
    if (r.status === 'RESOLVED') return { ok: true };
    await this.prisma.groupReport.update({ where: { id: r.id }, data: { status: 'RESOLVED', resolutionNote: note || null, resolvedById: userId, resolvedAt: new Date() } });
    await this.notifications.notify([r.student.userId], {
      type: 'GROUP_REPORT_RESOLVED',
      title: `Giảng viên đã xử lý phản hồi về nhóm`,
      body: `${r.assignment.title}${note ? `: ${note}` : ''}`,
      link: `/student/assignments/${r.assignmentId}`,
    });
    return { ok: true };
  }
}
