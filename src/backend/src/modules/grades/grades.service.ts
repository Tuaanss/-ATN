import { HttpStatus, Injectable } from '@nestjs/common';
import { ImportType, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppException, forbidden, notFound } from '../../common/errors/app-exception';
import { AuditService } from '../../common/audit/audit.service';
import { IMPORT_JOB_TTL_MS, RowError, SheetColumn, buildSheet, normCode, parseScore, readSheet } from '../../common/utils/excel';
import { NotificationsService } from '../notifications/notifications.module';
import { strs } from '../../common/utils/json';

const ASSIGNMENT_COLUMNS: SheetColumn[] = [
  { key: 'code', header: 'MSV', width: 14, aliases: ['MSSV', 'Mã SV', 'Mã sinh viên'], required: true },
  { key: 'name', header: 'Họ tên', width: 28, aliases: ['Họ và tên'] },
  { key: 'group', header: 'Nhóm', width: 10 },
  { key: 'topic', header: 'Đề tài', width: 40 },
  { key: 'score', header: 'Điểm', width: 10, required: true },
  { key: 'note', header: 'Nhận xét', width: 50 },
];

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

const num = (d: Prisma.Decimal | null | undefined) => (d == null ? null : Number(d));
const round1 = (n: number) => Math.round(n * 10) / 10;

