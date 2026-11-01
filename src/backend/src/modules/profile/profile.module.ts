import { Body, Controller, Get, HttpStatus, Injectable, Module, Param, ParseUUIDPipe, Post, Put, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ParentRelation } from '@prisma/client';
import * as argon2 from 'argon2';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { env } from '../../config/env';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppException, notFound } from '../../common/errors/app-exception';
import { AuditService } from '../../common/audit/audit.service';
import { AllowMustChange, AuthUser, CurrentUser, Roles } from '../../common/auth/auth.decorators';
import { JwtService } from '@nestjs/jwt';
import { signIn } from '../auth/auth.module';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { detectFileType } from '../../common/utils/files';

/** SĐT Việt Nam: 10 số, đầu 03/05/07/08/09 (BR-01). */
const PHONE = /^(03|05|07|08|09)\d{8}$/;
const phone = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s.-]/g, ''))
  .refine((v) => PHONE.test(v), 'SĐT gồm 10 số, bắt đầu bằng 03, 05, 07, 08 hoặc 09');
const optPhone = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s.-]/g, ''))
  .refine((v) => !v || PHONE.test(v), 'SĐT gồm 10 số, bắt đầu bằng 03, 05, 07, 08 hoặc 09')
  .optional()
  .transform((v) => v || null);
