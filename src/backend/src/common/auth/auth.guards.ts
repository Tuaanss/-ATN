import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import { Request } from 'express';
import { AppException, forbidden } from '../errors/app-exception';
import { ALLOW_MUST_CHANGE, AuthUser, IS_PUBLIC, ROLES } from './auth.decorators';

export const ACCESS_COOKIE = 'access_token';

/** Đọc JWT từ cookie httpOnly `access_token`. Áp dụng toàn cục trừ route @Public. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const token = req.cookies?.[ACCESS_COOKIE];
    if (!token) throw new AppException('UNAUTHENTICATED', 'Vui lòng đăng nhập', HttpStatus.UNAUTHORIZED);
    try {
      req.user = this.jwt.verify<AuthUser>(token);
    } catch {
      throw new AppException('UNAUTHENTICATED', 'Phiên đăng nhập đã hết hạn', HttpStatus.UNAUTHORIZED);
    }
    // FR-01.03: chưa đổi mật khẩu lần đầu thì chỉ gọi được API đổi mật khẩu và đăng xuất
    if (req.user.mcp && !this.reflector.getAllAndOverride<boolean>(ALLOW_MUST_CHANGE, [ctx.getHandler(), ctx.getClass()]))
      throw new AppException('AUTH_MUST_CHANGE_PASSWORD', 'Bạn cần đổi mật khẩu trước khi tiếp tục', HttpStatus.FORBIDDEN);
    return true;
  }
}

/** Kiểm tra vai trò theo @Roles(). */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES, [ctx.getHandler(), ctx.getClass()]);
    if (!roles?.length) return true;
    const user = ctx.switchToHttp().getRequest().user as AuthUser | undefined;
    if (!user || !roles.includes(user.role)) throw forbidden();
    return true;
  }
}