/** Điểm: GV chấm ngoài hệ thống, tải lên bằng Excel, công bố (UC07). */
@Injectable()
export class GradesService {
  constructor(
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

  /** Kiểm tra MSV từng dòng: thuộc LHP, không lặp. */
  private matchStudents<T extends { row: number; values: Record<string, string> }>(rows: T[], students: { id: string; studentCode: string; fullName: string }[], sectionCode: string) {
    const byCode = new Map(students.map((s) => [s.studentCode.toUpperCase(), s]));
    const seen = new Map<string, number>();
    const errors: RowError[] = [];
    const ok: { row: T; student: { id: string; studentCode: string; fullName: string } }[] = [];
    for (const r of rows) {
      const code = normCode(r.values.code ?? '');
      if (!code) {
        errors.push({ row: r.row, message: 'Thiếu MSV' });
        continue;
      }
      const st = byCode.get(code);
      if (!st) {
        errors.push({ row: r.row, studentCode: code, message: `MSV ${code} không thuộc lớp ${sectionCode}` });
        continue;
      }
      if (seen.has(code)) {
        errors.push({ row: r.row, studentCode: code, message: `MSV ${code} lặp lại (đã có ở dòng ${seen.get(code)})` });
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

  // ================================================================ bảng điểm bài tập theo lớp (so sánh chất lượng các bài)

  async gradebooks(lecturerId: string) {
    const sections = await this.prisma.courseSection.findMany({
      where: { lecturerId },
      include: { course: true, semester: true, _count: { select: { students: true } } },
      orderBy: [{ semester: { startDate: 'desc' } }, { code: 'asc' }],
    });
    const assignments = await this.prisma.assignment.findMany({
      where: { sectionId: { in: sections.map((s) => s.id) }, deletedAt: null, status: { not: 'DRAFT' } },
      select: { id: true, sectionId: true, gradesPublishedAt: true, _count: { select: { grades: { where: { score: { not: null } } } } } },
    });
    return sections.map((s) => {
      const list = assignments.filter((a) => a.sectionId === s.id);
      return {
        id: s.id,
        code: s.code,
        course: { code: s.course.code, name: s.course.name, credits: s.course.credits },
        semester: { code: s.semester.code, academicYear: s.semester.academicYear, term: s.semester.term, isCurrent: s.semester.isCurrent },
        students: s._count.students,
        assignments: list.length,
        gradedAssignments: list.filter((a) => a._count.grades > 0).length,
        publishedAssignments: list.filter((a) => a.gradesPublishedAt).length,
      };
    });
  }

  /** Ma trận SV × bài tập của một lớp + thống kê từng bài để so sánh. Không tính điểm tổng kết. */
  async sectionGrades(lecturerId: string, sectionId: string) {
    const s = await this.ownSection(lecturerId, sectionId);
    const [assignments, aGrades] = await Promise.all([
      this.prisma.assignment.findMany({ where: { sectionId, deletedAt: null, status: { not: 'DRAFT' } }, orderBy: { openAt: 'asc' } }),
      this.prisma.assignmentGrade.findMany({ where: { assignment: { sectionId, deletedAt: null } } }),
    ]);
    const scoreOf = (assignmentId: string, studentId: string) => num(aGrades.find((x) => x.assignmentId === assignmentId && x.studentId === studentId)?.score);
    const rows = s.students.map(({ student: st }) => ({
      studentId: st.id,
      studentCode: st.studentCode,
      fullName: st.fullName,
      assignments: assignments.map((a) => scoreOf(a.id, st.id)),
    }));
    return {
      section: {
        id: s.id,
        code: s.code,
        course: { code: s.course.code, name: s.course.name, credits: s.course.credits },
        semester: { code: s.semester.code, academicYear: s.semester.academicYear, term: s.semester.term },
      },
      assignments: assignments.map((a, i) => {
        const scores = rows.map((r) => r.assignments[i]).filter((x): x is number => x != null);
        return {
          id: a.id,
          title: a.title,
          workMode: a.workMode,
          dueAt: a.dueAt,
          publishedAt: a.gradesPublishedAt,
          graded: scores.length,
          avg: scores.length ? round1(scores.reduce((x, y) => x + y, 0) / scores.length) : null,
          max: scores.length ? Math.max(...scores) : null,
          min: scores.length ? Math.min(...scores) : null,
          histogram: this.histogram(scores),
        };
      }),
      rows,
      stats: { students: rows.length, assignments: assignments.length },
    };
  }

  // ================================================================ SV xem điểm bài tập (UC07.9)

  async myGrades(studentId: string) {
    const grades = await this.prisma.assignmentGrade.findMany({
      where: { studentId, assignment: { gradesPublishedAt: { not: null }, deletedAt: null } },
      include: { assignment: { include: { section: { include: { course: true, semester: true } } } } },
      orderBy: { assignment: { dueAt: 'desc' } },
    });
    const row = (g: (typeof grades)[number]) => ({
      assignmentId: g.assignmentId,
      title: g.assignment.title,
      course: { code: g.assignment.section.course.code, name: g.assignment.section.course.name },
      sectionCode: g.assignment.section.code,
      score: num(g.score),
      note: g.note,
      dueAt: g.assignment.dueAt,
      publishedAt: g.assignment.gradesPublishedAt,
    });
    const terms = new Map<string, { code: string; academicYear: string; term: string; startDate: Date; assignments: ReturnType<typeof row>[] }>();
    for (const g of grades) {
      const sem = g.assignment.section.semester;
      if (!terms.has(sem.id)) terms.set(sem.id, { code: sem.code, academicYear: sem.academicYear, term: sem.term, startDate: sem.startDate, assignments: [] });
      terms.get(sem.id)!.assignments.push(row(g));
    }
    const avg = (list: (number | null)[]) => {
      const xs = list.filter((x): x is number => x != null);
      return xs.length ? round1(xs.reduce((x, y) => x + y, 0) / xs.length) : null;
    };
    return {
      graded: grades.filter((g) => g.score != null).length,
      avg: avg(grades.map((g) => num(g.score))),
      terms: [...terms.values()]
        .sort((x, y) => y.startDate.getTime() - x.startDate.getTime())
        .map(({ startDate: _d, ...t }) => ({ ...t, avg: avg(t.assignments.map((a) => a.score)) })),
    };
  }

  // ================================================================ xuất Excel điểm bài tập của lớp (FR-07.05)

  async sectionExport(lecturerId: string, sectionId: string) {
    const d = await this.sectionGrades(lecturerId, sectionId);
    const cols: SheetColumn[] = [
      { key: 'code', header: 'MSV', width: 12 },
      { key: 'name', header: 'Họ tên', width: 26 },
      ...d.assignments.map((_a, i) => ({ key: `a${i}`, header: `BT${i + 1}`, width: 10 })),
    ];
    const rows = d.rows.map((r) => [r.studentCode, r.fullName, ...r.assignments]);
    const buffer = await buildSheet('Diem_bai_tap', cols, rows, [
      `Điểm bài tập ${d.section.code} · ${d.section.course.name} · ${d.section.semester.code}`,
      ...d.assignments.map((a, i) => `BT${i + 1}: ${a.title} — TB ${a.avg ?? '—'} (${a.graded} SV có điểm)`),
    ]);
    return { buffer, fileName: `DiemBaiTap_${d.section.code}.xlsx` };
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
