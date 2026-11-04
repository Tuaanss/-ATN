import { Global, Injectable, Module } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** [điểm từ, điểm chữ, hệ 4] – sắp giảm dần (BR-15) */
export type ScaleRow = [number, string, number];

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
  grading: {
    scale: [
      [8.5, 'A', 4],
      [8.0, 'B+', 3.5],
      [7.0, 'B', 3],
      [6.5, 'C+', 2.5],
      [5.5, 'C', 2],
      [5.0, 'D+', 1.5],
      [4.0, 'D', 1],
      [0, 'F', 0],
    ] as ScaleRow[],
    retake: 'HIGHEST' as 'HIGHEST' | 'LATEST',
  },
  security: { maxFailed: 5, lockMinutes: 15, forceChangeFirstLogin: true },
  warning: { scoreThreshold: 4, gpaDrop: 0.5 },
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

  /** Quy đổi điểm chữ / hệ 4 theo thang đang cấu hình. */
  async letter(total: number) {
    const scale = [...(await this.get()).grading.scale].sort((a, b) => b[0] - a[0]);
    const row = scale.find((r) => total >= r[0]) ?? scale[scale.length - 1];
    return { letter: row[1], gpa4: row[2] };
  }
}

@Global()
@Module({ providers: [SystemConfigService], exports: [SystemConfigService] })
export class SystemConfigModule {}
