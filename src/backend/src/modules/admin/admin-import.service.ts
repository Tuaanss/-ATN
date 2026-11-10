import { HttpStatus, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppException } from '../../common/errors/app-exception';
import { AuditService } from '../../common/audit/audit.service';
import { SheetColumn, buildSheet, normCode, readSheet } from '../../common/utils/excel';
import { AdminUsersService, LecturerInput } from './admin-users.service';
import { AdminAcademicService, CourseInput, SectionInput, sectionCodeOk, sectionPrefix } from './admin-academic.service';

export type ImportKind = 'lecturers' | 'courses' | 'sections' | 'faculties' | 'majors' | 'cohorts' | 'classes' | 'enrollments';
export const IMPORT_KINDS: ImportKind[] = ['lecturers', 'courses', 'sections', 'faculties', 'majors', 'cohorts', 'classes', 'enrollments'];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^(03|05|07|08|09)\d{8}$/;
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
    { key: 'faculty', header: 'Mã khoa', width: 12, aliases: ['Khoa'] },
  ],
  sections: [
    { key: 'code', header: 'Mã lớp HP', width: 24, aliases: ['Mã lớp', 'Mã lớp học phần'] },
    { key: 'course', header: 'Mã môn', width: 12, required: true },
    { key: 'lecturer', header: 'Mã GV', width: 12, aliases: ['Mã giảng viên'], required: true },
  ],
  faculties: [
    { key: 'code', header: 'Mã khoa', width: 12, required: true },
    { key: 'name', header: 'Tên khoa', width: 36, required: true },
  ],
  majors: [
    { key: 'code', header: 'Mã ngành', width: 12, required: true },
    { key: 'name', header: 'Tên ngành', width: 36, required: true },
    { key: 'faculty', header: 'Mã khoa', width: 12, aliases: ['Khoa'], required: true },
  ],
  cohorts: [
    { key: 'name', header: 'Khóa', width: 10, aliases: ['Tên khóa'], required: true },
    { key: 'year', header: 'Năm nhập học', width: 14, aliases: ['Năm bắt đầu'] },
  ],
  classes: [
    { key: 'code', header: 'Mã lớp', width: 16, aliases: ['Lớp', 'Lớp hành chính', 'Lớp sinh hoạt'], required: true },
    { key: 'major', header: 'Mã ngành', width: 12, aliases: ['Ngành'], required: true },
    { key: 'cohort', header: 'Khóa', width: 10, aliases: ['Tên khóa'], required: true },
    { key: 'year', header: 'Năm nhập học', width: 14, aliases: ['Năm bắt đầu'] },
  ],
  enrollments: [
    { key: 'section', header: 'Mã lớp HP', width: 14, aliases: ['Mã lớp học phần', 'Lớp HP'], required: true },
    { key: 'code', header: 'MSV', width: 14, aliases: ['MSSV', 'Mã SV', 'Mã sinh viên'], required: true },
    { key: 'name', header: 'Họ tên', width: 28, aliases: ['Họ và tên'] },
  ],
};