const url = (host: RegExp, label: string) =>
  z
    .string()
    .trim()
    .max(255)
    .refine((v) => !v || (/^https?:\/\//i.test(v) && host.test(v)), `Link ${label} không hợp lệ`)
    .optional()
    .transform((v) => v || null);

export const profileSchema = z
  .object({
    phone,
    email: z.string().trim().toLowerCase().email('Email không hợp lệ').max(255),
    fatherPhone: optPhone,
    motherPhone: optPhone,
    guardianPhone: optPhone,
    noParentReason: z.string().trim().max(255).optional().transform((v) => v || null),
    discoverable: z.boolean().default(false),
    bio: z.string().trim().max(1000).optional().transform((v) => v || null),
    skills: z.array(z.string().trim().min(1).max(40)).max(15, 'Tối đa 15 kỹ năng').default([]),
    githubUrl: url(/github\.com|gitlab\.com/i, 'GitHub'),
    behanceUrl: url(/behance\.net/i, 'Behance'),
    linkedinUrl: url(/linkedin\.com/i, 'LinkedIn'),
  })
  .superRefine((v, ctx) => {
    const parents = [['fatherPhone', v.fatherPhone], ['motherPhone', v.motherPhone], ['guardianPhone', v.guardianPhone]] as const;
    for (const [key, p] of parents) if (p && p === v.phone) ctx.addIssue({ code: 'custom', path: [key], message: 'Trùng với SĐT của bạn. Vui lòng nhập số khác.' });
    if (!parents.some(([, p]) => p) && !v.noParentReason)
      ctx.addIssue({ code: 'custom', path: ['fatherPhone'], message: 'Nhập ít nhất một SĐT phụ huynh / người giám hộ, hoặc chọn lý do không có' });
  });
export type ProfileDto = z.infer<typeof profileSchema>;

const passwordSchema = z
  .object({
    current: z.string().min(1, 'Nhập mật khẩu hiện tại'),
    next: z
      .string()
      .min(8, 'Mật khẩu mới tối thiểu 8 ký tự')
      .max(100)
      .refine((v) => /[a-zA-Z]/.test(v) && /\d/.test(v), 'Mật khẩu mới phải có cả chữ và số'),
  })
  .refine((v) => v.current !== v.next, { path: ['next'], message: 'Mật khẩu mới phải khác mật khẩu cũ' });

const REL: { rel: ParentRelation; key: 'fatherPhone' | 'motherPhone' | 'guardianPhone'; label: string }[] = [
  { rel: 'FATHER', key: 'fatherPhone', label: 'Bố' },
  { rel: 'MOTHER', key: 'motherPhone', label: 'Mẹ' },
  { rel: 'GUARDIAN', key: 'guardianPhone', label: 'Người giám hộ' },
];
const AVATAR_DIR = () => path.join(env.DATA_DIR, 'avatars');

/** Hồ sơ sinh viên – UC03.1–3.4. */
@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async get(studentId: string) {
    const s = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: { user: true, parents: { include: { parent: { include: { user: true } } } } },
    });
    if (!s) throw notFound('Sinh viên');
    const parentPhones = [s.fatherPhone, s.motherPhone, s.guardianPhone].filter(Boolean);
    return {
      studentCode: s.studentCode,
      fullName: s.fullName,
      dateOfBirth: s.dateOfBirth,
      cohort: s.cohort,
      major: s.major,
      phone: s.phone,
      email: s.email,
      fatherPhone: s.fatherPhone,
      motherPhone: s.motherPhone,
      guardianPhone: s.guardianPhone,
      noParentReason: s.noParentReason,
      discoverable: s.discoverable,
      hasAvatar: !!s.avatarPath,
      avatarVersion: s.updatedAt.getTime(),
      bio: s.bio,
      skills: s.skills,
      githubUrl: s.githubUrl,
      behanceUrl: s.behanceUrl,
      linkedinUrl: s.linkedinUrl,
      profileCompletedAt: s.profileCompletedAt,
      account: { username: s.user.username, lastLoginAt: s.user.lastLoginAt, mustChangePassword: s.user.mustChangePassword },
      parents: REL.flatMap(({ rel, label }) => {
        const l = s.parents.find((p) => p.relation === rel);
        return l ? [{ relation: rel, label, phone: l.parent.phone, mustChangePassword: l.parent.user.mustChangePassword, active: l.parent.user.status === 'ACTIVE' }] : [];
      }),
      checklist: {
        phone: !!s.phone,
        email: !!s.email,
        parent: parentPhones.length > 0 || !!s.noParentReason,
        password: !s.user.mustChangePassword,
      },
    };
  }

  /** UC03.1 / UC03.2 – lưu hồ sơ + UC03.3 đồng bộ tài khoản phụ huynh trong cùng transaction. */
  async save(studentId: string, userId: string, dto: ProfileDto) {
    const s = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!s) throw notFound('Sinh viên');
    // BR-01: SĐT và email của SV là duy nhất
    const dup = await this.prisma.student.findFirst({
      where: { id: { not: studentId }, OR: [{ phone: dto.phone }, { email: { equals: dto.email } }] },
    });
    if (dup) throw new AppException('CONFLICT', dup.phone === dto.phone ? 'SĐT này đã được sinh viên khác sử dụng' : 'Email này đã được sinh viên khác sử dụng', HttpStatus.CONFLICT);

    const hasParent = !!(dto.fatherPhone || dto.motherPhone || dto.guardianPhone);
    const changes: string[] = [];
    const created: string[] = [];
    await this.prisma.$transaction(
      async (tx) => {
        await tx.student.update({
          where: { id: studentId },
          data: {
            phone: dto.phone,
            email: dto.email,
            fatherPhone: dto.fatherPhone,
            motherPhone: dto.motherPhone,
            guardianPhone: dto.guardianPhone,
            noParentReason: hasParent ? null : dto.noParentReason,
            discoverable: dto.discoverable,
            bio: dto.bio,
            skills: dto.skills.filter((k, i) => dto.skills.findIndex((x) => x.toLowerCase() === k.toLowerCase()) === i),
            githubUrl: dto.githubUrl,
            behanceUrl: dto.behanceUrl,
            linkedinUrl: dto.linkedinUrl,
            profileCompletedAt: s.profileCompletedAt ?? new Date(),
          },
        });
        await tx.user.update({ where: { id: userId }, data: { email: dto.email } });

        // ---- UC03.3
        const links = await tx.parentStudent.findMany({ where: { studentId }, include: { parent: true } });
        for (const { rel, key, label } of REL) {
          const next = dto[key];
          const old = links.find((l) => l.relation === rel);
          if (old && old.parent.phone === next) continue;
          if (old) {
            await tx.parentStudent.delete({ where: { studentId_relation: { studentId, relation: rel } } });
            const left = await tx.parentStudent.count({ where: { parentId: old.parentId } });
            if (!left) await tx.user.update({ where: { id: old.parent.userId }, data: { status: 'DISABLED' } });
            changes.push(`${label}: gỡ ${old.parent.phone}`);
          }
          if (!next) continue;
          let parent = await tx.parent.findUnique({ where: { phone: next }, include: { user: true } });
          if (!parent) {
            const taken = await tx.user.findUnique({ where: { username: next } });
            if (taken) throw new AppException('CONFLICT', `SĐT ${next} đang là tên đăng nhập của một tài khoản khác`, HttpStatus.CONFLICT);
            const user = await tx.user.create({
              data: { username: next, role: 'PARENT', passwordHash: await argon2.hash(next), mustChangePassword: true, status: 'ACTIVE' },
            });
            parent = await tx.parent.create({ data: { userId: user.id, phone: next }, include: { user: true } });
            created.push(next);
          } else if (parent.user.status === 'DISABLED') {
            await tx.user.update({ where: { id: parent.userId }, data: { status: 'ACTIVE' } });
          }
          await tx.parentStudent.create({ data: { parentId: parent.id, studentId, relation: rel } });
          changes.push(`${label}: ${next}`);
        }
      },
      { timeout: 30_000 },
    );

    const phoneChanged = s.phone !== dto.phone;
    if (changes.length || phoneChanged || !s.profileCompletedAt)
      await this.audit.log({
        actorId: userId,
        action: s.profileCompletedAt ? 'PROFILE_UPDATE' : 'PROFILE_COMPLETE',
        entityType: 'student',
        entityId: studentId,
        summary: [s.profileCompletedAt ? 'Cập nhật hồ sơ' : 'Khai báo hồ sơ', phoneChanged && s.phone ? `đổi SĐT ${s.phone} → ${dto.phone}` : '', changes.length ? `PH: ${changes.join(', ')}` : ''].filter(Boolean).join(' · '),
      });
    if (s.discoverable !== dto.discoverable)
      await this.audit.log({ actorId: userId, action: 'DISCOVERABLE', entityType: 'student', entityId: studentId, summary: dto.discoverable ? 'Bật cho doanh nghiệp tìm thấy' : 'Tắt cho doanh nghiệp tìm thấy' });
    return { ...(await this.get(studentId)), createdParents: created };
  }

  async uploadAvatar(studentId: string, file: Express.Multer.File) {
    if (file.size > 2 * 1024 * 1024) throw new AppException('FILE_TOO_LARGE', 'Ảnh đại diện tối đa 2 MB');
    const t = detectFileType(file.buffer.subarray(0, 64));
    if (t?.fileType !== 'IMAGE') throw new AppException('FILE_INVALID_TYPE', 'Ảnh đại diện phải là JPG, PNG hoặc WEBP');
    await fs.mkdir(AVATAR_DIR(), { recursive: true });
    const s = await this.prisma.student.findUniqueOrThrow({ where: { id: studentId } });
    if (s.avatarPath) await fs.unlink(s.avatarPath).catch(() => undefined);
    const dest = path.join(AVATAR_DIR(), `${studentId}.${t.mime.split('/')[1] ?? 'img'}`);
    await fs.writeFile(dest, file.buffer);
    await this.prisma.student.update({ where: { id: studentId }, data: { avatarPath: dest } });
    return this.get(studentId);
  }

  async removeAvatar(studentId: string) {
    const s = await this.prisma.student.findUniqueOrThrow({ where: { id: studentId } });
    if (s.avatarPath) await fs.unlink(s.avatarPath).catch(() => undefined);
    await this.prisma.student.update({ where: { id: studentId }, data: { avatarPath: null } });
    return this.get(studentId);
  }

  /** UC01.6 – đổi mật khẩu (phải nhập mật khẩu cũ). */
  async changePassword(userId: string, dto: z.infer<typeof passwordSchema>) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await argon2.verify(u.passwordHash, dto.current)))
      throw new AppException('AUTH_INVALID_CREDENTIALS', 'Mật khẩu hiện tại không đúng', HttpStatus.BAD_REQUEST);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await argon2.hash(dto.next), mustChangePassword: false } });
    await this.audit.log({ actorId: userId, action: 'PASSWORD_CHANGE', entityType: 'user', entityId: userId, summary: 'Đổi mật khẩu' });
    return { ok: true };
  }
}

