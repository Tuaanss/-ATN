import { Global, Injectable, Module } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export const DEFAULT_CONFIG = {
  files: {
    imageMaxMB: 10,
    imageMax: 30,
    videoMaxMB: 500,
    videoMax: 3,
    sourceMaxMB: 100,
    sourceMax: 3,
    documentMaxMB: 20,
    documentMax: 3,
    linkDomains: ['figma.com', 'github.com', 'gitlab.com'],
  },
  security: { maxFailed: 5, lockMinutes: 15, forceChangeFirstLogin: true },
  /** Cảnh báo phụ huynh khi điểm bài tập dưới ngưỡng */
  warning: { scoreThreshold: 4 },
  enterprise: { viewDaysMin: 14, viewDaysMax: 28 },
  reminder: { hours: 24 },
  email: { sender: 'FrameUp <no-reply@frameup.local>' },
};
export type SystemConfigValue = typeof DEFAULT_CONFIG;

/** Đọc / ghi cấu hình hệ thống (UC02.13), có bộ nhớ đệm 30 giây. */
@Injectable()
export class SystemConfigService {
  private cache?: { at: number; value: SystemConfigValue };
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<SystemConfigValue> {
    if (this.cache && Date.now() - this.cache.at < 30_000) return this.cache.value;
    const row = await this.prisma.systemConfig.findUnique({ where: { key: 'main' } });
    const saved = (row?.value ?? {}) as Partial<SystemConfigValue>;
    const value = Object.fromEntries(
      Object.entries(DEFAULT_CONFIG).map(([k, v]) => [k, { ...(v as object), ...((saved as Record<string, object>)[k] ?? {}) }]),
    ) as SystemConfigValue;
    this.cache = { at: Date.now(), value };
    return value;
  }

  async save(value: SystemConfigValue, userId: string) {
    await this.prisma.systemConfig.upsert({
      where: { key: 'main' },
      create: { key: 'main', value: value as unknown as Prisma.InputJsonValue, updatedById: userId },
      update: { value: value as unknown as Prisma.InputJsonValue, updatedById: userId },
    });
    this.cache = undefined;
    return this.get();
  }
}

@Global()
@Module({ providers: [SystemConfigService], exports: [SystemConfigService] })
export class SystemConfigModule {}
