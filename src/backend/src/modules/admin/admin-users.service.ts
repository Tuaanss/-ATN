import { HttpStatus, Injectable } from '@nestjs/common';
import { ParentRelation, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomBytes, randomUUID } from 'node:crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppException, notFound } from '../../common/errors/app-exception';
import { AuditService } from '../../common/audit/audit.service';
import { SystemConfigService } from '../../common/config/system-config.service';
import { MailService } from '../../infra/mail/mail.service';
import { RowError, SheetColumn, buildSheet, normCode, readSheet } from '../../common/utils/excel';
import { env } from '../../config/env';

const PHONE = /^(03|05|07|08|09)\d{8}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Mật khẩu tạm 10 ký tự, có chữ và số */
export const tempPassword = () => `${randomBytes(6).toString('base64url').replace(/[^a-zA-Z]/g, 'x').slice(0, 6)}${Math.floor(1000 + Math.random() * 9000)}`;
const dmy = (d: Date) => `${String(d.getUTCDate()).padStart(2, '0')}${String(d.getUTCMonth() + 1).padStart(2, '0')}${d.getUTCFullYear()}`;
const login = `${env.WEB_ORIGIN.replace(/\/$/, '')}/login`;

export interface LecturerInput {
  code: string;
  fullName: string;
  email: string;
  phone?: string;
  facultyId?: string | null;
}
export interface StudentInput {
  studentCode: string;
  fullName: string;
  dateOfBirth: string;
  adminClassId?: string | null;
  email?: string;
  phone?: string;
}

const STUDENT_COLS: SheetColumn[] = [
  { key: 'code', header: 'MSSV', width: 14, aliases: ['MSV', 'Mã sinh viên'], required: true },
  { key: 'name', header: 'Họ tên', width: 28, aliases: ['Họ và tên'], required: true },
  { key: 'dob', header: 'Ngày sinh', width: 14, required: true },
  { key: 'class', header: 'Lớp', width: 14, aliases: ['Lớp sinh hoạt', 'Mã lớp'], required: true },
  { key: 'email', header: 'Email', width: 26 },
  { key: 'phone', header: 'SĐT', width: 14, aliases: ['Số điện thoại'] },
];

