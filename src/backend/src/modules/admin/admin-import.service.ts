import { HttpStatus, Injectable } from '@nestjs/common';
import { CourseType } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppException } from '../../common/errors/app-exception';
import { AuditService } from '../../common/audit/audit.service';
import { SheetColumn, buildSheet, normCode, readSheet } from '../../common/utils/excel';
import { AdminUsersService, LecturerInput } from './admin-users.service';
import { AdminAcademicService, CourseInput, SectionInput, Session } from './admin-academic.service';

export type ImportKind = 'lecturers' | 'courses' | 'sections';
export const IMPORT_KINDS: ImportKind[] = ['lecturers', 'courses', 'sections'];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^(03|05|07|08|09)\d{8}$/;
const COURSE_TYPES: Record<string, CourseType> = { thietke: 'DESIGN', design: 'DESIGN', laptrinh: 'PROGRAMMING', programming: 'PROGRAMMING', khac: 'OTHER', other: 'OTHER' };
const plain = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const COLS: Record<ImportKind, SheetColumn[]> = {
  lecturers: [
    { key: 'code', header: 'Mã GV', width: 12, aliases: ['Mã giảng viên'], required: true },
    { key: 'name', header: 'Họ tên', width: 30, aliases: ['Họ và tên'], required: true },
    { key: 'email', header: 'Email', width: 30, required: true },
    { key: 'phone', header: 'SĐT', width: 14, aliases: ['Số điện thoại'] },
    { key: 'faculty', header: 'Mã khoa', width: 12, aliases: ['Khoa'] },
  ],
  courses: [
    { key: 'code', header: 'Mã môn', width: 12, required: true },
    { key: 'name', header: 'Tên môn', width: 34, required: true },
    { key: 'credits', header: 'Tín chỉ', width: 10, aliases: ['Số tín chỉ', 'TC'], required: true },
    { key: 'type', header: 'Loại môn', width: 14, required: true },
    { key: 'faculty', header: 'Mã khoa', width: 12, aliases: ['Khoa'] },
    { key: 'wa', header: 'CC (%)', width: 9, aliases: ['Chuyên cần', 'CC'] },
    { key: 'wb', header: 'BT (%)', width: 9, aliases: ['Bài tập', 'BT'] },
    { key: 'wm', header: 'GK (%)', width: 9, aliases: ['Giữa kỳ', 'GK'] },
    { key: 'wf', header: 'CK (%)', width: 9, aliases: ['Cuối kỳ', 'CK'] },
  ],
  sections: [
    { key: 'code', header: 'Mã lớp HP', width: 14, aliases: ['Mã lớp', 'Mã lớp học phần'], required: true },
    { key: 'course', header: 'Mã môn', width: 12, required: true },
    { key: 'lecturer', header: 'Mã GV', width: 12, aliases: ['Mã giảng viên'], required: true },
    { key: 'max', header: 'Sĩ số tối đa', width: 12, aliases: ['Sĩ số'], required: true },
    { key: 'ws', header: 'Tuần bắt đầu', width: 12, aliases: ['Từ tuần'] },
    { key: 'we', header: 'Tuần kết thúc', width: 12, aliases: ['Đến tuần'] },
    { key: 'schedule', header: 'Lịch học', width: 40, required: true },
  ],
};

/** "T2 1-3 A2-301; T5 6-8 B1-101" → các buổi học. Thứ 2–7, CN; tiết 1–12. */
export function parseSchedule(text: string): Session[] | null {
  const parts = text
    .split(/[;\n]+/)
    .map((x) => x.trim())
    .filter(Boolean);
  if (!parts.length) return null;
  const out: Session[] = [];
  for (const p of parts) {
    const m = p.match(/^(?:(?:t|thứ|thu)\s*([2-7])|(cn|chủ nhật|chu nhat))\s*,?\s*(?:tiết|tiet)?\s*(\d{1,2})\s*[-–]\s*(\d{1,2})\s*[,·]?\s*(?:phòng|phong)?\s*(.*)$/i);
    if (!m) return null;
    const day = m[2] ? 8 : Number(m[1]);
    const from = Number(m[3]);
    const to = Number(m[4]);
    if (from < 1 || to > 12 || to < from) return null;
    out.push({ day, from, to, room: (m[5] ?? '').trim() });
  }
  return out;
}

interface Row {
  row: number;
  ok: boolean;
  problems: string[];
  cells: Record<string, string>;
  /** dữ liệu đã chuẩn hóa để tạo khi áp dụng */
  data?: unknown;
}

