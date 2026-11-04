import { Body, Controller, Get, HttpCode, HttpStatus, Injectable, Module, Post, Req, Res } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { Request, Response } from 'express';
import { z } from 'zod';
import { env } from '../../config/env';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppException } from '../../common/errors/app-exception';
import { AllowMustChange, AuthUser, Public } from '../../common/auth/auth.decorators';
import { createHash, randomBytes } from 'node:crypto';
import { MailService } from '../../infra/mail/mail.service';
import { SystemConfigService } from '../../common/config/system-config.service';
import { AuditService } from '../../common/audit/audit.service';
import { ACCESS_COOKIE } from '../../common/auth/auth.guards';
import { ZodPipe } from '../../common/pipes/zod.pipe';


const loginSchema = z.object({
  username: z.string().trim().min(1, 'Nhập tên đăng nhập'),
  password: z.string().min(1, 'Nhập mật khẩu'),
});
type LoginDto = z.infer<typeof loginSchema>;
const forgotSchema = z.object({ username: z.string().trim().min(1, 'Nhập tên đăng nhập') });
export const newPassword = z
  .string()
  .min(8, 'Mật khẩu tối thiểu 8 ký tự')
  .max(100)
  .refine((v) => /[a-zA-Z]/.test(v) && /\d/.test(v), 'Mật khẩu phải có cả chữ và số');
const resetSchema = z.object({ token: z.string().min(20), password: newPassword });
const RESET_MINUTES = 30;
const sha = (t: string) => createHash('sha256').update(t).digest('hex');
const mask = (email: string) => email.replace(/^(.)(.*)(.@.*)$/, (_m, a: string, b: string, c: string) => `${a}${'*'.repeat(Math.min(b.length, 6))}${c}`);