/** Năm nhập học suy từ tên khóa: D26 / K26 / 26 → 2026. */
const yearOf = (cohort: string) => {
  const m = cohort.match(/(\d{2})$/);
  return m ? 2000 + Number(m[1]) : null;
};

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

  async template(kind: ImportKind, sectionId?: string) {
    if (kind === 'enrollments' && sectionId) return this.sectionTemplate(sectionId);
    const [fac, course, lec, major, section, student, sem] = await Promise.all([
      this.prisma.faculty.findFirst(),
      this.prisma.course.findFirst(),
      this.prisma.lecturer.findFirst(),
      this.prisma.major.findFirst(),
      this.prisma.courseSection.findFirst({ where: { semester: { isCurrent: true } } }),
      this.prisma.student.findFirst(),
      this.prisma.semester.findFirst({ where: { isCurrent: true } }),
    ]);
    const f = fac?.code ?? 'TKTT';
    const pre = sectionPrefix(course?.code ?? 'TK101', sem ?? { term: 'TERM_1', academicYear: '2026-2027' });
    const rows: Record<ImportKind, (string | number)[][]> = {
      lecturers: [
        ['GV0100', 'TS. Nguyễn Văn A', 'nguyenvana@truong.edu.vn', '0912345670', f],
        ['GV0101', 'ThS. Trần Thị B', 'tranthib@truong.edu.vn', '', f],
      ],
      courses: [
        ['TK101', 'Thiết kế giao diện', 3, f],
        ['LT201', 'Lập trình Web', 3, f],
      ],
      faculties: [
        ['DPT', 'Khoa Đa phương tiện'],
        ['CNTT', 'Khoa Công nghệ thông tin'],
      ],
      majors: [
        ['CNDPT', 'Công nghệ đa phương tiện', f],
        ['TTDPT', 'Truyền thông đa phương tiện', f],
      ],
      cohorts: [
        ['D26', 2026],
        ['D27', ''],
      ],
      classes: [
        ['D26CQPT01-B', major?.code ?? 'CNDPT', 'D26', 2026],
        ['D26CQPT02-B', major?.code ?? 'CNDPT', 'D26', ''],
      ],
      enrollments: [
        [section?.code ?? `${pre}_01`, student?.studentCode ?? 'B26DCPT001', student?.fullName ?? 'Nguyễn Văn A'],
        [section?.code ?? `${pre}_01`, 'B26DCPT002', 'Trần Thị B'],
      ],
      sections: [
        [`${pre}_05`, course?.code ?? 'TK101', lec?.code ?? 'GV0100'],
        ['', course?.code ?? 'TK101', lec?.code ?? 'GV0100'],
      ],
    };
    const guide: Record<ImportKind, string[]> = {
      lecturers: [
        'Mỗi dòng là một giảng viên. Bắt buộc: Mã GV (dùng làm tên đăng nhập), Họ tên, Email.',
        'Mã khoa lấy theo Danh mục › Khoa (để trống nếu chưa xếp khoa). SĐT gồm 10 số.',
        'Mỗi giảng viên nhận email chứa mật khẩu tạm và phải đổi mật khẩu ở lần đăng nhập đầu.',
      ],
      courses: [
        'Mỗi dòng là một môn học. Bắt buộc: Mã môn, Tên môn, Tín chỉ (1–10).',
        'Mã khoa lấy theo Danh mục › Khoa (để trống nếu chưa xếp khoa).',
      ],
      sections: [
        'Mỗi dòng là một lớp học phần, mở trong học kỳ chọn trên màn hình import.',
        'Bắt buộc: Mã môn, Mã GV (đều phải có sẵn trong hệ thống).',
        `Mã lớp HP dạng MÃMÔN_HKx_NĂMHỌC_STT, VD: ${pre}_01 (HK1 / HK2 / HE; năm học 2025-2026 ghi 2526). Để trống thì hệ thống tự đánh số tiếp theo.`,
      ],
      faculties: [
        'Mỗi dòng là một khoa. Bắt buộc: Mã khoa (tối đa 20 ký tự), Tên khoa. Mã và tên khoa không được trùng.',
      ],
      majors: [
        'Mỗi dòng là một ngành. Bắt buộc: Mã ngành (tối đa 20 ký tự, không trùng), Tên ngành, Mã khoa (theo Danh mục › Khoa).',
      ],
      cohorts: [
        'Mỗi dòng là một khóa tuyển sinh. Bắt buộc: Khóa (VD: D26, tối đa 10 ký tự, không trùng).',
        'Năm nhập học để trống thì lấy theo 2 số cuối của tên khóa (D26 → 2026).',
      ],
      classes: [
        'Mỗi dòng là một lớp hành chính. Bắt buộc: Mã lớp, Mã ngành (theo Danh mục › Ngành), Khóa (VD: D26).',
        'Khóa chưa có trong Danh mục sẽ được tạo mới; Năm nhập học để trống thì lấy theo 2 số cuối của tên khóa (D26 → 2026).',
        'Sau khi có lớp, import sinh viên với cột "Lớp" là mã lớp hành chính.',
      ],
      enrollments: [
        'Mỗi dòng xếp một sinh viên vào một lớp học phần. Một tệp có thể xếp cho nhiều lớp.',
        'Bắt buộc: Mã lớp HP, MSV (phải có sẵn trong hệ thống). Cột Họ tên chỉ để đối chiếu.',
        'Sinh viên đã ở trong lớp sẽ được bỏ qua.',
      ],
    };
    const NAME: Record<ImportKind, string> = {
      lecturers: 'Mau_import_giang_vien.xlsx',
      courses: 'Mau_import_mon_hoc.xlsx',
      sections: 'Mau_import_lop_hoc_phan.xlsx',
      faculties: 'Mau_import_khoa.xlsx',
      majors: 'Mau_import_nganh.xlsx',
      cohorts: 'Mau_import_khoa_hoc.xlsx',
      classes: 'Mau_import_lop_hanh_chinh.xlsx',
      enrollments: 'Mau_xep_sinh_vien_vao_lop_hoc_phan.xlsx',
    };
    return { buffer: await buildSheet('Du_lieu', COLS[kind], rows[kind], guide[kind]), fileName: NAME[kind] };
  }

  async preview(kind: ImportKind, file: Express.Multer.File, semesterId?: string, sectionId?: string) {
    // xếp vào một lớp cụ thể: chỉ cần cột MSV
    const one = kind === 'enrollments' && sectionId ? await this.prisma.courseSection.findUnique({ where: { id: sectionId } }) : null;
    if (kind === 'enrollments' && sectionId && !one) throw new AppException('NOT_FOUND', 'Lớp học phần không tồn tại', HttpStatus.NOT_FOUND);
    const raw = await readSheet(file, one ? COLS.enrollments.map((c) => (c.key === 'section' ? { ...c, required: false } : c)) : COLS[kind]);
    const rows: Row[] = raw.map(({ row, values }) => ({ row, ok: true, problems: [], cells: values }));
    if (kind === 'lecturers') await this.checkLecturers(rows);
    if (kind === 'courses') await this.checkCourses(rows);
    if (kind === 'faculties') await this.checkFaculties(rows);
    if (kind === 'majors') await this.checkMajors(rows);
    if (kind === 'cohorts') await this.checkCohorts(rows);
    if (kind === 'classes') await this.checkClasses(rows);
    if (kind === 'enrollments') await this.checkEnrollments(rows, one?.code);
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
    if (kind === 'classes') created = await this.commitClasses(adminId, job.rows.filter((x) => x.ok), failed);
    if (kind === 'enrollments') created = await this.commitEnrollments(adminId, job.rows.filter((x) => x.ok), failed);
    for (const r of job.rows.filter((x) => x.ok && kind !== 'classes' && kind !== 'enrollments')) {
      if (kind === 'faculties' || kind === 'majors' || kind === 'cohorts') {
        try {
          if (kind === 'faculties') await this.academic.saveFaculty(adminId, null, r.data as { code: string; name: string });
          if (kind === 'majors') await this.academic.saveMajor(adminId, null, r.data as { code: string; name: string; facultyId: string });
          if (kind === 'cohorts') await this.academic.saveCohort(adminId, null, r.data as { name: string; startYear: number });
          created++;
        } catch (e) {
          failed.push({ row: r.row, code: r.cells.code ?? r.cells.name ?? '', message: (e as Error).message });
        }
        continue;
      }
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
    const LABEL: Record<ImportKind, string> = { lecturers: 'giảng viên', courses: 'môn học', sections: 'lớp học phần', faculties: 'khoa', majors: 'ngành', cohorts: 'khóa', classes: 'lớp hành chính', enrollments: 'lượt xếp sinh viên vào lớp học phần' };
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
      const fac = c.faculty ? faculties.find((f) => f.code.toUpperCase() === normCode(c.faculty)) : null;
      if (!code) r.problems.push('Thiếu mã môn');
      else if (taken.has(code)) r.problems.push('Mã môn đã tồn tại');
      else if (seen.has(code)) r.problems.push('Mã môn lặp trong tệp');
      if (!c.name?.trim()) r.problems.push('Thiếu tên môn');
      if (!Number.isInteger(credits) || credits < 1 || credits > 10) r.problems.push('Tín chỉ 1–10');
      if (c.faculty && !fac) r.problems.push(`Không có khoa “${c.faculty}”`);
      if (code) seen.add(code);
      r.data = { code, name: (c.name ?? '').trim(), credits, facultyId: fac?.id ?? null } satisfies CourseInput;
    }
  }

  private async checkSections(rows: Row[], semesterId: string) {
    const [existing, courses, lecturers, sem] = await Promise.all([
      this.prisma.courseSection.findMany({ select: { code: true } }),
      this.prisma.course.findMany(),
      this.prisma.lecturer.findMany({ include: { user: { select: { status: true } } } }),
      this.prisma.semester.findUniqueOrThrow({ where: { id: semesterId } }),
    ]);
    const taken = new Set(existing.map((s) => s.code.toUpperCase()));
    const seen = new Set<string>();
    for (const r of rows) {
      const c = r.cells;
      const course = courses.find((x) => x.code.toUpperCase() === normCode(c.course ?? ''));
      const lec = lecturers.find((x) => x.code.toUpperCase() === normCode(c.lecturer ?? ''));
      const prefix = course ? sectionPrefix(course.code, sem) : null;
      let code = normCode(c.code ?? '');
      // để trống mã lớp → tự đánh số tiếp theo của môn trong học kỳ
      if (!code && prefix) {
        let n = 1;
        while (taken.has(`${prefix}_${String(n).padStart(2, '0')}`) || seen.has(`${prefix}_${String(n).padStart(2, '0')}`)) n++;
        code = `${prefix}_${String(n).padStart(2, '0')}`;
        c.code = code;
      }
      if (!code) r.problems.push('Thiếu mã lớp HP');
      else if (prefix && !sectionCodeOk(code, prefix)) r.problems.push(`Mã lớp phải dạng ${prefix}_01`);
      else if (taken.has(code)) r.problems.push('Mã lớp đã tồn tại');
      else if (seen.has(code)) r.problems.push('Mã lớp lặp trong tệp');
      if (!course) r.problems.push(`Không có môn “${c.course ?? ''}”`);
      if (!lec) r.problems.push(`Không có giảng viên “${c.lecturer ?? ''}”`);
      else if (lec.user.status !== 'ACTIVE') r.problems.push('Giảng viên đang bị khóa');
      if (code) seen.add(code);
      r.data = { semesterId, courseId: course?.id ?? '', code, lecturerId: lec?.id ?? '' } satisfies SectionInput;
    }
  }

  // ---------------------------------------------------------------- khoa, ngành, khóa

  private async checkFaculties(rows: Row[]) {
    const existing = await this.prisma.faculty.findMany();
    const codes = new Set(existing.map((f) => f.code.toUpperCase()));
    const names = new Set(existing.map((f) => plain(f.name)));
    const seenCode = new Set<string>();
    const seenName = new Set<string>();
    for (const r of rows) {
      const code = normCode(r.cells.code ?? '');
      const name = (r.cells.name ?? '').trim();
      if (!code) r.problems.push('Thiếu mã khoa');
      else if (code.length > 20) r.problems.push('Mã khoa tối đa 20 ký tự');
      else if (codes.has(code)) r.problems.push('Mã khoa đã tồn tại');
      else if (seenCode.has(code)) r.problems.push('Mã khoa lặp trong tệp');
      if (!name) r.problems.push('Thiếu tên khoa');
      else if (name.length > 200) r.problems.push('Tên khoa tối đa 200 ký tự');
      else if (names.has(plain(name))) r.problems.push('Tên khoa đã tồn tại');
      else if (seenName.has(plain(name))) r.problems.push('Tên khoa lặp trong tệp');
      if (code) seenCode.add(code);
      if (name) seenName.add(plain(name));
      r.data = { code, name };
    }
  }

  private async checkMajors(rows: Row[]) {
    const [existing, faculties] = await Promise.all([this.prisma.major.findMany({ select: { code: true } }), this.prisma.faculty.findMany()]);
    const codes = new Set(existing.map((m) => m.code.toUpperCase()));
    const seen = new Set<string>();
    for (const r of rows) {
      const code = normCode(r.cells.code ?? '');
      const name = (r.cells.name ?? '').trim();
      const fac = faculties.find((f) => f.code.toUpperCase() === normCode(r.cells.faculty ?? ''));
      if (!code) r.problems.push('Thiếu mã ngành');
      else if (code.length > 20) r.problems.push('Mã ngành tối đa 20 ký tự');
      else if (codes.has(code)) r.problems.push('Mã ngành đã tồn tại');
      else if (seen.has(code)) r.problems.push('Mã ngành lặp trong tệp');
      if (!name) r.problems.push('Thiếu tên ngành');
      else if (name.length > 200) r.problems.push('Tên ngành tối đa 200 ký tự');
      if (!r.cells.faculty) r.problems.push('Thiếu mã khoa');
      else if (!fac) r.problems.push(`Không có khoa “${r.cells.faculty}”`);
      if (code) seen.add(code);
      r.data = { code, name, facultyId: fac?.id ?? '' };
    }
  }

  private async checkCohorts(rows: Row[]) {
    const existing = new Set((await this.prisma.cohort.findMany({ select: { name: true } })).map((c) => c.name.toUpperCase()));
    const seen = new Set<string>();
    for (const r of rows) {
      const name = normCode(r.cells.name ?? '');
      const year = r.cells.year ? Number(r.cells.year) : name ? yearOf(name) : null;
      if (!name) r.problems.push('Thiếu tên khóa');
      else if (name.length > 10) r.problems.push('Tên khóa tối đa 10 ký tự');
      else if (existing.has(name)) r.problems.push('Khóa đã tồn tại');
      else if (seen.has(name)) r.problems.push('Khóa lặp trong tệp');
      if (r.cells.year && (!Number.isInteger(year) || year! < 2000 || year! > 2100)) r.problems.push('Năm nhập học không hợp lệ');
      else if (name && !year) r.problems.push(`Không suy ra được năm nhập học từ “${name}”: cần ghi Năm nhập học`);
      else if (!r.cells.year && year) r.cells.yearAuto = String(year);
      if (name) seen.add(name);
      r.data = { name, startYear: year ?? 0 };
    }
  }

  // ---------------------------------------------------------------- lớp hành chính (kèm khóa mới)

  private async checkClasses(rows: Row[]) {
    const [classes, majors, cohorts] = await Promise.all([this.prisma.adminClass.findMany({ select: { code: true } }), this.prisma.major.findMany(), this.prisma.cohort.findMany()]);
    const taken = new Set(classes.map((c) => c.code.toUpperCase()));
    const seen = new Set<string>();
    // khóa mới xuất hiện trong tệp: tên → năm nhập học (các dòng phải thống nhất)
    const newCohorts = new Map<string, number>();
    for (const r of rows) {
      const c = r.cells;
      const code = normCode(c.code ?? '');
      const major = majors.find((m) => m.code.toUpperCase() === normCode(c.major ?? ''));
      const cohortName = normCode(c.cohort ?? '');
      const year = c.year ? Number(c.year) : null;
      const cohort = cohorts.find((x) => x.name.toUpperCase() === cohortName);
      if (!code) r.problems.push('Thiếu mã lớp');
      else if (code.length > 30) r.problems.push('Mã lớp tối đa 30 ký tự');
      else if (taken.has(code)) r.problems.push('Mã lớp đã tồn tại');
      else if (seen.has(code)) r.problems.push('Mã lớp lặp trong tệp');
      if (!major) r.problems.push(`Không có ngành “${c.major ?? ''}”`);
      if (!cohortName) r.problems.push('Thiếu khóa');
      else if (cohortName.length > 10) r.problems.push('Tên khóa tối đa 10 ký tự');
      else if (c.year && (!Number.isInteger(year) || year! < 2000 || year! > 2100)) r.problems.push('Năm nhập học không hợp lệ');
      else if (cohort && year && cohort.startYear !== year) r.problems.push(`Khóa ${cohort.name} đã có, năm nhập học ${cohort.startYear}`);
      else if (!cohort) {
        const y = year ?? newCohorts.get(cohortName) ?? yearOf(cohortName);
        if (!y) r.problems.push(`Khóa ${cohortName} chưa có: cần ghi Năm nhập học`);
        else if (newCohorts.has(cohortName) && newCohorts.get(cohortName) !== y) r.problems.push(`Khóa ${cohortName} ghi năm nhập học khác các dòng trên (${newCohorts.get(cohortName)})`);
        else {
          newCohorts.set(cohortName, y);
          r.cells.cohortNew = String(y);
        }
      }
      if (code) seen.add(code);
      r.data = { code, majorId: major?.id ?? '', cohortId: cohort?.id ?? null, cohortName, year: cohort?.startYear ?? newCohorts.get(cohortName) ?? null };
    }
  }

  private async commitClasses(adminId: string, rows: Row[], failed: { row: number; code: string; message: string }[]) {
    const ids = new Map<string, string>();
    let created = 0;
    for (const r of rows) {
      const d = r.data as { code: string; majorId: string; cohortId: string | null; cohortName: string; year: number };
      try {
        let cohortId = d.cohortId ?? ids.get(d.cohortName);
        if (!cohortId) {
          cohortId = (await this.prisma.cohort.findFirst({ where: { name: d.cohortName } }))?.id ?? (await this.academic.saveCohort(adminId, null, { name: d.cohortName, startYear: d.year })).id;
          ids.set(d.cohortName, cohortId);
        }
        await this.academic.saveClass(adminId, null, { code: d.code, majorId: d.majorId, cohortId });
        created++;
      } catch (e) {
        failed.push({ row: r.row, code: d.code, message: (e as Error).message });
      }
    }
    return created;
  }

  // ---------------------------------------------------------------- xếp sinh viên vào lớp học phần

  /** File mẫu xếp SV cho một lớp: chỉ cần điền MSV, cột Mã lớp HP để trống. */
  private async sectionTemplate(sectionId: string) {
    const s = await this.prisma.courseSection.findUnique({ where: { id: sectionId }, include: { course: true } });
    if (!s) throw new AppException('NOT_FOUND', 'Lớp học phần không tồn tại', HttpStatus.NOT_FOUND);
    const buffer = await buildSheet('Du_lieu', COLS.enrollments, [], [
      `Xếp sinh viên vào lớp ${s.code} – ${s.course.name}.`,
      'Mỗi dòng một sinh viên: điền MSV (bắt buộc), Họ tên chỉ để đối chiếu. Có thể để trống cột Mã lớp HP.',
      'Sinh viên đã ở trong lớp sẽ được bỏ qua.',
    ]);
    return { buffer, fileName: `Xep_sinh_vien_${s.code}.xlsx` };
  }

  private async checkEnrollments(rows: Row[], only?: string) {
    if (only)
      for (const r of rows) {
        if (!r.cells.section) r.cells.section = only;
        else if (normCode(r.cells.section) !== only.toUpperCase()) r.problems.push(`Dòng thuộc lớp ${r.cells.section}, không phải lớp ${only}`);
      }
    const secCodes = [...new Set(rows.map((r) => normCode(r.cells.section ?? '')).filter(Boolean))];
    const stCodes = [...new Set(rows.map((r) => normCode(r.cells.code ?? '')).filter(Boolean))];
    const [sections, students] = await Promise.all([
      this.prisma.courseSection.findMany({ where: { code: { in: secCodes } } }),
      this.prisma.student.findMany({
        where: { studentCode: { in: stCodes } },
        include: { user: { select: { status: true } }, enrollments: { select: { sectionId: true } } },
      }),
    ]);
    const secBy = new Map(sections.map((x) => [x.code.toUpperCase(), x]));
    const stBy = new Map(students.map((x) => [x.studentCode.toUpperCase(), x]));
    const seen = new Map<string, number>();
    for (const r of rows) {
      const secCode = normCode(r.cells.section ?? '');
      const code = normCode(r.cells.code ?? '');
      const sec = secBy.get(secCode);
      const st = stBy.get(code);
      if (!secCode) r.problems.push('Thiếu mã lớp HP');
      else if (!sec) r.problems.push(`Không có lớp học phần “${r.cells.section}”`);
      if (!code) r.problems.push('Thiếu MSV');
      else if (!st) r.problems.push(`Không có sinh viên ${code}`);
      else if (st.user.status !== 'ACTIVE') r.problems.push('Tài khoản sinh viên đang bị khóa');
      if (sec && st && !r.problems.length) {
        const key = `${sec.id}:${st.id}`;
        if (seen.has(key)) r.problems.push(`Dòng lặp (đã có ở dòng ${seen.get(key)})`);
        else if (st.enrollments.some((e) => e.sectionId === sec.id)) r.problems.push('Sinh viên đã ở trong lớp');
        else seen.set(key, r.row);
      }
      r.data = { sectionId: sec?.id ?? '', code };
    }
  }

  private async commitEnrollments(adminId: string, rows: Row[], failed: { row: number; code: string; message: string }[]) {
    const bySection = new Map<string, Row[]>();
    for (const r of rows) {
      const d = r.data as { sectionId: string };
      bySection.set(d.sectionId, [...(bySection.get(d.sectionId) ?? []), r]);
    }
    let created = 0;
    for (const [sectionId, list] of bySection) {
      // addStudents kiểm tra lại với dữ liệu mới nhất (có thể đã đổi sau bước xem trước)
      const res = await this.academic.addStudents(adminId, sectionId, list.map((r) => (r.data as { code: string }).code));
      created += res.added.length;
      for (const sk of res.skipped) {
        const r = list.find((x) => (x.data as { code: string }).code === sk.code);
        failed.push({ row: r?.row ?? 0, code: sk.code, message: sk.reason });
      }
    }
    return created;
  }
}
