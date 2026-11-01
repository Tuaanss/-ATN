import { Body, Controller, Get, Global, Injectable, Module, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { MailService } from '../../infra/mail/mail.service';
import { env } from '../../config/env';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuthUser, CurrentUser } from '../../common/auth/auth.decorators';

/** Nhóm cài đặt (mẫu Shared_Notifications / GV_Notifications – "Cài đặt nhận thông báo"). */
export const PREF_KEYS = {
  STUDENT: ['ASSIGNMENT_NEW', 'DUE_SOON', 'GROUP', 'GROUP_SUBMIT', 'GRADE', 'ENTERPRISE', 'SECURITY'],
  LECTURER: ['GROUP_REPORT', 'TOPIC_UPDATED', 'NEW_SUBMISSION', 'DRIVE_ERROR'],
} as const;
/** Mặc định: bật hết, trừ vài loại email/ứng dụng như mẫu. */
const DEFAULT_OFF: Record<string, ('app' | 'email')[]> = { GROUP_SUBMIT: ['email'], ENTERPRISE: ['email'], TOPIC_UPDATED: ['app', 'email'], NEW_SUBMISSION: ['app', 'email'] };
/** Loại không tắt được (bảo mật, quyền xem của doanh nghiệp). */
const ALWAYS_ON = ['SECURITY', 'ENTERPRISE'];

type Prefs = { channels: Record<string, { app: boolean; email: boolean }>; digest: boolean };
function readPrefs(raw: unknown, role: 'STUDENT' | 'LECTURER'): Prefs {
  const r = (raw ?? {}) as Partial<Prefs>;
  const channels: Prefs['channels'] = {};
  for (const k of PREF_KEYS[role]) {
    const d = { app: !DEFAULT_OFF[k]?.includes('app'), email: !DEFAULT_OFF[k]?.includes('email') };
    channels[k] = { ...d, ...(r.channels?.[k] ?? {}) };
    if (ALWAYS_ON.includes(k)) channels[k].app = true;
  }
  return { channels, digest: r.digest ?? true };
}

/** Loại thông báo → nhóm cài đặt theo vai trò người nhận. */
function prefKeyOf(type: string, role: string): string | null {
  if (role === 'STUDENT') {
    if (type === 'ASSIGNMENT_OPENED' || type === 'ASSIGNMENT_UPDATED') return 'ASSIGNMENT_NEW';
    if (type === 'REMINDER' || type === 'DEADLINE_REMINDER') return 'DUE_SOON';
    if (type.startsWith('GROUP_')) return 'GROUP';
    if (type === 'SUBMISSION_UPDATED' || type === 'TOPIC_UPDATED') return 'GROUP_SUBMIT';
    if (type.includes('GRADE')) return 'GRADE';
    if (type.startsWith('ENTERPRISE_')) return 'ENTERPRISE';
    return null;
  }
  if (type === 'GROUP_REPORTED') return 'GROUP_REPORT';
  if (type === 'TOPIC_UPDATED') return 'TOPIC_UPDATED';
  if (type === 'SUBMISSION_UPDATED') return 'NEW_SUBMISSION';
  if (type === 'SUBMISSION_SYNC_FAILED' || type === 'DRIVE_FOLDER_PROBLEM') return 'DRIVE_ERROR';
  return null;
}

const settingsSchema = z.object({
  channels: z.record(z.string(), z.object({ app: z.boolean(), email: z.boolean() })),
  digest: z.boolean().optional(),
});

export interface NotifyInput {
  type: string;
  title: string;
  body?: string;
  link?: string;
  dedupeKey?: string;
}

/** NotificationService.notify – Specification UC11.3 (bản tối giản: chỉ thông báo trong ứng dụng). */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  /** Tạo thông báo trong ứng dụng và gửi email theo cài đặt của từng người (UC11.2–11.4). */
  async notify(userIds: string[], n: NotifyInput): Promise<number> {
    if (!userIds.length) return 0;
    let ids = [...new Set(userIds)];
    // trùng (user_id, dedupe_key) thì bỏ qua – FR-11.04 (kể cả email)
    if (n.dedupeKey) {
      const sent = await this.prisma.notification.findMany({ where: { userId: { in: ids }, dedupeKey: n.dedupeKey }, select: { userId: true } });
      ids = ids.filter((id) => !sent.some((x) => x.userId === id));
      if (!ids.length) return 0;
    }
    const users = await this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, role: true, email: true, notificationPrefs: true, student: { select: { email: true } }, lecturer: { select: { email: true } } },
    });
    const channel = (u: (typeof users)[number], c: 'app' | 'email') => {
      const key = prefKeyOf(n.type, u.role);
      if (!key || (u.role !== 'STUDENT' && u.role !== 'LECTURER')) return c === 'app';
      return readPrefs(u.notificationPrefs, u.role).channels[key]?.[c] !== false;
    };
    const app = users.filter((u) => channel(u, 'app'));
    if (app.length)
      await this.prisma.notification.createMany({ data: app.map((u) => ({ userId: u.id, ...n })), skipDuplicates: true });
    // email gửi nền, không chặn thao tác chính
    const link = n.link ? `${env.WEB_ORIGIN.replace(/\/$/, '')}${n.link}` : undefined;
    for (const u of users.filter((x) => channel(x, 'email'))) {
      const to = u.student?.email ?? u.lecturer?.email ?? u.email;
      if (to) void this.mail.send({ to, subject: n.title, text: n.body ?? '', action: link ? { label: 'Mở EduPortfolio', url: link } : undefined });
    }
    return users.length;
  }

  list(userId: string, limit = 20) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  unreadCount(userId: string) {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  async settings(user: AuthUser) {
    const role = user.role === 'LECTURER' ? 'LECTURER' : 'STUDENT';
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: user.sub }, select: { notificationPrefs: true } });
    return { ...readPrefs(u.notificationPrefs, role), alwaysOn: ALWAYS_ON.filter((k) => (PREF_KEYS[role] as readonly string[]).includes(k)) };
  }

  async saveSettings(user: AuthUser, dto: z.infer<typeof settingsSchema>) {
    const role = user.role === 'LECTURER' ? 'LECTURER' : 'STUDENT';
    const clean = readPrefs({ channels: Object.fromEntries(Object.entries(dto.channels).filter(([k]) => (PREF_KEYS[role] as readonly string[]).includes(k))), digest: dto.digest }, role);
    await this.prisma.user.update({ where: { id: user.sub }, data: { notificationPrefs: clean as unknown as Prisma.InputJsonValue } });
    return this.settings(user);
  }
}

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly service: NotificationsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthUser, @Query('limit') limit?: string) {
    const [items, unread] = await Promise.all([
      this.service.list(user.sub, Math.min(Number(limit) || 20, 100)),
      this.service.unreadCount(user.sub),
    ]);
    return { items, unread };
  }

  @Get('settings')
  settings(@CurrentUser() user: AuthUser) {
    return this.service.settings(user);
  }

  @Put('settings')
  saveSettings(@CurrentUser() user: AuthUser, @Body(new ZodPipe(settingsSchema)) dto: z.infer<typeof settingsSchema>) {
    return this.service.saveSettings(user, dto);
  }

  @Post(':id/read')
  async read(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.prisma.notification.updateMany({ where: { id, userId: user.sub, readAt: null }, data: { readAt: new Date() } });
    return { ok: true };
  }

  @Post('read-all')
  async readAll(@CurrentUser() user: AuthUser) {
    await this.prisma.notification.updateMany({ where: { userId: user.sub, readAt: null }, data: { readAt: new Date() } });
    return { ok: true };
  }
}

@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