/** Ký JWT + đặt cookie (dùng khi đăng nhập và khi đổi mật khẩu lần đầu). */
export function signIn(jwt: JwtService, res: Response, claims: AuthUser) {
  const { iat: _i, exp: _e, ...clean } = claims as AuthUser & { iat?: number; exp?: number };
  res.cookie(ACCESS_COOKIE, jwt.sign(clean), { httpOnly: true, secure: env.COOKIE_SECURE, sameSite: 'lax', path: '/', maxAge: 8 * 3600 * 1000 });
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
    private readonly config: SystemConfigService,
  ) {}

  /** UC01.5 – gửi liên kết đặt lại mật khẩu (30 phút, dùng 1 lần) tới email đã khai báo. */
  async forgot(username: string) {
    const user = await this.prisma.user.findFirst({
      where: { username: { equals: username } },
      include: { student: { select: { email: true } }, lecturer: { select: { email: true } } },
    });
    const email = user?.student?.email ?? user?.lecturer?.email ?? user?.email;
    if (!user || !email || user.status !== 'ACTIVE') return { sent: false, email: null, minutes: RESET_MINUTES };
    const token = randomBytes(32).toString('base64url');
    await this.prisma.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
    await this.prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash: sha(token), expiresAt: new Date(Date.now() + RESET_MINUTES * 60_000) } });
    await this.mail.send({
      to: email,
      subject: 'Đặt lại mật khẩu FrameUp',
      text: `Bạn (hoặc ai đó) vừa yêu cầu đặt lại mật khẩu cho tài khoản ${user.username}.\nLiên kết có hiệu lực trong ${RESET_MINUTES} phút và chỉ dùng được một lần. Nếu không phải bạn, hãy bỏ qua thư này.`,
      action: { label: 'Đặt lại mật khẩu', url: `${env.WEB_ORIGIN.replace(/\/$/, '')}/reset-password?token=${token}` },
    });
    return { sent: true, email: mask(email), minutes: RESET_MINUTES };
  }

  async reset(token: string, password: string) {
    const row = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash: sha(token) } });
    if (!row || row.usedAt || row.expiresAt < new Date())
      throw new AppException('AUTH_TOKEN_INVALID', 'Liên kết đã hết hạn hoặc đã được dùng. Hãy gửi yêu cầu mới.', HttpStatus.BAD_REQUEST);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: row.userId }, data: { passwordHash: await argon2.hash(password), mustChangePassword: false, failedLoginCount: 0, lockedUntil: null } }),
      this.prisma.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    ]);
    await this.audit.log({ actorId: row.userId, action: 'PASSWORD_RESET', entityType: 'user', entityId: row.userId, summary: 'Đặt lại mật khẩu qua email' });
    return { ok: true };
  }

  /** UC01.1 – đăng nhập; sai 5 lần liên tiếp khóa 15 phút (FR-01.02). */
  async login({ username, password }: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: { username: { equals: username } },
      include: { lecturer: true, student: true, parent: true, enterprise: true },
    });
    const invalid = new AppException('AUTH_INVALID_CREDENTIALS', 'Tên đăng nhập hoặc mật khẩu không đúng', HttpStatus.UNAUTHORIZED);
    if (!user) throw invalid;

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      throw new AppException('AUTH_TEMP_LOCKED', `Tài khoản tạm khóa, thử lại sau ${minutes} phút`, HttpStatus.UNAUTHORIZED);
    }
    if (user.status !== 'ACTIVE') {
      const msg = { PENDING: 'Tài khoản đang chờ Quản trị viên duyệt', REJECTED: 'Đăng ký doanh nghiệp đã bị từ chối', DISABLED: 'Tài khoản đã bị vô hiệu hóa' }[user.status as string] ?? 'Tài khoản đang bị khóa';
      throw new AppException('AUTH_ACCOUNT_LOCKED', msg, HttpStatus.FORBIDDEN);
    }

    if (!(await argon2.verify(user.passwordHash, password))) {
      const { maxFailed: MAX_FAILED, lockMinutes: LOCK_MINUTES } = (await this.config.get()).security;
      const count = user.failedLoginCount + 1;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: count >= MAX_FAILED ? 0 : count,
          lockedUntil: count >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60000) : null,
        },
      });
      throw invalid;
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });
    await this.audit.log({ actorId: user.id, action: 'LOGIN', entityType: 'user', entityId: user.id, summary: 'Đăng nhập thành công' });

    const claims: AuthUser = {
      sub: user.id,
      role: user.role,
      name: user.lecturer?.fullName ?? user.student?.fullName ?? user.enterprise?.name ?? user.parent?.fullName ?? (user.role === 'ADMIN' ? 'Quản trị viên' : user.username),
      lecturerId: user.lecturer?.id,
      studentId: user.student?.id,
      code: user.lecturer?.code ?? user.student?.studentCode,
      ...(user.mustChangePassword ? { mcp: true } : {}),
    };
    return { token: this.jwt.sign(claims), user: claims };
  }
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(@Body(new ZodPipe(loginSchema)) dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { user } = await this.auth.login(dto);
    signIn(this.jwt, res, user);
    return { user };
  }

  @Public()
  @Post('forgot')
  @HttpCode(200)
  forgot(@Body(new ZodPipe(forgotSchema)) dto: { username: string }) {
    return this.auth.forgot(dto.username);
  }

  @Public()
  @Post('reset')
  @HttpCode(200)
  reset(@Body(new ZodPipe(resetSchema)) dto: { token: string; password: string }) {
    return this.auth.reset(dto.token, dto.password);
  }

  @AllowMustChange()
  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(ACCESS_COOKIE, { path: '/' });
    return { ok: true };
  }

  /** Trả user hiện tại, hoặc null khi chưa đăng nhập (không trả 401 để FE kiểm tra phiên nhẹ nhàng). */
  @Public()
  @Get('me')
  async me(@Req() req: Request) {
    const token = req.cookies?.[ACCESS_COOKIE];
    if (!token) return { user: null };
    let user: AuthUser;
    try {
      user = this.jwt.verify<AuthUser>(token);
    } catch {
      return { user: null };
    }
    const u = await this.prisma.user.findUnique({ where: { id: user.sub }, select: { mustChangePassword: true, status: true } });
    if (!u || u.status !== 'ACTIVE') return { user: null };
    user = { ...user, mcp: u.mustChangePassword || undefined };
    // SV chưa khai báo hồ sơ thì giao diện chuyển tới trang hồ sơ (FR-03.01)
    if (user.studentId) {
      const s = await this.prisma.student.findUnique({ where: { id: user.studentId }, select: { profileCompletedAt: true, avatarPath: true, updatedAt: true } });
      return { user: { ...user, profileCompleted: !!s?.profileCompletedAt, hasAvatar: !!s?.avatarPath, avatarVersion: s?.updatedAt.getTime() } };
    }
    return { user };
  }
}

@Module({
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