@Controller('student/profile')
@Roles('STUDENT')
export class StudentProfileController {
  constructor(private readonly service: ProfileService) {}

  @Get()
  get(@CurrentUser() u: AuthUser) {
    return this.service.get(u.studentId!);
  }

  @Put()
  save(@CurrentUser() u: AuthUser, @Body(new ZodPipe(profileSchema)) dto: ProfileDto) {
    return this.service.save(u.studentId!, u.sub, dto);
  }

  @Post('avatar')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 3 * 1024 * 1024 } }))
  avatar(@CurrentUser() u: AuthUser, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new AppException('VALIDATION_ERROR', 'Chọn ảnh đại diện');
    return this.service.uploadAvatar(u.studentId!, file);
  }

  @Post('avatar/remove')
  removeAvatar(@CurrentUser() u: AuthUser) {
    return this.service.removeAvatar(u.studentId!);
  }
}

@Controller('account')
export class AccountController {
  constructor(
    private readonly service: ProfileService,
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /** Đổi mật khẩu (kể cả lần đầu) → ký lại phiên không còn cờ "phải đổi mật khẩu". */
  @AllowMustChange()
  @Post('password')
  async changePassword(@CurrentUser() u: AuthUser, @Body(new ZodPipe(passwordSchema)) dto: z.infer<typeof passwordSchema>, @Res({ passthrough: true }) res: Response) {
    await this.service.changePassword(u.sub, dto);
    signIn(this.jwt, res, { ...u, mcp: undefined });
    return { ok: true };
  }

  /** Thông tin tài khoản (trang Tài khoản & bảo mật). */
  @AllowMustChange()
  @Get('me')
  async me(@CurrentUser() u: AuthUser) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: u.sub }, include: { student: true, lecturer: true, parent: true, enterprise: true } });
    const logins = await this.prisma.auditLog.findMany({ where: { actorId: u.sub, action: { in: ['LOGIN', 'PASSWORD_CHANGE', 'PASSWORD_RESET'] } }, orderBy: { createdAt: 'desc' }, take: 8 });
    return {
      username: user.username,
      role: user.role,
      fullName: user.lecturer?.fullName ?? user.student?.fullName ?? user.parent?.fullName ?? user.enterprise?.name ?? (user.role === 'PARENT' ? 'Phụ huynh' : user.username),
      email: user.lecturer?.email ?? user.student?.email ?? user.email,
      status: user.status,
      lastLoginAt: user.lastLoginAt,
      mustChangePassword: user.mustChangePassword,
      passwordChangedAt: logins.find((l) => l.action !== 'LOGIN')?.createdAt ?? null,
      history: logins.map((l) => ({ action: l.action, at: l.createdAt, summary: l.summary })),
    };
  }

  /** Ảnh đại diện SV – người đã đăng nhập xem được (hiện trong nhóm, danh sách lớp). */
  @Get('avatar/:studentId')
  async avatar(@Param('studentId', ParseUUIDPipe) id: string, @Res() res: Response) {
    const s = await this.prisma.student.findUnique({ where: { id }, select: { avatarPath: true } });
    if (!s?.avatarPath) throw notFound('Ảnh đại diện');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.sendFile(s.avatarPath);
  }
}

@Module({ controllers: [StudentProfileController, AccountController], providers: [ProfileService], exports: [ProfileService] })
export class ProfileModule {}

