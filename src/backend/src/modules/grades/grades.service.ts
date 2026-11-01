import { HttpStatus, Injectable } from '@nestjs/common';
import { ImportType, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppException, forbidden, notFound } from '../../common/errors/app-exception';
import { AuditService } from '../../common/audit/audit.service';
import { IMPORT_JOB_TTL_MS, RowError, SheetColumn, buildSheet, normCode, parseScore, readSheet } from '../../common/utils/excel';
import { NotificationsService } from '../notifications/notifications.module';
import { SystemConfigService } from '../../common/config/system-config.service';
import { strs } from '../../common/utils/json';

const ASSIGNMENT_COLUMNS: SheetColumn[] = [
  { key: 'code', header: 'MSSV', width: 14, aliases: ['Mã SV', 'Mã sinh viên'], required: true },
  { key: 'name', header: 'Họ tên', width: 28, aliases: ['Họ và tên'] },
  { key: 'group', header: 'Nhóm', width: 10 },
  { key: 'topic', header: 'Đề tài', width: 40 },
  { key: 'score', header: 'Điểm', width: 10, required: true },
  { key: 'note', header: 'Nhận xét', width: 50 },
];

const SECTION_COLUMNS: SheetColumn[] = [
  { key: 'code', header: 'MSSV', width: 14, aliases: ['Mã SV', 'Mã sinh viên'], required: true },
  { key: 'name', header: 'Họ tên', width: 28, aliases: ['Họ và tên'] },
  { key: 'attendance', header: 'Chuyên cần', width: 12, required: true },
  { key: 'assignment', header: 'Bài tập', width: 12, required: true },
  { key: 'midterm', header: 'Giữa kỳ', width: 12, required: true },
  { key: 'final', header: 'Cuối kỳ', width: 12, required: true },
];

type Comp = 'attendance' | 'assignment' | 'midterm' | 'final';
const COMPS: Comp[] = ['attendance', 'assignment', 'midterm', 'final'];

interface AssignmentGradeRow {
  studentId: string;
  studentCode: string;
  fullName: string;
  oldScore: number | null;
  oldNote: string | null;
  score: number | null;
  note: string | null;
  changed: boolean;
}
interface SectionGradeRow {
  studentId: string;
  studentCode: string;
  fullName: string;
  old: Record<Comp, number | null>;
  values: Record<Comp, number | null>;
  total: number | null;
  letter: string | null;
  changed: boolean;
}

const num = (d: Prisma.Decimal | null | undefined) => (d == null ? null : Number(d));
const round1 = (n: number) => Math.round(n * 10) / 10;