/** Import GV, môn học, lớp học phần từ Excel: file mẫu → xem trước, kiểm tra từng dòng → tạo. */
@Injectable()
export class AdminImportService {
  private jobs = new Map<string, { at: number; kind: ImportKind; semesterId?: string; rows: Row[] }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly users: AdminUsersService,
    private readonly academic: AdminAcademicService,
  ) {}

  async template(kind: ImportKind) {
    const [fac, course, lec] = await Promise.all([this.prisma.faculty.findFirst(), this.prisma.course.findFirst(), this.prisma.lecturer.findFirst()]);
    const f = fac?.code ?? 'TKTT';
    const rows: Record<ImportKind, (string | number)[][]> = {
      lecturers: [
        ['GV0100', 'TS. Nguyễn Văn A', 'nguyenvana@truong.edu.vn', '0912345670', f],
        ['GV0101', 'ThS. Trần Thị B', 'tranthib@truong.edu.vn', '', f],
      ],
      courses: [
        ['TK101', 'Thiết kế giao diện', 3, 'Thiết kế', f, 10, 30, 20, 40],
        ['LT201', 'Lập trình Web', 3, 'Lập trình', f, 10, 20, 20, 50],
      ],
      sections: [
        [`${course?.code ?? 'TK101'}_05`, course?.code ?? 'TK101', lec?.code ?? 'GV0100', 50, 1, 15, 'T3 1-3 A2-302'],
        [`${course?.code ?? 'TK101'}_06`, course?.code ?? 'TK101', lec?.code ?? 'GV0100', 50, 1, 15, 'T4 6-8 B1-101; T6 1-2 Lab 3'],
      ],
    };
    const guide: Record<ImportKind, string[]> = {
      lecturers: [
        'Mỗi dòng là một giảng viên. Bắt buộc: Mã GV (dùng làm tên đăng nhập), Họ tên, Email.',
        'Mã khoa lấy theo Danh mục › Khoa (để trống nếu chưa xếp khoa). SĐT gồm 10 số.',
        'Mỗi giảng viên nhận email chứa mật khẩu tạm và phải đổi mật khẩu ở lần đăng nhập đầu.',
      ],
      courses: [
        'Mỗi dòng là một môn học. Bắt buộc: Mã môn, Tên môn, Tín chỉ (1–10), Loại môn.',
        'Loại môn: Thiết kế / Lập trình / Khác. Mã khoa lấy theo Danh mục › Khoa.',
        'Trọng số CC, BT, GK, CK (%) tổng phải bằng 100; để trống cả 4 cột thì dùng mặc định 10 · 30 · 20 · 40.',
      ],
      sections: [
        'Mỗi dòng là một lớp học phần, mở trong học kỳ chọn trên màn hình import.',
        'Bắt buộc: Mã lớp HP (VD: TK101_05), Mã môn, Mã GV, Sĩ số tối đa, Lịch học. Tuần để trống = 1 đến 15.',
        'Lịch học: mỗi buổi dạng "T2 1-3 A2-301" (thứ, tiết bắt đầu-kết thúc, phòng); nhiều buổi cách nhau bằng dấu chấm phẩy. Chủ nhật ghi CN.',
        'Hệ thống kiểm tra trùng lịch giảng viên / phòng với các lớp đã có và giữa các dòng trong tệp.',
      ],
    };
    const NAME: Record<ImportKind, string> = { lecturers: 'Mau_import_giang_vien.xlsx', courses: 'Mau_import_mon_hoc.xlsx', sections: 'Mau_import_lop_hoc_phan.xlsx' };
    return { buffer: await buildSheet('Du_lieu', COLS[kind], rows[kind], guide[kind]), fileName: NAME[kind] };
  }

  async preview(kind: ImportKind, file: Express.Multer.File, semesterId?: string) {
    const raw = await readSheet(file, COLS[kind]);
    const rows: Row[] = raw.map(({ row, values }) => ({ row, ok: true, problems: [], cells: values }));
    if (kind === 'lecturers') await this.checkLecturers(rows);
    if (kind === 'courses') await this.checkCourses(rows);
    if (kind === 'sections') {
      const sem = semesterId ? await this.prisma.semester.findUnique({ where: { id: semesterId } }) : await this.prisma.semester.findFirst({ where: { isCurrent: true } });
      if (!sem) throw new AppException('VALIDATION_ERROR', 'Chọn học kỳ mở lớp');
      semesterId = sem.id;
      await this.checkSections(rows, sem.id);
    }
    for (const r of rows) r.ok = !r.problems.length;
    const jobId = randomUUID();
    this.jobs.set(jobId, { at: Date.now(), kind, semesterId, rows });
    return { jobId, fileName: file.originalname, total: rows.length, valid: rows.filter((r) => r.ok).length, errorRows: rows.filter((r) => !r.ok).length, rows: rows.map(({ data: _d, ...r }) => r) };
  }

  async commit(adminId: string, kind: ImportKind, jobId: string) {
    const job = this.jobs.get(jobId);
    if (!job || job.kind !== kind || Date.now() - job.at > 30 * 60_000) throw new AppException('IMPORT_JOB_EXPIRED', 'Bản xem trước đã hết hạn, hãy tải tệp lên lại', HttpStatus.GONE);
    this.jobs.delete(jobId);
    let created = 0;
    const failed: { row: number; code: string; message: string }[] = [];
    const passwords: { code: string; fullName: string; email: string; password: string }[] = [];
    for (const r of job.rows.filter((x) => x.ok)) {
      try {
        if (kind === 'lecturers') {
          const d = r.data as LecturerInput;
          const res = await this.users.createLecturer(adminId, d);
          passwords.push({ code: d.code.toUpperCase(), fullName: d.fullName, email: d.email, password: res.tempPassword });
        }
        if (kind === 'courses') await this.academic.saveCourse(adminId, null, r.data as CourseInput);
        if (kind === 'sections') await this.academic.saveSection(adminId, null, r.data as SectionInput);
        created++;
      } catch (e) {
        failed.push({ row: r.row, code: r.cells.code ?? '', message: (e as Error).message });
      }
    }
    const LABEL: Record<ImportKind, string> = { lecturers: 'giảng viên', courses: 'môn học', sections: 'lớp học phần' };
    await this.audit.log({ actorId: adminId, action: `IMPORT_${kind.toUpperCase()}`, entityType: kind, summary: `Import ${created} ${LABEL[kind]} từ Excel${failed.length ? `, lỗi ${failed.length}` : ''}` });
    return { created, failed, passwords };
  }

  // ---------------------------------------------------------------- kiểm tra từng loại

  private async checkLecturers(rows: Row[]) {
    const codes = rows.map((r) => normCode(r.cells.code ?? ''));
    const [users, emails, faculties] = await Promise.all([
      this.prisma.user.findMany({ where: { username: { in: codes } }, select: { username: true } }),
      this.prisma.lecturer.findMany({ where: { email: { in: rows.map((r) => (r.cells.email ?? '').trim().toLowerCase()) } }, select: { email: true } }),
      this.prisma.faculty.findMany(),
    ]);
    const taken = new Set(users.map((u) => u.username.toUpperCase()));
    const takenMail = new Set(emails.map((e) => e.email.toLowerCase()));
    const seen = new Set<string>();
    const seenMail = new Set<string>();
    for (const r of rows) {
      const code = normCode(r.cells.code ?? '');
      const email = (r.cells.email ?? '').trim().toLowerCase();
      const phone = (r.cells.phone ?? '').replace(/[\s.-]/g, '');
      const fac = r.cells.faculty ? faculties.find((f) => f.code.toUpperCase() === normCode(r.cells.faculty)) : null;
      if (!code) r.problems.push('Thiếu mã GV');
      else if (taken.has(code)) r.problems.push('Mã GV đã có tài khoản');
      else if (seen.has(code)) r.problems.push('Mã GV lặp trong tệp');
      if (!r.cells.name?.trim()) r.problems.push('Thiếu họ tên');
      if (!EMAIL.test(email)) r.problems.push('Email không hợp lệ');
      else if (takenMail.has(email)) r.problems.push('Email đã được dùng');
      else if (seenMail.has(email)) r.problems.push('Email lặp trong tệp');
      if (phone && !PHONE.test(phone)) r.problems.push('SĐT không hợp lệ');
      if (r.cells.faculty && !fac) r.problems.push(`Không có khoa “${r.cells.faculty}”`);
      if (code) seen.add(code);
      if (email) seenMail.add(email);
      r.data = { code, fullName: (r.cells.name ?? '').trim(), email, phone: phone || undefined, facultyId: fac?.id ?? null } satisfies LecturerInput;
    }
  }

  private async checkCourses(rows: Row[]) {
    const [existing, faculties] = await Promise.all([this.prisma.course.findMany({ select: { code: true } }), this.prisma.faculty.findMany()]);
    const taken = new Set(existing.map((c) => c.code.toUpperCase()));
    const seen = new Set<string>();
    for (const r of rows) {
      const c = r.cells;
      const code = normCode(c.code ?? '');
      const credits = Number(c.credits);
      const type = COURSE_TYPES[plain(c.type ?? '')];
      const fac = c.faculty ? faculties.find((f) => f.code.toUpperCase() === normCode(c.faculty)) : null;
      const ws = [c.wa, c.wb, c.wm, c.wf];
      const empty = ws.every((w) => !w);
      const [wa, wb, wm, wf] = empty ? [10, 30, 20, 40] : ws.map((w) => Number(w || 0));
      if (!code) r.problems.push('Thiếu mã môn');
      else if (taken.has(code)) r.problems.push('Mã môn đã tồn tại');
      else if (seen.has(code)) r.problems.push('Mã môn lặp trong tệp');
      if (!c.name?.trim()) r.problems.push('Thiếu tên môn');
      if (!Number.isInteger(credits) || credits < 1 || credits > 10) r.problems.push('Tín chỉ 1–10');
      if (!type) r.problems.push('Loại môn: Thiết kế / Lập trình / Khác');
      if (c.faculty && !fac) r.problems.push(`Không có khoa “${c.faculty}”`);
      if ([wa, wb, wm, wf].some((w) => !Number.isInteger(w) || w < 0 || w > 100)) r.problems.push('Trọng số là số nguyên 0–100');
      else if (wa + wb + wm + wf !== 100) r.problems.push(`Tổng trọng số ${wa + wb + wm + wf}% (phải bằng 100%)`);
      if (code) seen.add(code);
      r.data = { code, name: (c.name ?? '').trim(), credits, courseType: type ?? 'OTHER', facultyId: fac?.id ?? null, wAttendance: wa, wAssignment: wb, wMidterm: wm, wFinal: wf } satisfies CourseInput;
    }
  }

  private async checkSections(rows: Row[], semesterId: string) {
    const [existing, courses, lecturers] = await Promise.all([
      this.prisma.courseSection.findMany({ select: { code: true } }),
      this.prisma.course.findMany(),
      this.prisma.lecturer.findMany({ include: { user: { select: { status: true } } } }),
    ]);
    const taken = new Set(existing.map((s) => s.code.toUpperCase()));
    const seen = new Set<string>();
    const accepted: SectionInput[] = [];
    const overlap = (a: SectionInput, b: SectionInput) => {
      const out: string[] = [];
      if (a.weekStart > b.weekEnd || b.weekStart > a.weekEnd) return out;
      for (const x of a.sessions)
        for (const y of b.sessions) {
          if (x.day !== y.day || x.from > y.to || y.from > x.to) continue;
          if (a.lecturerId === b.lecturerId) out.push(`trùng giờ dạy với lớp ${b.code} trong tệp`);
          if (x.room && y.room && x.room.toUpperCase() === y.room.toUpperCase()) out.push(`trùng phòng ${x.room} với lớp ${b.code} trong tệp`);
        }
      return out;
    };
    for (const r of rows) {
      const c = r.cells;
      const code = normCode(c.code ?? '');
      const course = courses.find((x) => x.code.toUpperCase() === normCode(c.course ?? ''));
      const lec = lecturers.find((x) => x.code.toUpperCase() === normCode(c.lecturer ?? ''));
      const max = Number(c.max);
      const weekStart = c.ws ? Number(c.ws) : 1;
      const weekEnd = c.we ? Number(c.we) : 15;
      const sessions = parseSchedule(c.schedule ?? '');
      if (!/^[A-Z0-9]+_\d{2,3}$/.test(code)) r.problems.push('Mã lớp dạng MÃMÔN_số, VD: TK101_05');
      else if (taken.has(code)) r.problems.push('Mã lớp đã tồn tại');
      else if (seen.has(code)) r.problems.push('Mã lớp lặp trong tệp');
      if (!course) r.problems.push(`Không có môn “${c.course ?? ''}”`);
      if (!lec) r.problems.push(`Không có giảng viên “${c.lecturer ?? ''}”`);
      else if (lec.user.status !== 'ACTIVE') r.problems.push('Giảng viên đang bị khóa');
      if (!Number.isInteger(max) || max < 1 || max > 300) r.problems.push('Sĩ số 1–300');
      if (!Number.isInteger(weekStart) || !Number.isInteger(weekEnd) || weekStart < 1 || weekEnd < weekStart || weekEnd > 25) r.problems.push('Tuần học không hợp lệ');
      if (!sessions) r.problems.push('Lịch học sai định dạng (VD: T2 1-3 A2-301)');
      else if (sessions.some((s) => !s.room)) r.problems.push('Mỗi buổi cần ghi phòng học');
      if (code) seen.add(code);
      const d: SectionInput = { semesterId, courseId: course?.id ?? '', code, lecturerId: lec?.id ?? '', maxStudents: max, weekStart, weekEnd, sessions: sessions ?? [] };
      if (!r.problems.length) {
        for (const a of d.sessions)
          for (const b of d.sessions) if (a !== b && a.day === b.day && a.from <= b.to && b.from <= a.to) r.problems.push('Hai buổi của lớp bị chồng tiết');
        if (!r.problems.length) {
          const db = await this.academic.conflicts(d);
          r.problems.push(...db.map((x) => x.message));
          for (const prev of accepted) r.problems.push(...overlap(d, prev));
          r.problems = [...new Set(r.problems)];
        }
      }
      if (!r.problems.length) accepted.push(d);
      r.data = d;
    }
  }
}
