import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppException, notFound } from '../../common/errors/app-exception';
import { AuditService } from '../../common/audit/audit.service';
import { DEFAULT_CONFIG, SystemConfigService, SystemConfigValue } from '../../common/config/system-config.service';
import { MailService } from '../../infra/mail/mail.service';
import { env } from '../../config/env';
import { tempPassword } from './admin-users.service';

const DAY = 86_400_000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const login = `${env.WEB_ORIGIN.replace(/\/$/, '')}/login`;

export interface EnterpriseInput {
  name: string;
  taxCode: string;
  field: string;
  website?: string;
  contactName: string;
  phone: string;
  email: string;
}

/** UC02.7 doanh nghiệp, UC02.11 tổng quan, UC02.12 nhật ký, UC02.13 cấu hình. */
@Injectable()
export class AdminSystemService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: SystemConfigService,
    private readonly mail: MailService,
  ) {}

  // ================================================================ tổng quan (Admin_Dashboard)

  /**
   * Tổng quan Admin: hệ thống là kho lưu bài nộp (không quản lý đào tạo) nên chỉ theo dõi
   * việc cần duyệt, an toàn lưu trữ (đồng bộ Drive, kết nối của GV) và kết nối doanh nghiệp.
   */
  async dashboard() {
    const now = new Date();
    const weeksFrom = startOfDay(new Date(now.getTime() - 7 * 8 * DAY + DAY));
    const semester = await this.prisma.semester.findFirst({ where: { isCurrent: true } });
    const [students, discoverable, withWork, lecturers, entActive, entPending, viewPending, grants, gradeReq, driveLinks, failedFiles, subs, storage, sync, views] = await Promise.all([
      this.prisma.student.count(),
      this.prisma.student.count({ where: { discoverable: true } }),
      this.prisma.student.count({ where: { OR: [{ submissions: { some: {} } }, { groupMembers: { some: { group: { submissions: { some: { kind: 'GROUP_SHARED' } } } } } }] } }),
      semester
        ? this.prisma.courseSection.findMany({ where: { semesterId: semester.id }, distinct: ['lecturerId'], select: { lecturerId: true } })
        : this.prisma.lecturer.findMany({ select: { id: true } }).then((l) => l.map((x) => ({ lecturerId: x.id }))),
      this.prisma.enterprise.count({ where: { user: { status: 'ACTIVE' } } }),
      this.prisma.enterprise.count({ where: { user: { status: 'PENDING' } } }),
      this.prisma.viewRequest.count({ where: { status: 'PENDING' } }),
      this.prisma.viewRequest.count({ where: { status: 'APPROVED', expiresAt: { gt: now } } }),
      this.prisma.gradeChangeRequest.count({ where: { status: 'PENDING' } }),
      this.prisma.lecturerDriveLink.findMany({ select: { lecturerId: true, status: true, lecturer: { select: { code: true, fullName: true } } } }),
      this.prisma.submissionFile.count({ where: { deletedAt: null, syncStatus: { in: ['FAILED', 'MISSING'] } } }),
      this.prisma.submission.findMany({ where: { submittedAt: { gte: weeksFrom } }, select: { submittedAt: true } }),
      this.prisma.submissionFile.groupBy({ by: ['fileType'], where: { deletedAt: null }, _sum: { sizeBytes: true }, _count: { _all: true } }),
      this.prisma.submissionFile.groupBy({ by: ['syncStatus'], where: { deletedAt: null }, _count: { _all: true } }),
      this.prisma.enterpriseView.findMany({ where: { createdAt: { gte: new Date(now.getTime() - 30 * DAY) } }, select: { studentId: true, enterpriseId: true } }),
    ]);

    const weeks = Array.from({ length: 8 }, (_, i) => {
      const from = new Date(weeksFrom.getTime() + i * 7 * DAY);
      return { from, count: subs.filter((s) => s.submittedAt >= from && s.submittedAt < new Date(from.getTime() + 7 * DAY)).length };
    });
    const syncCount = (s: string) => sync.find((x) => x.syncStatus === s)?._count._all ?? 0;
    // GV đang có lớp trong học kỳ: chưa liên kết Drive hoặc liên kết lỗi → bài nộp không lên được Drive
    const lecturerIds = new Set(lecturers.map((l) => l.lecturerId));
    const linked = driveLinks.filter((d) => lecturerIds.has(d.lecturerId) && d.status === 'OK').length;
    const driveErrors = driveLinks.filter((d) => d.status !== 'OK');

    return {
      semester: semester?.code ?? null,
      todo: { enterprisesPending: entPending, viewRequests: viewPending, gradeRequests: gradeReq, driveErrors: driveErrors.map((d) => ({ code: d.lecturer.code, fullName: d.lecturer.fullName, status: d.status })), failedFiles },
      drive: { lecturers: lecturerIds.size, linked },
      weeks,
      storage: storage.map((s) => ({ fileType: s.fileType, bytes: Number(s._sum.sizeBytes ?? 0), files: s._count._all })),
      sync: { synced: syncCount('SYNCED'), pending: syncCount('PENDING') + syncCount('UPLOADING'), failed: syncCount('FAILED') + syncCount('MISSING') },
      enterprise: {
        students,
        withWork,
        discoverable,
        active: entActive,
        grants,
        views30d: { views: views.length, students: new Set(views.map((v) => v.studentId)).size, enterprises: new Set(views.map((v) => v.enterpriseId)).size },
      },
    };
  }

  // ================================================================ doanh nghiệp (UC01.8, UC02.7)

  private checkEnterprise(d: EnterpriseInput) {
    if (!/^\d{10}(-\d{3})?$/.test(d.taxCode)) throw new AppException('VALIDATION_ERROR', 'Mã số thuế gồm 10 số (hoặc 10 số-3 số)');
    if (!/^(03|05|07|08|09)\d{8}$/.test(d.phone)) throw new AppException('VALIDATION_ERROR', 'SĐT gồm 10 số, bắt đầu 03/05/07/08/09');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) throw new AppException('VALIDATION_ERROR', 'Email không hợp lệ');
  }

  /**
   * Doanh nghiệp liên hệ khoa bên ngoài hệ thống → Admin tạo tài khoản (đăng nhập bằng email),
   * mật khẩu tạm gửi qua email và hiện cho Admin; DN phải đổi mật khẩu ở lần đăng nhập đầu.
   */
  async createEnterprise(adminId: string, input: EnterpriseInput) {
    const d = { ...input, taxCode: input.taxCode.replace(/\s/g, ''), email: input.email.trim().toLowerCase(), phone: input.phone.replace(/[\s.-]/g, '') };
    this.checkEnterprise(d);
    const dup = await this.prisma.enterprise.findFirst({ where: { OR: [{ taxCode: d.taxCode }, { email: d.email }] } });
    if (dup) throw new AppException('CONFLICT', dup.taxCode === d.taxCode ? 'Mã số thuế đã có tài khoản' : 'Email đã có tài khoản', HttpStatus.CONFLICT);
    if (await this.prisma.user.findFirst({ where: { username: d.email } })) throw new AppException('CONFLICT', 'Email đã được dùng cho tài khoản khác', HttpStatus.CONFLICT);
    const pw = tempPassword();
    const user = await this.prisma.user.create({
      data: {
        username: d.email,
        email: d.email,
        passwordHash: await argon2.hash(pw),
        role: 'ENTERPRISE',
        status: 'ACTIVE',
        mustChangePassword: true,
        enterprise: { create: { name: d.name.trim(), taxCode: d.taxCode, email: d.email, contactName: d.contactName.trim(), phone: d.phone, field: d.field.trim(), website: d.website?.trim() || null, approvedAt: new Date() } },
      },
    });
    await this.mail.send({
      to: d.email,
      subject: 'Tài khoản doanh nghiệp FrameUp',
      text: `Kính gửi ${d.contactName.trim()} – ${d.name.trim()},\nKhoa đã tạo tài khoản để doanh nghiệp tìm kiếm sinh viên trên FrameUp.\nTên đăng nhập: ${d.email}\nMật khẩu tạm thời: ${pw}\nVui lòng đổi mật khẩu ở lần đăng nhập đầu tiên.`,
      action: { label: 'Đăng nhập', url: login },
    });
    await this.audit.log({ actorId: adminId, action: 'CREATE_ACCOUNT', entityType: 'enterprise', entityId: user.id, summary: `Tạo tài khoản doanh nghiệp ${d.name.trim()} (MST ${d.taxCode})` });
    return { ok: true, username: d.email, tempPassword: pw };
  }

  async updateEnterprise(adminId: string, id: string, input: EnterpriseInput) {
    const e = await this.prisma.enterprise.findUnique({ where: { id } });
    if (!e) throw notFound('Doanh nghiệp');
    const d = { ...input, taxCode: input.taxCode.replace(/\s/g, ''), email: input.email.trim().toLowerCase(), phone: input.phone.replace(/[\s.-]/g, '') };
    this.checkEnterprise(d);
    const dup = await this.prisma.enterprise.findFirst({ where: { id: { not: id }, OR: [{ taxCode: d.taxCode }, { email: d.email }] } });
    if (dup) throw new AppException('CONFLICT', dup.taxCode === d.taxCode ? 'Mã số thuế đã có tài khoản' : 'Email đã có tài khoản', HttpStatus.CONFLICT);
    if (d.email !== e.email && (await this.prisma.user.findFirst({ where: { username: d.email, id: { not: e.userId } } }))) throw new AppException('CONFLICT', 'Email đã được dùng cho tài khoản khác', HttpStatus.CONFLICT);
    await this.prisma.enterprise.update({ where: { id }, data: { name: d.name.trim(), taxCode: d.taxCode, email: d.email, contactName: d.contactName.trim(), phone: d.phone, field: d.field.trim(), website: d.website?.trim() || null } });
    // email cũng là tên đăng nhập
    await this.prisma.user.update({ where: { id: e.userId }, data: { username: d.email, email: d.email } });
    await this.audit.log({ actorId: adminId, action: 'UPDATE_ACCOUNT', entityType: 'enterprise', entityId: e.userId, summary: `Sửa thông tin doanh nghiệp ${d.name.trim()}` });
    return { ok: true };
  }

  async enterprises() {
    const list = await this.prisma.enterprise.findMany({ include: { user: { select: { id: true, status: true, lastLoginAt: true } } }, orderBy: { createdAt: 'desc' } });
    const taxDup = new Map<string, number>();
    list.forEach((e) => taxDup.set(e.taxCode, (taxDup.get(e.taxCode) ?? 0) + 1));
    return list.map((e) => ({
      id: e.id,
      userId: e.userId,
      name: e.name,
      taxCode: e.taxCode,
      email: e.email,
      contactName: e.contactName,
      phone: e.phone,
      field: e.field,
      website: e.website,
      rejectReason: e.rejectReason,
      createdAt: e.createdAt,
      approvedAt: e.approvedAt,
      status: e.user.status,
      lastLoginAt: e.user.lastLoginAt,
      checks: { taxCode: /^\d{10}(-\d{3})?$/.test(e.taxCode), businessEmail: !/@(gmail|yahoo|outlook|hotmail)\./i.test(e.email), website: !!e.website },
    }));
  }

  async decideEnterprise(adminId: string, id: string, action: 'approve' | 'reject' | 'lock' | 'unlock', reason?: string) {
    const e = await this.prisma.enterprise.findUnique({ where: { id }, include: { user: true } });
    if (!e) throw notFound('Doanh nghiệp');
    const st = e.user.status;
    if ((action === 'approve' || action === 'reject') && st !== 'PENDING') throw new AppException('CONFLICT', 'Hồ sơ không còn ở trạng thái chờ duyệt', HttpStatus.CONFLICT);
    if (action === 'reject' && !reason?.trim()) throw new AppException('VALIDATION_ERROR', 'Nhập lý do từ chối');
    if (action === 'lock' && st !== 'ACTIVE') throw new AppException('CONFLICT', 'Chỉ khóa được tài khoản đang hoạt động', HttpStatus.CONFLICT);
    if (action === 'unlock' && st !== 'LOCKED') throw new AppException('CONFLICT', 'Tài khoản không bị khóa', HttpStatus.CONFLICT);
    const status = { approve: 'ACTIVE', reject: 'REJECTED', lock: 'LOCKED', unlock: 'ACTIVE' }[action] as 'ACTIVE' | 'REJECTED' | 'LOCKED';
    await this.prisma.user.update({ where: { id: e.userId }, data: { status } });
    await this.prisma.enterprise.update({
      where: { id },
      data: action === 'approve' ? { approvedAt: new Date(), rejectReason: null } : action === 'reject' ? { rejectReason: reason!.trim() } : {},
    });
    const label = { approve: 'Duyệt', reject: 'Từ chối', lock: 'Khóa', unlock: 'Mở khóa' }[action];
    await this.audit.log({ actorId: adminId, action: `ENTERPRISE_${action.toUpperCase()}`, entityType: 'enterprise', entityId: id, summary: `${label} doanh nghiệp ${e.name}${reason ? ` – ${reason}` : ''}` });
    if (action === 'approve') await this.mail.send({ to: e.email, subject: 'Tài khoản doanh nghiệp đã được duyệt', text: `Tài khoản của ${e.name} đã được kích hoạt. Đăng nhập bằng email ${e.email} và mật khẩu đã đăng ký.`, action: { label: 'Đăng nhập', url: login } });
    if (action === 'reject') await this.mail.send({ to: e.email, subject: 'Đăng ký doanh nghiệp chưa được duyệt', text: `Đăng ký của ${e.name} chưa được duyệt.\nLý do: ${reason}\nBạn có thể chỉnh lại thông tin và đăng ký lại.` });
    return { ok: true };
  }

  /** Admin_DNStats – thống kê doanh nghiệp (hoạt động xem hồ sơ chưa có dữ liệu ở bản này). */
  async enterpriseStats() {
    const list = await this.prisma.enterprise.findMany({ include: { user: { select: { status: true } } } });
    const by = <K extends string>(f: (e: (typeof list)[number]) => K) => {
      const m = new Map<K, number>();
      list.forEach((e) => m.set(f(e), (m.get(f(e)) ?? 0) + 1));
      return [...m.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
    };
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, i) => {
      const from = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      const to = new Date(from.getFullYear(), from.getMonth() + 1, 1);
      return { month: `${String(from.getMonth() + 1).padStart(2, '0')}/${from.getFullYear()}`, count: list.filter((e) => e.createdAt >= from && e.createdAt < to).length };
    });
    return { total: list.length, byStatus: by((e) => e.user.status), byField: by((e) => e.field), months, viewRequests: [], searches: [], topStudents: [] };
  }

  // ================================================================ nhật ký (UC02.12)

  async logs(q: { role?: UserRole; action?: string; from?: string; to?: string; q?: string; page?: number }) {
    const page = Math.max(1, q.page ?? 1);
    const size = 30;
    const where: Prisma.AuditLogWhereInput = {
      ...(q.role ? { actor: { role: q.role } } : {}),
      ...(q.action ? { action: q.action } : {}),
      ...(q.from || q.to ? { createdAt: { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lt: new Date(new Date(q.to).getTime() + DAY) } : {}) } } : {}),
      ...(q.q ? { OR: [{ summary: { contains: q.q } }, { actor: { username: { contains: q.q } } }] } : {}),
    };
    const [total, rows, actions] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        include: { actor: { select: { username: true, role: true, lecturer: { select: { fullName: true } }, student: { select: { fullName: true } }, enterprise: { select: { name: true } } } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * size,
        take: size,
      }),
      this.prisma.auditLog.groupBy({ by: ['action'], _count: { _all: true }, orderBy: { action: 'asc' } }),
    ]);
    return {
      total,
      page,
      pages: Math.max(1, Math.ceil(total / size)),
      actions: actions.map((a) => a.action),
      rows: rows.map((r) => ({
        id: String(r.id),
        createdAt: r.createdAt,
        action: r.action,
        entityType: r.entityType,
        entityId: r.entityId,
        summary: r.summary,
        oldData: r.oldData,
        newData: r.newData,
        actor: r.actor ? { username: r.actor.username, role: r.actor.role, name: r.actor.lecturer?.fullName ?? r.actor.student?.fullName ?? r.actor.enterprise?.name ?? (r.actor.role === 'ADMIN' ? 'Quản trị viên' : r.actor.username) } : null,
      })),
    };
  }

  // ================================================================ cấu hình (UC02.13)

  async getConfig() {
    const row = await this.prisma.systemConfig.findUnique({ where: { key: 'main' } });
    return { value: await this.config.get(), defaults: DEFAULT_CONFIG, updatedAt: row?.updatedAt ?? null };
  }

  async saveConfig(adminId: string, value: SystemConfigValue) {
    const scale = [...value.grading.scale].sort((a, b) => b[0] - a[0]);
    if (!scale.length || scale[scale.length - 1][0] !== 0) throw new AppException('VALIDATION_ERROR', 'Thang điểm phải có mức bắt đầu từ 0');
    if (new Set(scale.map((r) => r[1])).size !== scale.length) throw new AppException('VALIDATION_ERROR', 'Điểm chữ bị trùng');
    if (value.enterprise.viewDaysMin > value.enterprise.viewDaysMax) throw new AppException('VALIDATION_ERROR', 'Số ngày xem tối thiểu không được lớn hơn tối đa');
    const before = await this.config.get();
    const saved = await this.config.save({ ...value, grading: { ...value.grading, scale } }, adminId);
    const changed = (Object.keys(saved) as (keyof SystemConfigValue)[]).filter((k) => JSON.stringify(saved[k]) !== JSON.stringify(before[k]));
    await this.audit.log({ actorId: adminId, action: 'UPDATE_CONFIG', entityType: 'system_config', entityId: 'main', summary: `Cập nhật cấu hình: ${changed.join(', ') || 'không đổi'}`, oldData: before, newData: saved });
    return { value: saved };
  }
}