/** Điểm: GV chấm ngoài hệ thống, tải lên bằng Excel, công bố (UC07). */
@Injectable()
export class GradesService {
  constructor(
    private readonly config: SystemConfigService,
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  // ================================================================ chung

  private async ownAssignment(lecturerId: string, id: string) {
    const a = await this.prisma.assignment.findFirst({
      where: { id, deletedAt: null },
      include: { section: { include: { students: { include: { student: true }, orderBy: { student: { studentCode: 'asc' } } } } } },
    });
    if (!a) throw notFound('Bài tập');
    if (a.section.lecturerId !== lecturerId) throw forbidden('Bạn không phụ trách bài tập này');
    return a;
  }

  private async ownSection(lecturerId: string, id: string) {
    const s = await this.prisma.courseSection.findUnique({
      where: { id },
      include: { course: true, semester: true, students: { include: { student: true }, orderBy: { student: { studentCode: 'asc' } } } },
    });
    if (!s) throw notFound('Lớp học phần');
    if (s.lecturerId !== lecturerId) throw forbidden('Bạn không phụ trách lớp học phần này');
    return s;
  }

  private async loadJob(jobId: string, type: ImportType, where: { assignmentId?: string; sectionId?: string }, onlyValid: boolean) {
    const job = await this.prisma.importJob.findFirst({ where: { id: jobId, type, ...where } });
    if (!job) throw notFound('Bản xem trước');
    if (job.status !== 'PREVIEW' || Date.now() - job.createdAt.getTime() > IMPORT_JOB_TTL_MS)
      throw new AppException('IMPORT_JOB_EXPIRED', 'Bản xem trước đã hết hạn, hãy tải file lên lại', HttpStatus.GONE);
    if (job.errorRows && !onlyValid)
      throw new AppException('VALIDATION_ERROR', `File còn ${job.errorRows} dòng lỗi. Sửa file hoặc chọn "Chỉ áp dụng dòng hợp lệ".`, HttpStatus.UNPROCESSABLE_ENTITY);
    return job;
  }

  private async importHistory(where: Prisma.ImportJobWhereInput) {
    const jobs = await this.prisma.importJob.findMany({
      where: { ...where, status: 'COMPLETED' },
      include: { createdBy: { include: { lecturer: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    return jobs.map((j) => ({ id: j.id, fileName: j.fileName, totalRows: j.totalRows, errorRows: j.errorRows, by: j.createdBy.lecturer?.fullName ?? j.createdBy.username, completedAt: j.completedAt }));
  }

  /** Kiểm tra MSSV từng dòng: thuộc LHP, không lặp. */
  private matchStudents<T extends { row: number; values: Record<string, string> }>(rows: T[], students: { id: string; studentCode: string; fullName: string }[], sectionCode: string) {
    const byCode = new Map(students.map((s) => [s.studentCode.toUpperCase(), s]));
    const seen = new Map<string, number>();
    const errors: RowError[] = [];
    const ok: { row: T; student: { id: string; studentCode: string; fullName: string } }[] = [];
    for (const r of rows) {
      const code = normCode(r.values.code ?? '');
      if (!code) {
        errors.push({ row: r.row, message: 'Thiếu MSSV' });
        continue;
      }
      const st = byCode.get(code);
      if (!st) {
        errors.push({ row: r.row, studentCode: code, message: `MSSV ${code} không thuộc lớp ${sectionCode}` });
        continue;
      }
      if (seen.has(code)) {
        errors.push({ row: r.row, studentCode: code, message: `MSSV ${code} lặp lại (đã có ở dòng ${seen.get(code)})` });
        continue;
      }
      seen.set(code, r.row);
      ok.push({ row: r, student: st });
    }
    const missing = students.filter((s) => !seen.has(s.studentCode.toUpperCase())).map((s) => ({ studentCode: s.studentCode, fullName: s.fullName }));
    return { errors, ok, missing };
  }

  private histogram(scores: number[]) {
    const bins: [string, number, number][] = [['<4', 0, 4], ['4–5', 4, 5], ['5–6', 5, 6], ['6–7', 6, 7], ['7–8', 7, 8], ['8–9', 8, 9], ['9–10', 9, 10.01]];
    return bins.map(([label, from, to]) => ({ label, count: scores.filter((x) => x >= from && x < to).length }));
  }

  // ================================================================ điểm bài tập (UC07.1, 7.2, 7.4, 7.6)

  async assignmentGrades(lecturerId: string, assignmentId: string) {
    const a = await this.ownAssignment(lecturerId, assignmentId);
    const [grades, members, topics, imports] = await Promise.all([
      this.prisma.assignmentGrade.findMany({ where: { assignmentId: a.id } }),
      this.prisma.groupMember.findMany({ where: { assignmentId: a.id }, include: { group: { include: { topic: true } } } }),
      this.prisma.topic.findMany({ where: { assignmentId: a.id, studentId: { not: null } } }),
      this.importHistory({ assignmentId: a.id, type: 'ASSIGNMENT_GRADES' }),
    ]);
    const rows = a.section.students.map(({ student: s }) => {
      const g = grades.find((x) => x.studentId === s.id);
      const m = members.find((x) => x.studentId === s.id);
      return {
        studentId: s.id,
        studentCode: s.studentCode,
        fullName: s.fullName,
        group: m ? m.group.code : null,
        topic: m ? (m.group.topic?.title ?? null) : (topics.find((t) => t.studentId === s.id)?.title ?? null),
        score: num(g?.score),
        note: g?.note ?? null,
        updatedAt: g?.updatedAt ?? null,
      };
    });
    const scores = rows.map((r) => r.score).filter((x): x is number => x != null);
    return {
      publishedAt: a.gradesPublishedAt,
      rows,
      stats: {
        students: rows.length,
        graded: scores.length,
        avg: scores.length ? round1(scores.reduce((x, y) => x + y, 0) / scores.length) : null,
        max: scores.length ? Math.max(...scores) : null,
        min: scores.length ? Math.min(...scores) : null,
        histogram: this.histogram(scores),
      },
      imports,
    };
  }

  async assignmentTemplate(lecturerId: string, assignmentId: string) {
    const a = await this.ownAssignment(lecturerId, assignmentId);
    const data = await this.assignmentGrades(lecturerId, assignmentId);
    const cols = a.workMode === 'GROUP' ? ASSIGNMENT_COLUMNS : ASSIGNMENT_COLUMNS.filter((c) => c.key !== 'group');
    const rows = data.rows
      .sort((x, y) => (x.group ?? '').localeCompare(y.group ?? '', 'vi', { numeric: true }) || x.studentCode.localeCompare(y.studentCode))
      .map((r) => {
        const base = [r.studentCode, r.fullName, ...(a.workMode === 'GROUP' ? [r.group ?? ''] : []), r.topic ?? '', r.score, r.note ?? ''];
        return base;
      });
    const buffer = await buildSheet('Diem', cols, rows, [
      'Mỗi dòng là một sinh viên (đã điền sẵn). Chỉ cần điền cột "Điểm" và "Nhận xét".',
      'Điểm thang 10, tối đa 1 chữ số thập phân (dùng dấu phẩy hoặc chấm). Để trống = chưa có điểm.',
      'Bài nhóm: điểm ghi theo từng sinh viên – điền cùng một điểm cho cả nhóm nếu muốn.',
      'Nhận xét tối đa 1000 ký tự. Không đổi tên các cột.',
    ]);
    return { buffer, fileName: `Diem_${a.section.code}_${a.title.slice(0, 40)}.xlsx`.replace(/[\\/:*?"<>|]/g, '_') };
  }

  async assignmentPreview(lecturerId: string, userId: string, assignmentId: string, file: Express.Multer.File) {
    const a = await this.ownAssignment(lecturerId, assignmentId);
    const rows = await readSheet(file, ASSIGNMENT_COLUMNS);
    const { errors, ok, missing } = this.matchStudents(rows, a.section.students.map((x) => x.student), a.section.code);
    const grades = await this.prisma.assignmentGrade.findMany({ where: { assignmentId: a.id } });
    const plan: AssignmentGradeRow[] = [];
    for (const { row, student } of ok) {
      const sc = parseScore(row.values.score ?? '');
      const note = (row.values.note ?? '').trim() || null;
      if (sc.error) errors.push({ row: row.row, studentCode: student.studentCode, message: sc.error });
      else if (note && note.length > 1000) errors.push({ row: row.row, studentCode: student.studentCode, message: 'Nhận xét quá 1000 ký tự' });
      else {
        const old = grades.find((g) => g.studentId === student.id);
        const oldScore = num(old?.score);
        plan.push({
          studentId: student.id,
          studentCode: student.studentCode,
          fullName: student.fullName,
          oldScore,
          oldNote: old?.note ?? null,
          score: sc.value,
          note,
          changed: oldScore !== sc.value || (old?.note ?? null) !== note,
        });
      }
    }
    errors.sort((x, y) => x.row - y.row);
    const job = await this.prisma.importJob.create({
      data: {
        type: 'ASSIGNMENT_GRADES',
        assignmentId: a.id,
        sectionId: a.sectionId,
        fileName: file.originalname,
        totalRows: rows.length,
        errorRows: new Set(errors.map((e) => e.row)).size,
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
      withScore: plan.filter((r) => r.score != null).length,
      empty: plan.filter((r) => r.score == null).length,
      changed: plan.filter((r) => r.changed).length,
      rows: plan,
      missing,
      errors,
    };
  }

  async assignmentCommit(lecturerId: string, userId: string, assignmentId: string, jobId: string, onlyValid = false) {
    const a = await this.ownAssignment(lecturerId, assignmentId);
    const job = await this.loadJob(jobId, 'ASSIGNMENT_GRADES', { assignmentId: a.id }, onlyValid);
    const plan = job.preview as unknown as AssignmentGradeRow[];
    await this.prisma.$transaction(
      async (tx) => {
        for (const r of plan) {
          if (!r.changed) continue;
          await tx.assignmentGrade.upsert({
            where: { assignmentId_studentId: { assignmentId: a.id, studentId: r.studentId } },
            create: { assignmentId: a.id, studentId: r.studentId, score: r.score, note: r.note, importJobId: job.id, updatedById: userId },
            update: { score: r.score, note: r.note, importJobId: job.id, updatedById: userId },
          });
        }
        await tx.importJob.update({ where: { id: job.id }, data: { status: 'COMPLETED', completedAt: new Date() } });
        await tx.importJob.updateMany({ where: { assignmentId: a.id, type: 'ASSIGNMENT_GRADES', status: 'PREVIEW' }, data: { status: 'CANCELLED' } });
      },
      { timeout: 60_000 },
    );
    const changed = plan.filter((r) => r.changed);
    if (a.gradesPublishedAt && changed.length) {
      const users = new Map(a.section.students.map((x) => [x.student.id, x.student.userId]));
      await this.notifications.notify(changed.map((r) => users.get(r.studentId)!), {
        type: 'ASSIGNMENT_GRADE_UPDATED',
        title: `Điểm bài tập được cập nhật: ${a.title}`,
        body: a.section.code,
        link: `/student/assignments/${a.id}`,
      });
    }
    await this.audit.log({
      actorId: userId,
      action: 'IMPORT_GRADES',
      entityType: 'assignment',
      entityId: a.id,
      summary: `Tải điểm từ ${job.fileName}: ${changed.length} SV thay đổi${job.errorRows ? `, bỏ qua ${job.errorRows} dòng lỗi` : ''}`,
    });
    return this.assignmentGrades(lecturerId, a.id);
  }

  async assignmentPublish(lecturerId: string, userId: string, assignmentId: string) {
    const a = await this.ownAssignment(lecturerId, assignmentId);
    const graded = await this.prisma.assignmentGrade.findMany({ where: { assignmentId: a.id, score: { not: null } } });
    if (!graded.length) throw new AppException('VALIDATION_ERROR', 'Chưa có điểm nào để công bố — hãy tải lên file điểm', HttpStatus.CONFLICT);
    await this.prisma.assignment.update({ where: { id: a.id }, data: { gradesPublishedAt: new Date() } });
    const users = new Map(a.section.students.map((x) => [x.student.id, x.student.userId]));
    await this.notifications.notify(graded.map((g) => users.get(g.studentId)!).filter(Boolean), {
      type: 'ASSIGNMENT_GRADES_PUBLISHED',
      title: `Đã có điểm: ${a.title}`,
      body: a.section.code,
      link: `/student/assignments/${a.id}`,
    });
    await this.audit.log({ actorId: userId, action: 'PUBLISH_GRADES', entityType: 'assignment', entityId: a.id, summary: `Công bố điểm cho ${graded.length} sinh viên` });
    return this.assignmentGrades(lecturerId, a.id);
  }

  // ================================================================ điểm học phần (UC07.3, 7.5, 7.6)

  async gradebooks(lecturerId: string) {
    const sections = await this.prisma.courseSection.findMany({
      where: { lecturerId },
      include: { course: true, semester: true, _count: { select: { students: true, grades: true } } },
      orderBy: [{ semester: { startDate: 'desc' } }, { code: 'asc' }],
    });
    const assignmentGrades = await this.prisma.assignmentGrade.groupBy({
      by: ['assignmentId'],
      where: { assignment: { sectionId: { in: sections.map((s) => s.id) }, deletedAt: null }, score: { not: null } },
      _count: true,
    });
    const assignments = await this.prisma.assignment.findMany({ where: { sectionId: { in: sections.map((s) => s.id) }, deletedAt: null }, select: { id: true, sectionId: true } });
    return sections.map((s) => {
      const ids = new Set(assignments.filter((a) => a.sectionId === s.id).map((a) => a.id));
      const hasAssignmentGrades = assignmentGrades.some((g) => ids.has(g.assignmentId));
      return {
        id: s.id,
        code: s.code,
        course: { code: s.course.code, name: s.course.name, credits: s.course.credits },
        semester: { code: s.semester.code, academicYear: s.semester.academicYear, term: s.semester.term, isCurrent: s.semester.isCurrent },
        students: s._count.students,
        graded: s._count.grades,
        status: s.gradesPublishedAt ? 'PUBLISHED' : s._count.grades || hasAssignmentGrades ? 'DRAFT' : 'EMPTY',
        publishedAt: s.gradesPublishedAt,
      };
    });
  }

  /** Điểm "Bài tập" gợi ý = Σ(điểm × trọng số)/Σ trọng số của các bài đã có điểm. */
  private suggestAssignment(assignments: { id: string; weight: number }[], grades: { assignmentId: string; studentId: string; score: Prisma.Decimal | null }[], studentId: string) {
    let sum = 0;
    let w = 0;
    for (const a of assignments) {
      const g = grades.find((x) => x.assignmentId === a.id && x.studentId === studentId && x.score != null);
      if (!g) continue;
      sum += Number(g.score) * a.weight;
      w += a.weight;
    }
    return w ? round1(sum / w) : null;
  }

  private totalOf(values: Record<Comp, number | null>, weights: Record<Comp, number>) {
    if (COMPS.some((c) => values[c] == null)) return null;
    return round1(COMPS.reduce((n, c) => n + values[c]! * weights[c], 0) / 100);
  }

  private weightsOf(course: { wAttendance: number; wAssignment: number; wMidterm: number; wFinal: number }): Record<Comp, number> {
    return { attendance: course.wAttendance, assignment: course.wAssignment, midterm: course.wMidterm, final: course.wFinal };
  }

  async sectionGrades(lecturerId: string, sectionId: string) {
    const s = await this.ownSection(lecturerId, sectionId);
    const [assignments, aGrades, sGrades, imports] = await Promise.all([
      this.prisma.assignment.findMany({ where: { sectionId, deletedAt: null, status: { not: 'DRAFT' } }, orderBy: { openAt: 'asc' } }),
      this.prisma.assignmentGrade.findMany({ where: { assignment: { sectionId, deletedAt: null } } }),
      this.prisma.sectionGrade.findMany({ where: { sectionId } }),
      this.importHistory({ sectionId, type: 'SECTION_GRADES' }),
    ]);
    const weights = this.weightsOf(s.course);
    const rows = s.students.map(({ student: st }) => {
      const g = sGrades.find((x) => x.studentId === st.id);
      return {
        studentId: st.id,
        studentCode: st.studentCode,
        fullName: st.fullName,
        assignments: assignments.map((a) => num(aGrades.find((x) => x.assignmentId === a.id && x.studentId === st.id)?.score)),
        suggestedAssignment: this.suggestAssignment(assignments, aGrades, st.id),
        attendance: num(g?.attendance),
        assignment: num(g?.assignment),
        midterm: num(g?.midterm),
        final: num(g?.final),
        total: num(g?.total),
        letter: g?.letter ?? null,
        gpa4: num(g?.gpa4),
      };
    });
    const totals = rows.map((r) => r.total).filter((x): x is number => x != null);
    return {
      section: {
        id: s.id,
        code: s.code,
        course: { code: s.course.code, name: s.course.name, credits: s.course.credits, type: s.course.courseType },
        semester: { code: s.semester.code, academicYear: s.semester.academicYear, term: s.semester.term },
        publishedAt: s.gradesPublishedAt,
      },
      weights,
      assignments: assignments.map((a) => ({ id: a.id, title: a.title, weight: a.weight, publishedAt: a.gradesPublishedAt })),
      rows,
      stats: {
        students: rows.length,
        complete: rows.filter((r) => r.total != null).length,
        avg: totals.length ? round1(totals.reduce((x, y) => x + y, 0) / totals.length) : null,
        failing: totals.filter((x) => x < 4).length,
        histogram: this.histogram(totals),
      },
      imports,
    };
  }

  async sectionTemplate(lecturerId: string, sectionId: string) {
    const data = await this.sectionGrades(lecturerId, sectionId);
    const rows = data.rows.map((r) => [r.studentCode, r.fullName, r.attendance, r.assignment ?? r.suggestedAssignment, r.midterm, r.final]);
    const w = data.weights;
    const buffer = await buildSheet('Diem_hoc_phan', SECTION_COLUMNS, rows, [
      `Trọng số môn ${data.section.course.name}: Chuyên cần ${w.attendance}% · Bài tập ${w.assignment}% · Giữa kỳ ${w.midterm}% · Cuối kỳ ${w.final}%.`,
      'Cột "Bài tập" đã điền sẵn từ điểm các bài tập đã tải lên (trung bình theo trọng số bài) – sửa được.',
      'Điểm thang 10, tối đa 1 chữ số thập phân (dấu phẩy hoặc chấm). Để trống = chưa có điểm.',
      'Hệ thống tự tính tổng kết, điểm chữ, hệ 4 khi đủ 4 thành phần. Không đổi tên các cột.',
    ]);
    return { buffer, fileName: `DiemHocPhan_${data.section.code}.xlsx` };
  }

  async sectionPreview(lecturerId: string, userId: string, sectionId: string, file: Express.Multer.File) {
    const s = await this.ownSection(lecturerId, sectionId);
    if (s.gradesPublishedAt) throw new AppException('GRADES_LOCKED', 'Bảng điểm đã công bố, không tải lên lại được', HttpStatus.CONFLICT);
    const rows = await readSheet(file, SECTION_COLUMNS);
    const { errors, ok, missing } = this.matchStudents(rows, s.students.map((x) => x.student), s.code);
    const existing = await this.prisma.sectionGrade.findMany({ where: { sectionId } });
    const weights = this.weightsOf(s.course);
    const plan: SectionGradeRow[] = [];
    for (const { row, student } of ok) {
      const values = {} as Record<Comp, number | null>;
      let bad = false;
      for (const c of COMPS) {
        const p = parseScore(row.values[c] ?? '');
        if (p.error) {
          errors.push({ row: row.row, studentCode: student.studentCode, message: `${SECTION_COLUMNS.find((x) => x.key === c)!.header}: ${p.error}` });
          bad = true;
        }
        values[c] = p.value;
      }
      if (bad) continue;
      const g = existing.find((x) => x.studentId === student.id);
      const old = { attendance: num(g?.attendance), assignment: num(g?.assignment), midterm: num(g?.midterm), final: num(g?.final) };
      const total = this.totalOf(values, weights);
      plan.push({
        studentId: student.id,
        studentCode: student.studentCode,
        fullName: student.fullName,
        old,
        values,
        total,
        letter: total == null ? null : (await this.config.letter(total)).letter,
        changed: COMPS.some((c) => old[c] !== values[c]),
      });
    }
    errors.sort((x, y) => x.row - y.row);
    const job = await this.prisma.importJob.create({
      data: {
        type: 'SECTION_GRADES',
        sectionId,
        fileName: file.originalname,
        totalRows: rows.length,
        errorRows: new Set(errors.map((e) => e.row)).size,
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
      complete: plan.filter((r) => r.total != null).length,
      incomplete: plan.filter((r) => r.total == null).length,
      changed: plan.filter((r) => r.changed).length,
      rows: plan,
      missing,
      errors,
    };
  }

  async sectionCommit(lecturerId: string, userId: string, sectionId: string, jobId: string, onlyValid = false) {
    const s = await this.ownSection(lecturerId, sectionId);
    if (s.gradesPublishedAt) throw new AppException('GRADES_LOCKED', 'Bảng điểm đã công bố, không tải lên lại được', HttpStatus.CONFLICT);
    const job = await this.loadJob(jobId, 'SECTION_GRADES', { sectionId }, onlyValid);
    const plan = job.preview as unknown as SectionGradeRow[];
    await this.prisma.$transaction(
      async (tx) => {
        for (const r of plan) {
          const lg = r.total == null ? null : await this.config.letter(r.total);
          const data = { ...r.values, total: r.total, letter: lg?.letter ?? null, gpa4: lg?.gpa4 ?? null, importJobId: job.id, updatedById: userId };
          await tx.sectionGrade.upsert({ where: { sectionId_studentId: { sectionId, studentId: r.studentId } }, create: { sectionId, studentId: r.studentId, ...data }, update: data });
        }
        await tx.importJob.update({ where: { id: job.id }, data: { status: 'COMPLETED', completedAt: new Date() } });
        await tx.importJob.updateMany({ where: { sectionId, type: 'SECTION_GRADES', status: 'PREVIEW' }, data: { status: 'CANCELLED' } });
      },
      { timeout: 60_000 },
    );
    await this.audit.log({ actorId: userId, action: 'IMPORT_GRADES', entityType: 'section', entityId: sectionId, summary: `Tải điểm học phần từ ${job.fileName}: ${plan.length} SV` });
    return this.sectionGrades(lecturerId, sectionId);
  }

  async sectionPublish(lecturerId: string, userId: string, sectionId: string, allowIncomplete = false) {
    const s = await this.ownSection(lecturerId, sectionId);
    if (s.gradesPublishedAt) throw new AppException('GRADES_LOCKED', 'Bảng điểm đã công bố', HttpStatus.CONFLICT);
    const grades = await this.prisma.sectionGrade.findMany({ where: { sectionId } });
    const incomplete = s.students.filter((x) => grades.find((g) => g.studentId === x.studentId)?.total == null);
    if (incomplete.length === s.students.length) throw new AppException('VALIDATION_ERROR', 'Chưa có điểm học phần — hãy tải lên file điểm', HttpStatus.CONFLICT);
    if (incomplete.length && !allowIncomplete)
      throw new AppException('VALIDATION_ERROR', `${incomplete.length} sinh viên chưa đủ 4 thành phần điểm`, HttpStatus.CONFLICT, {
        students: incomplete.map((x) => x.student.studentCode),
      });
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.courseSection.update({ where: { id: sectionId }, data: { gradesPublishedAt: now } }),
      this.prisma.sectionGrade.updateMany({ where: { sectionId }, data: { status: 'PUBLISHED' } }),
    ]);
    await this.notifications.notify(s.students.map((x) => x.student.userId), {
      type: 'GRADES_PUBLISHED',
      title: `Đã công bố điểm học phần ${s.course.name}`,
      body: s.code,
      link: '/student/grades',
    });
    await this.audit.log({ actorId: userId, action: 'PUBLISH_GRADES', entityType: 'section', entityId: sectionId, summary: `Công bố điểm học phần (${s.students.length - incomplete.length}/${s.students.length} SV đủ điểm)` });
    return this.sectionGrades(lecturerId, sectionId);
  }

  // ================================================================ SV xem điểm (UC07.9)

  async myGrades(studentId: string) {
    const [sectionGrades, assignmentGrades] = await Promise.all([
      this.prisma.sectionGrade.findMany({
        where: { studentId, status: 'PUBLISHED' },
        include: { section: { include: { course: true, semester: true } } },
      }),
      this.prisma.assignmentGrade.findMany({
        where: { studentId, assignment: { gradesPublishedAt: { not: null }, deletedAt: null } },
        include: { assignment: { include: { section: { include: { course: true, semester: true } } } } },
        orderBy: { assignment: { dueAt: 'desc' } },
      }),
    ]);
    const courseRows = sectionGrades.map((g) => ({
      sectionId: g.sectionId,
      sectionCode: g.section.code,
      course: { code: g.section.course.code, name: g.section.course.name, credits: g.section.course.credits },
      attendance: num(g.attendance),
      assignment: num(g.assignment),
      midterm: num(g.midterm),
      final: num(g.final),
      total: num(g.total),
      letter: g.letter,
      gpa4: num(g.gpa4),
      semesterId: g.section.semesterId,
    }));
    const semesters = new Map<string, { code: string; academicYear: string; term: string; startDate: Date; courses: typeof courseRows }>();
    for (const g of sectionGrades) {
      const sem = g.section.semester;
      if (!semesters.has(sem.id)) semesters.set(sem.id, { code: sem.code, academicYear: sem.academicYear, term: sem.term, startDate: sem.startDate, courses: [] });
    }
    for (const c of courseRows) semesters.get(c.semesterId)!.courses.push(c);
    const gpa = (list: typeof courseRows) => {
      const counted = list.filter((c) => c.gpa4 != null);
      const credits = counted.reduce((n, c) => n + c.course.credits, 0);
      return { gpa: credits ? Math.round((counted.reduce((n, c) => n + c.gpa4! * c.course.credits, 0) / credits) * 100) / 100 : null, credits };
    };
    // CPA: môn học lại lấy lần điểm cao nhất (BR-16)
    const best = new Map<string, (typeof courseRows)[number]>();
    for (const c of courseRows) if (c.gpa4 != null && (!best.has(c.course.code) || c.gpa4 > best.get(c.course.code)!.gpa4!)) best.set(c.course.code, c);
    const cpa = gpa([...best.values()]);
    const passedCredits = [...best.values()].filter((c) => c.letter !== 'F').reduce((n, c) => n + c.course.credits, 0);
    const rank = cpa.gpa == null ? null : cpa.gpa >= 3.6 ? 'Xuất sắc' : cpa.gpa >= 3.2 ? 'Giỏi' : cpa.gpa >= 2.5 ? 'Khá' : cpa.gpa >= 2 ? 'Trung bình' : 'Yếu';
    return {
      cpa: cpa.gpa,
      credits: passedCredits,
      rank,
      terms: [...semesters.values()]
        .sort((x, y) => y.startDate.getTime() - x.startDate.getTime())
        .map((t) => ({ code: t.code, academicYear: t.academicYear, term: t.term, ...gpa(t.courses), courses: t.courses.map(({ semesterId: _s, ...c }) => c) })),
      assignments: assignmentGrades.map((g) => ({
        assignmentId: g.assignmentId,
        title: g.assignment.title,
        course: g.assignment.section.course.name,
        sectionCode: g.assignment.section.code,
        semester: g.assignment.section.semester.code,
        weight: g.assignment.weight,
        score: num(g.score),
        note: g.note,
        publishedAt: g.assignment.gradesPublishedAt,
      })),
    };
  }

  // ================================================================ xuất Excel bảng điểm (FR-07.05)

  async sectionExport(lecturerId: string, sectionId: string) {
    const d = await this.sectionGrades(lecturerId, sectionId);
    const cols: SheetColumn[] = [
      { key: 'code', header: 'MSSV', width: 12 },
      { key: 'name', header: 'Họ tên', width: 26 },
      ...d.assignments.map((a, i) => ({ key: `a${i}`, header: `BT${i + 1} (${a.weight}%)`, width: 12 })),
      { key: 'cc', header: `Chuyên cần (${d.weights.attendance}%)`, width: 14 },
      { key: 'bt', header: `Bài tập (${d.weights.assignment}%)`, width: 14 },
      { key: 'gk', header: `Giữa kỳ (${d.weights.midterm}%)`, width: 14 },
      { key: 'ck', header: `Cuối kỳ (${d.weights.final}%)`, width: 14 },
      { key: 'tk', header: 'Tổng kết', width: 10 },
      { key: 'ch', header: 'Điểm chữ', width: 10 },
      { key: 'h4', header: 'Hệ 4', width: 8 },
    ];
    const rows = d.rows.map((r) => [r.studentCode, r.fullName, ...r.assignments, r.attendance, r.assignment, r.midterm, r.final, r.total, r.letter, r.gpa4]);
    const buffer = await buildSheet('Bang_diem', cols, rows, [
      `Bảng điểm ${d.section.code} · ${d.section.course.name} · ${d.section.semester.code}`,
      d.section.publishedAt ? `Đã công bố ${d.section.publishedAt.toLocaleDateString('vi-VN')}` : 'Chưa công bố',
      ...d.assignments.map((a, i) => `BT${i + 1}: ${a.title}`),
    ]);
    return { buffer, fileName: `BangDiem_${d.section.code}.xlsx` };
  }

  // ================================================================ yêu cầu sửa điểm sau khóa (UC07.7 – UC07.8)

  async createGradeRequest(lecturerId: string, userId: string, sectionId: string, dto: { studentId: string; values: Partial<Record<Comp, number | null>>; reason: string }) {
    const s = await this.ownSection(lecturerId, sectionId);
    if (!s.gradesPublishedAt) throw new AppException('VALIDATION_ERROR', 'Bảng điểm chưa công bố – hãy tải lên lại file điểm', HttpStatus.CONFLICT);
    if (!s.students.some((x) => x.studentId === dto.studentId)) throw notFound('Sinh viên');
    const pending = await this.prisma.gradeChangeRequest.findFirst({ where: { sectionId, studentId: dto.studentId, status: 'PENDING' } });
    if (pending) throw new AppException('GRADE_REQUEST_PENDING_EXISTS', 'Sinh viên này đã có yêu cầu đang chờ duyệt', HttpStatus.CONFLICT);
    const g = await this.prisma.sectionGrade.findUnique({ where: { sectionId_studentId: { sectionId, studentId: dto.studentId } } });
    const oldValues: Record<string, number | null> = {};
    const newValues: Record<string, number | null> = {};
    for (const c of COMPS) {
      if (!(c in dto.values)) continue;
      const before = num(g?.[c]);
      const after = dto.values[c] == null ? null : round1(dto.values[c]!);
      if (before !== after) {
        oldValues[c] = before;
        newValues[c] = after;
      }
    }
    if (!Object.keys(newValues).length) throw new AppException('VALIDATION_ERROR', 'Điểm mới giống điểm hiện tại', HttpStatus.BAD_REQUEST);
    const r = await this.prisma.gradeChangeRequest.create({ data: { sectionId, studentId: dto.studentId, lecturerId, oldValues, newValues, reason: dto.reason } });
    const admins = await this.prisma.user.findMany({ where: { role: 'ADMIN', status: 'ACTIVE' }, select: { id: true } });
    const st = s.students.find((x) => x.studentId === dto.studentId)!.student;
    await this.notifications.notify(admins.map((a) => a.id), { type: 'GRADE_CHANGE_REQUESTED', title: `Yêu cầu sửa điểm ${st.studentCode} · ${s.code}`, body: dto.reason.slice(0, 160), link: '/admin/grade-requests' });
    await this.audit.log({ actorId: userId, action: 'GRADE_REQUEST', entityType: 'section', entityId: sectionId, summary: `Yêu cầu sửa điểm ${st.studentCode}` });
    return r;
  }

  async gradeRequests(lecturerId: string, sectionId: string) {
    await this.ownSection(lecturerId, sectionId);
    const list = await this.prisma.gradeChangeRequest.findMany({ where: { sectionId }, include: { student: true }, orderBy: { createdAt: 'desc' } });
    return list.map((r) => ({
      id: r.id,
      student: { id: r.studentId, studentCode: r.student.studentCode, fullName: r.student.fullName },
      oldValues: r.oldValues,
      newValues: r.newValues,
      reason: r.reason,
      status: r.status,
      adminNote: r.adminNote,
      createdAt: r.createdAt,
      resolvedAt: r.resolvedAt,
    }));
  }

  async cancelGradeRequest(lecturerId: string, requestId: string) {
    const r = await this.prisma.gradeChangeRequest.findUnique({ where: { id: requestId } });
    if (!r || r.lecturerId !== lecturerId) throw notFound('Yêu cầu');
    if (r.status !== 'PENDING') throw new AppException('CONFLICT', 'Yêu cầu đã được xử lý', HttpStatus.CONFLICT);
    await this.prisma.gradeChangeRequest.update({ where: { id: requestId }, data: { status: 'CANCELLED', resolvedAt: new Date() } });
    return { ok: true };
  }

  /** Admin: danh sách chờ duyệt. */
  async adminGradeRequests(status?: string) {
    const list = await this.prisma.gradeChangeRequest.findMany({
      where: status ? { status: status as never } : {},
      include: { student: true, lecturer: true, section: { include: { course: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return list.map((r) => ({ ...r, student: { studentCode: r.student.studentCode, fullName: r.student.fullName }, lecturer: { code: r.lecturer.code, fullName: r.lecturer.fullName }, section: { code: r.section.code, course: r.section.course.name } }));
  }

  /** Admin duyệt: kiểm tra điểm cũ còn khớp → áp dụng, tính lại tổng kết, báo GV + SV. */
  async resolveGradeRequest(userId: string, requestId: string, approve: boolean, note?: string) {
    const r = await this.prisma.gradeChangeRequest.findUnique({ where: { id: requestId }, include: { section: { include: { course: true } }, student: true, lecturer: true } });
    if (!r) throw notFound('Yêu cầu');
    if (r.status !== 'PENDING') throw new AppException('CONFLICT', 'Yêu cầu đã được xử lý', HttpStatus.CONFLICT);
    if (!approve && !note?.trim()) throw new AppException('VALIDATION_ERROR', 'Nhập lý do từ chối', HttpStatus.BAD_REQUEST);
    if (approve) {
      const g = await this.prisma.sectionGrade.findUnique({ where: { sectionId_studentId: { sectionId: r.sectionId, studentId: r.studentId } } });
      const oldV = r.oldValues as Record<Comp, number | null>;
      const newV = r.newValues as Record<Comp, number | null>;
      for (const c of Object.keys(oldV) as Comp[])
        if (num(g?.[c]) !== oldV[c]) throw new AppException('CONFLICT', 'Điểm hiện tại đã thay đổi so với lúc gửi yêu cầu', HttpStatus.CONFLICT);
      const values = Object.fromEntries(COMPS.map((c) => [c, c in newV ? newV[c] : num(g?.[c])])) as Record<Comp, number | null>;
      const total = this.totalOf(values, this.weightsOf(r.section.course));
      const lg = total == null ? null : await this.config.letter(total);
      await this.prisma.sectionGrade.upsert({
        where: { sectionId_studentId: { sectionId: r.sectionId, studentId: r.studentId } },
        create: { sectionId: r.sectionId, studentId: r.studentId, ...values, total, letter: lg?.letter ?? null, gpa4: lg?.gpa4 ?? null, status: 'PUBLISHED', updatedById: userId },
        update: { ...values, total, letter: lg?.letter ?? null, gpa4: lg?.gpa4 ?? null, updatedById: userId },
      });
    }
    await this.prisma.gradeChangeRequest.update({ where: { id: r.id }, data: { status: approve ? 'APPROVED' : 'REJECTED', adminNote: note?.trim() || null, resolvedById: userId, resolvedAt: new Date() } });
    const lecturerUser = await this.prisma.lecturer.findUniqueOrThrow({ where: { id: r.lecturerId }, select: { userId: true } });
    await this.notifications.notify([lecturerUser.userId], { type: 'GRADE_REQUEST_RESOLVED', title: `${approve ? 'Đã duyệt' : 'Từ chối'} yêu cầu sửa điểm ${r.student.studentCode}`, body: note ?? r.section.code, link: `/lecturer/gradebook/${r.sectionId}` });
    if (approve)
      await this.notifications.notify([r.student.userId], { type: 'GRADES_PUBLISHED', title: `Điểm học phần ${r.section.course.name} đã được cập nhật`, body: r.section.code, link: '/student/grades' });
    await this.audit.log({ actorId: userId, action: approve ? 'GRADE_CHANGED' : 'GRADE_REQUEST_REJECTED', entityType: 'section', entityId: r.sectionId, summary: `${approve ? 'Duyệt' : 'Từ chối'} sửa điểm ${r.student.studentCode}` });
    return { ok: true };
  }

  // ================================================================ thống kê cá nhân SV (UC10.4)

  async myStats(studentId: string) {
    const enroll = await this.prisma.sectionStudent.findMany({ where: { studentId }, select: { sectionId: true } });
    const assignments = await this.prisma.assignment.findMany({
      where: { sectionId: { in: enroll.map((e) => e.sectionId) }, deletedAt: null, status: { not: 'DRAFT' } },
      include: { section: { include: { course: true } } },
    });
    const ids = assignments.map((a) => a.id);
    const [members, personal, grades, topics] = await Promise.all([
      this.prisma.groupMember.findMany({ where: { studentId, assignmentId: { in: ids } }, include: { group: { include: { submissions: { where: { kind: 'GROUP_SHARED' } }, topic: true } } } }),
      this.prisma.submission.findMany({ where: { studentId, kind: 'PERSONAL', assignmentId: { in: ids } } }),
      this.prisma.assignmentGrade.findMany({ where: { studentId, assignmentId: { in: ids }, assignment: { gradesPublishedAt: { not: null } } } }),
      this.prisma.topic.findMany({ where: { studentId, assignmentId: { in: ids } } }),
    ]);
    const now = new Date();
    let onTime = 0;
    let late = 0;
    let missed = 0;
    let pending = 0;
    const keywords = new Map<string, { label: string; n: number }>();
    for (const a of assignments) {
      const m = members.find((x) => x.assignmentId === a.id);
      const sub = m ? m.group.submissions[0] : personal.find((p) => p.assignmentId === a.id);
      const topic = m ? m.group.topic : topics.find((t) => t.assignmentId === a.id);
      for (const k of strs(topic?.keywords)) {
        const key = k.trim().toLowerCase();
        const c = keywords.get(key) ?? { label: k.trim(), n: 0 };
        c.n++;
        keywords.set(key, c);
      }
      if (sub) sub.isLate ? late++ : onTime++;
      else if ((a.allowLate && a.lateDueAt ? a.lateDueAt : a.dueAt) < now) missed++;
      else pending++;
    }
    const scores = grades.map((g) => num(g.score)).filter((x): x is number => x != null);
    const byCourse = new Map<string, number[]>();
    for (const g of grades) {
      const a = assignments.find((x) => x.id === g.assignmentId)!;
      if (g.score == null) continue;
      byCourse.set(a.section.course.name, [...(byCourse.get(a.section.course.name) ?? []), Number(g.score)]);
    }
    return {
      assignments: assignments.length,
      onTime,
      late,
      missed,
      pending,
      onTimeRate: onTime + late + missed ? Math.round((onTime / (onTime + late + missed)) * 100) : null,
      avgScore: scores.length ? round1(scores.reduce((x, y) => x + y, 0) / scores.length) : null,
      histogram: this.histogram(scores),
      byCourse: [...byCourse.entries()].map(([course, list]) => ({ course, count: list.length, avg: round1(list.reduce((x, y) => x + y, 0) / list.length) })),
      keywords: [...keywords.values()].sort((x, y) => y.n - x.n).slice(0, 8).map((x) => ({ keyword: x.label, count: x.n })),
    };
  }

}
