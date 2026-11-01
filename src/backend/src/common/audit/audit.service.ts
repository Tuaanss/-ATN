import { Global, Injectable, Logger, Module } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntry {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string;
  summary?: string;
  oldData?: unknown;
  newData?: unknown;
}

/** Ghi audit_logs (UC02.12). Lỗi ghi log không làm hỏng thao tác chính. */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(e: AuditEntry) {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: e.actorId ?? null,
          action: e.action,
          entityType: e.entityType,
          entityId: e.entityId,
          summary: e.summary?.slice(0, 500),
          oldData: (e.oldData ?? undefined) as Prisma.InputJsonValue | undefined,
          newData: (e.newData ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
    } catch (err) {
      this.logger.warn(`Không ghi được audit ${e.action}: ${err}`);
    }
  }

  history(entityType: string, entityId: string, take = 20) {
    return this.prisma.auditLog.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'desc' },
      take,
      include: { actor: { include: { lecturer: true, student: true } } },
    });
  }
}

@Global()
@Module({ providers: [AuditService], exports: [AuditService] })
export class AuditModule {}