/** UC02.1 – UC02.5: tài khoản GV, SV (import Excel), phụ huynh. */
@Injectable()
export class AdminUsersService {
  private imports = new Map<string, { at: number; rows: (StudentInput & { row: number })[] }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: SystemConfigService,
    private readonly mail: MailService,
  ) {}

  private async mustChange() {
    return (await this.config.get()).security.forceChangeFirstLogin;
  }

  // ================================================================ chung: khóa / mở khóa / đặt lại mật khẩu

  async setStatus(adminId: string, userId: string, lock: boolean, reason?: string) {
    const u = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!u || u.role === 'ADMIN') throw notFound('Tài khoản');
    const status: UserStatus = lock ? 'LOCKED' : 'ACTIVE';
    await this.prisma.user.update({ where: { id: userId }, data: { status, failedLoginCount: 0, lockedUntil: null } });
    await this.audit.log({ actorId: adminId, action: lock ? 'LOCK_ACCOUNT' : 'UNLOCK_ACCOUNT', entityType: 'user', entityId: userId, summary: `${lock ? 'Khóa' : 'Mở khóa'} tài khoản ${u.username}${reason ? ` – ${reason}` : ''}` });
    return { ok: true };
  }

  /** Đặt lại mật khẩu: GV → mật khẩu tạm gửi email; SV → ngày sinh; PH → SĐT. Luôn bắt đổi ở lần đăng nhập tiếp theo. */
  async resetPassword(adminId: string, userId: string) {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, include: { lecturer: true, student: true, parent: true, enterprise: true } });
    if (!u || u.role === 'ADMIN') throw notFound('Tài khoản');
    const pw = u.student ? dmy(u.student.dateOfBirth) : u.parent ? u.parent.phone : tempPassword();
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await argon2.hash(pw), mustChangePassword: true, failedLoginCount: 0, lockedUntil: null } });
    const to = u.lecturer?.email ?? u.enterprise?.email ?? u.student?.email ?? u.email;
    if (to && (u.lecturer || u.enterprise))
      await this.mail.send({ to, subject: 'Mật khẩu EduPortfolio đã được đặt lại', text: `Quản trị viên đã đặt lại mật khẩu cho tài khoản ${u.username}.\nMật khẩu tạm thời: ${pw}\nBạn sẽ phải đổi mật khẩu ở lần đăng nhập tiếp theo.`, action: { label: 'Đăng nhập', url: login } });
    await this.audit.log({ actorId: adminId, action: 'RESET_PASSWORD', entityType: 'user', entityId: userId, summary: `Đặt lại mật khẩu ${u.username}` });
    return { ok: true, tempPassword: u.lecturer || u.enterprise ? pw : null, hint: u.student ? 'Mật khẩu về ngày sinh (ddmmyyyy)' : u.parent ? 'Mật khẩu về số điện thoại' : 'Mật khẩu tạm đã gửi qua email' };
  }

  // ================================================================ giảng viên (UC02.1)

  async lecturers() {
    const list = await this.prisma.lecturer.findMany({
      include: { user: { select: { id: true, status: true, lastLoginAt: true, mustChangePassword: true } }, faculty: true, driveLink: { select: { googleEmail: true, status: true } }, _count: { select: { sections: true } } },
      orderBy: { code: 'asc' },
    });
    return list.map((l) => ({
      id: l.id,
      userId: l.userId,
      code: l.code,
      fullName: l.fullName,
      email: l.email,
      phone: l.phone,
      faculty: l.faculty && { id: l.faculty.id, code: l.faculty.code, name: l.faculty.name },
      drive: l.driveLink ? { email: l.driveLink.googleEmail, status: l.driveLink.status } : null,
      sections: l._count.sections,
      status: l.user.status,
      lastLoginAt: l.user.lastLoginAt,
      mustChangePassword: l.user.mustChangePassword,
    }));
  }

  private checkLecturer(d: LecturerInput) {
    if (!d.code.trim()) throw new AppException('VALIDATION_ERROR', 'Nhập mã giảng viên');
    if (!d.fullName.trim()) throw new AppException('VALIDATION_ERROR', 'Nhập họ tên');
    if (!EMAIL.test(d.email)) throw new AppException('VALIDATION_ERROR', 'Email không hợp lệ');
    if (d.phone && !PHONE.test(d.phone)) throw new AppException('VALIDATION_ERROR', 'SĐT gồm 10 số, bắt đầu 03/05/07/08/09');
  }

  async createLecturer(adminId: string, d: LecturerInput) {
    this.checkLecturer(d);
    const code = d.code.trim().toUpperCase();
    if (await this.prisma.user.findFirst({ where: { username: { equals: code } } })) throw new AppException('CONFLICT', 'Mã giảng viên đã tồn tại', HttpStatus.CONFLICT);
    if (await this.prisma.lecturer.findUnique({ where: { email: d.email } })) throw new AppException('CONFLICT', 'Email đã được dùng', HttpStatus.CONFLICT);
    const pw = tempPassword();
    const user = await this.prisma.user.create({
      data: { username: code, passwordHash: await argon2.hash(pw), role: 'LECTURER', mustChangePassword: await this.mustChange(), email: d.email, lecturer: { create: { code, fullName: d.fullName.trim(), email: d.email, phone: d.phone || null, facultyId: d.facultyId || null } } },
    });
    await this.mail.send({ to: d.email, subject: 'Tài khoản giảng viên EduPortfolio', text: `Tài khoản của bạn đã được tạo.\nTên đăng nhập: ${code}\nMật khẩu tạm thời: ${pw}\nBạn sẽ phải đổi mật khẩu ở lần đăng nhập đầu tiên.`, action: { label: 'Đăng nhập', url: login } });
    await this.audit.log({ actorId: adminId, action: 'CREATE_ACCOUNT', entityType: 'user', entityId: user.id, summary: `Tạo tài khoản GV ${code}` });
    return { ok: true, tempPassword: pw };
  }

  async updateLecturer(adminId: string, id: string, d: LecturerInput) {
    this.checkLecturer(d);
    const l = await this.prisma.lecturer.findUnique({ where: { id } });
    if (!l) throw notFound('Giảng viên');
    const dup = await this.prisma.lecturer.findFirst({ where: { email: d.email, id: { not: id } } });
    if (dup) throw new AppException('CONFLICT', 'Email đã được dùng', HttpStatus.CONFLICT);
    await this.prisma.lecturer.update({ where: { id }, data: { fullName: d.fullName.trim(), email: d.email, phone: d.phone || null, facultyId: d.facultyId || null } });
    await this.prisma.user.update({ where: { id: l.userId }, data: { email: d.email } });
    await this.audit.log({ actorId: adminId, action: 'UPDATE_ACCOUNT', entityType: 'user', entityId: l.userId, summary: `Sửa tài khoản GV ${l.code}` });
    return { ok: true };
  }

  // ================================================================ sinh viên (UC02.2)

  async students() {
    const list = await this.prisma.student.findMany({
      include: { user: { select: { id: true, status: true, lastLoginAt: true, mustChangePassword: true } }, adminClass: { include: { major: true, cohort: true } }, parents: { include: { parent: true } } },
      orderBy: { studentCode: 'asc' },
    });
    return list.map((s) => ({
      id: s.id,
      userId: s.userId,
      studentCode: s.studentCode,
      fullName: s.fullName,
      dateOfBirth: s.dateOfBirth,
      email: s.email,
      phone: s.phone,
      cohort: s.adminClass?.cohort.name ?? s.cohort,
      major: s.adminClass?.major.name ?? s.major,
      adminClass: s.adminClass && { id: s.adminClass.id, code: s.adminClass.code },
      profileCompleted: !!s.profileCompletedAt,
      parents: s.parents.map((p) => ({ relation: p.relation, phone: p.parent.phone })),
      status: s.user.status,
      lastLoginAt: s.user.lastLoginAt,
    }));
  }

  private async classInfo(adminClassId?: string | null) {
    if (!adminClassId) return { adminClassId: null, cohort: null, major: null };
    const c = await this.prisma.adminClass.findUnique({ where: { id: adminClassId }, include: { major: true, cohort: true } });
    if (!c) throw new AppException('VALIDATION_ERROR', 'Lớp sinh hoạt không tồn tại');
    return { adminClassId: c.id, cohort: c.cohort.name, major: c.major.name };
  }

  private parseDob(v: string) {
    const m = v.trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/) ?? v.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    const [d, mo, y] = v.includes('-') && m[1].length === 4 ? [m[3], m[2], m[1]] : [m[1], m[2], m[3]];
    const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
    if (Number.isNaN(date.getTime()) || date.getUTCDate() !== Number(d) || Number(y) < 1950 || date > new Date()) return null;
    return date;
  }

  async createStudent(adminId: string, d: StudentInput) {
    const code = normCode(d.studentCode);
    if (!code) throw new AppException('VALIDATION_ERROR', 'Nhập MSSV');
    if (!d.fullName.trim()) throw new AppException('VALIDATION_ERROR', 'Nhập họ tên');
    const dob = this.parseDob(d.dateOfBirth);
    if (!dob) throw new AppException('VALIDATION_ERROR', 'Ngày sinh không hợp lệ (dd/mm/yyyy)');
    if (d.email && !EMAIL.test(d.email)) throw new AppException('VALIDATION_ERROR', 'Email không hợp lệ');
    if (d.phone && !PHONE.test(d.phone)) throw new AppException('VALIDATION_ERROR', 'SĐT gồm 10 số, bắt đầu 03/05/07/08/09');
    if (await this.prisma.user.findFirst({ where: { username: { equals: code } } })) throw new AppException('CONFLICT', `MSSV ${code} đã tồn tại`, HttpStatus.CONFLICT);
    const cls = await this.classInfo(d.adminClassId);
    const user = await this.prisma.user.create({
      data: {
        username: code,
        passwordHash: await argon2.hash(dmy(dob)),
        role: 'STUDENT',
        mustChangePassword: await this.mustChange(),
        student: { create: { studentCode: code, fullName: d.fullName.trim(), dateOfBirth: dob, email: d.email || null, phone: d.phone || null, ...cls } },
      },
    });
    await this.audit.log({ actorId: adminId, action: 'CREATE_ACCOUNT', entityType: 'user', entityId: user.id, summary: `Tạo tài khoản SV ${code}` });
    return { ok: true, password: 'Mật khẩu ban đầu là ngày sinh (ddmmyyyy)' };
  }

  async updateStudent(adminId: string, id: string, d: StudentInput) {
    const s = await this.prisma.student.findUnique({ where: { id } });
    if (!s) throw notFound('Sinh viên');
    const dob = this.parseDob(d.dateOfBirth);
    if (!dob) throw new AppException('VALIDATION_ERROR', 'Ngày sinh không hợp lệ (dd/mm/yyyy)');
    if (d.email && !EMAIL.test(d.email)) throw new AppException('VALIDATION_ERROR', 'Email không hợp lệ');
    if (d.phone && !PHONE.test(d.phone)) throw new AppException('VALIDATION_ERROR', 'SĐT gồm 10 số, bắt đầu 03/05/07/08/09');
    const dup = await this.prisma.student.findFirst({ where: { id: { not: id }, OR: [...(d.email ? [{ email: d.email }] : []), ...(d.phone ? [{ phone: d.phone }] : [])] } });
    if (dup && (d.email || d.phone)) throw new AppException('CONFLICT', 'Email hoặc SĐT đã được sinh viên khác dùng', HttpStatus.CONFLICT);
    const cls = await this.classInfo(d.adminClassId);
    await this.prisma.student.update({ where: { id }, data: { fullName: d.fullName.trim(), dateOfBirth: dob, email: d.email || null, phone: d.phone || null, ...cls } });
    await this.audit.log({ actorId: adminId, action: 'UPDATE_ACCOUNT', entityType: 'user', entityId: s.userId, summary: `Sửa tài khoản SV ${s.studentCode}` });
    return { ok: true };
  }

  // ---------------------------------------------------------------- import SV từ Excel (UC02.3)

  async studentTemplate() {
    const buffer = await buildSheet('Sinh_vien', STUDENT_COLS, [['SV1001', 'Nguyễn Văn A', '15/03/2005', (await this.prisma.adminClass.findFirst())?.code ?? 'D22TKDH1', 'a.nguyen@email.com', '0912345678']], [
      'Mỗi dòng là một sinh viên. Cột bắt buộc: MSSV, Họ tên, Ngày sinh (dd/mm/yyyy), Lớp (mã lớp sinh hoạt đã có trong Danh mục).',
      'Email, SĐT không bắt buộc – sinh viên tự khai báo khi đăng nhập lần đầu.',
      'Mật khẩu ban đầu = ngày sinh dạng ddmmyyyy; sinh viên phải đổi ở lần đăng nhập đầu tiên.',
      'Tối đa 2.000 dòng, 5 MB.',
    ]);
    return { buffer, fileName: 'Mau_import_sinh_vien.xlsx' };
  }

  async importPreview(file: Express.Multer.File) {
    const rows = await readSheet(file, STUDENT_COLS);
    const classes = new Map((await this.prisma.adminClass.findMany({ include: { major: true, cohort: true } })).map((c) => [c.code.toUpperCase(), c]));
    const existing = new Set((await this.prisma.user.findMany({ where: { username: { in: rows.map((r) => normCode(r.values.code ?? '')) } }, select: { username: true } })).map((u) => u.username.toUpperCase()));
    const seen = new Set<string>();
    const errors: RowError[] = [];
    const valid: (StudentInput & { row: number })[] = [];
    const out = rows.map(({ row, values }) => {
      const code = normCode(values.code ?? '');
      const cls = classes.get(normCode(values.class ?? ''));
      const problems: string[] = [];
      if (!code) problems.push('Thiếu MSSV');
      else if (existing.has(code)) problems.push('MSSV đã có tài khoản');
      else if (seen.has(code)) problems.push('MSSV lặp trong tệp');
      if (!values.name?.trim()) problems.push('Thiếu họ tên');
      const dobText = /^\d{4}-\d{2}-\d{2}T/.test(values.dob ?? '') ? (values.dob ?? '').slice(0, 10) : (values.dob ?? '');
      if (!this.parseDob(dobText)) problems.push('Ngày sinh không hợp lệ');
      if (!cls) problems.push(`Không có lớp “${values.class ?? ''}”`);
      if (values.email && !EMAIL.test(values.email)) problems.push('Email không hợp lệ');
      if (values.phone && !PHONE.test(values.phone.replace(/\s/g, ''))) problems.push('SĐT không hợp lệ');
      if (code) seen.add(code);
      if (problems.length) errors.push({ row, studentCode: code || undefined, message: problems.join('; ') });
      else valid.push({ row, studentCode: code, fullName: values.name.trim(), dateOfBirth: dobText, adminClassId: cls!.id, email: values.email || undefined, phone: values.phone?.replace(/\s/g, '') || undefined });
      return { row, studentCode: code, fullName: values.name ?? '', dateOfBirth: dobText, classCode: values.class ?? '', cohort: cls?.cohort.name ?? null, major: cls?.major.name ?? null, ok: !problems.length, problems };
    });
    const jobId = randomUUID();
    this.imports.set(jobId, { at: Date.now(), rows: valid });
    return { jobId, fileName: file.originalname, total: rows.length, valid: valid.length, errorRows: errors.length, rows: out };
  }

  async importCommit(adminId: string, jobId: string) {
    const job = this.imports.get(jobId);
    if (!job || Date.now() - job.at > 30 * 60_000) throw new AppException('IMPORT_JOB_EXPIRED', 'Bản xem trước đã hết hạn, hãy tải tệp lên lại', HttpStatus.GONE);
    this.imports.delete(jobId);
    let created = 0;
    const failed: { row: number; studentCode: string; message: string }[] = [];
    for (const r of job.rows) {
      try {
        await this.createStudent(adminId, r);
        created++;
      } catch (e) {
        failed.push({ row: r.row, studentCode: r.studentCode, message: (e as Error).message });
      }
    }
    await this.audit.log({ actorId: adminId, action: 'IMPORT_STUDENTS', entityType: 'user', summary: `Import ${created} sinh viên từ Excel${failed.length ? `, lỗi ${failed.length}` : ''}` });
    return { created, failed };
  }

  // ================================================================ phụ huynh (UC02.4, UC02.5)

  async parents() {
    const list = await this.prisma.parent.findMany({
      include: { user: { select: { id: true, status: true, lastLoginAt: true, mustChangePassword: true } }, students: { include: { student: { select: { id: true, studentCode: true, fullName: true, adminClass: { select: { code: true } } } } } } },
      orderBy: { createdAt: 'desc' },
    });
    return list.map((p) => ({
      id: p.id,
      userId: p.userId,
      phone: p.phone,
      fullName: p.fullName,
      links: p.students.map((l) => ({ relation: l.relation, studentId: l.student.id, studentCode: l.student.studentCode, fullName: l.student.fullName, adminClass: l.student.adminClass?.code ?? null })),
      status: p.user.status === 'ACTIVE' && p.user.mustChangePassword ? 'FIRST_LOGIN' : p.user.status,
      createdAt: p.createdAt,
      mustChangePassword: p.user.mustChangePassword,
      lastLoginAt: p.user.lastLoginAt,
    }));
  }

  /**
   * UC02.5 – đổi SĐT phụ huynh của một sinh viên (theo quan hệ bố/mẹ/giám hộ):
   * gỡ liên kết khỏi tài khoản cũ (vô hiệu hóa nếu không còn con nào), rồi liên kết vào tài khoản của SĐT mới (tạo nếu chưa có).
   */
  async changeParentPhone(adminId: string, d: { studentId: string; relation: ParentRelation; phone: string; note?: string }) {
    const phone = d.phone.replace(/[\s.-]/g, '');
    if (!PHONE.test(phone)) throw new AppException('VALIDATION_ERROR', 'SĐT gồm 10 số, bắt đầu 03/05/07/08/09');
    const st = await this.prisma.student.findUnique({ where: { id: d.studentId } });
    if (!st) throw notFound('Sinh viên');
    if (st.phone === phone) throw new AppException('VALIDATION_ERROR', 'SĐT phụ huynh không được trùng SĐT của sinh viên');
    const owner = await this.prisma.student.findFirst({ where: { phone } });
    if (owner) throw new AppException('CONFLICT', `SĐT này là số của sinh viên ${owner.studentCode}`, HttpStatus.CONFLICT);
    const old = await this.prisma.parentStudent.findUnique({ where: { studentId_relation: { studentId: st.id, relation: d.relation } }, include: { parent: true } });
    if (old?.parent.phone === phone) throw new AppException('VALIDATION_ERROR', 'SĐT mới giống SĐT hiện tại');
    const field = { FATHER: 'fatherPhone', MOTHER: 'motherPhone', GUARDIAN: 'guardianPhone' } as const;
    let created = false;
    let disabled = false;
    await this.prisma.$transaction(async (tx) => {
      if (old) {
        await tx.parentStudent.delete({ where: { studentId_relation: { studentId: st.id, relation: d.relation } } });
        if (!(await tx.parentStudent.count({ where: { parentId: old.parentId } }))) {
          await tx.user.update({ where: { id: old.parent.userId }, data: { status: 'DISABLED' } });
          disabled = true;
        }
      }
      let parent = await tx.parent.findUnique({ where: { phone }, include: { user: true } });
      if (!parent) {
        if (await tx.user.findUnique({ where: { username: phone } })) throw new AppException('CONFLICT', 'SĐT mới đang là tên đăng nhập của tài khoản khác', HttpStatus.CONFLICT);
        const user = await tx.user.create({ data: { username: phone, role: 'PARENT', passwordHash: await argon2.hash(phone), mustChangePassword: true } });
        parent = await tx.parent.create({ data: { userId: user.id, phone }, include: { user: true } });
        created = true;
      } else if (parent.user.status === 'DISABLED') {
        await tx.user.update({ where: { id: parent.userId }, data: { status: 'ACTIVE' } });
      }
      await tx.parentStudent.create({ data: { parentId: parent.id, studentId: st.id, relation: d.relation } });
      await tx.student.update({ where: { id: st.id }, data: { [field[d.relation]]: phone } });
    });
    const label = { FATHER: 'bố', MOTHER: 'mẹ', GUARDIAN: 'người giám hộ' }[d.relation];
    await this.audit.log({
      actorId: adminId,
      action: 'CHANGE_PARENT_PHONE',
      entityType: 'student',
      entityId: st.id,
      summary: `Đổi SĐT ${label} của ${st.studentCode}: ${old?.parent.phone ?? '—'} → ${phone}${d.note ? ` – ${d.note}` : ''}`,
    });
    return { ok: true, created, disabledOld: disabled };
  }
}
