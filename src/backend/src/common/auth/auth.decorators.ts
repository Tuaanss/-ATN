import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

/** Nội dung access token (claim) – xem docs/Architecture.md §7. */
export interface AuthUser {
  sub: string; // users.id
  role: UserRole;
  name: string;
  lecturerId?: string;
  studentId?: string;
  /** Mã GV hoặc MSV */
  code?: string;
  /** Tài khoản do hệ thống cấp, chưa đổi mật khẩu lần đầu (FR-01.03) */
  mcp?: boolean;
}

export const ALLOW_MUST_CHANGE = 'allowMustChange';
/** Route vẫn gọi được khi chưa đổi mật khẩu lần đầu (đổi mật khẩu, đăng xuất). */
export const AllowMustChange = () => SetMetadata(ALLOW_MUST_CHANGE, true);

export const IS_PUBLIC = 'isPublic';
export const ROLES = 'roles';

/** Bỏ qua JwtAuthGuard (đăng nhập, health). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Giới hạn vai trò được gọi endpoint. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES, roles);

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest().user;
});
