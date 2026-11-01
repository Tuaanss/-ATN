import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { sanitizeName, stripVietnamese } from '../../common/utils/files';
import { DriveError, DriveService } from '../../infra/drive/drive.service';
import { NotificationsService } from '../notifications/notifications.module';

const MAX_ATTEMPTS = 8; // FR-06.14
const CONCURRENCY = 2;
const SWEEP_MS = 2 * 60_000;

/**
 * Ghi tệp bài nộp lên Drive bất đồng bộ (UC06.3, ADR-04): SV nộp xong ngay, tệp đi lên Drive sau.
 * Bản hiện tại chạy hàng đợi trong bộ nhớ của tiến trình api; trạng thái nằm trong CSDL
 * (`submission_files.sync_status`) nên khởi động lại không mất việc – lần quét kế tiếp nhận lại.
 * Khi có Redis/BullMQ (TechTasks T-302, T-310) chỉ cần thay `enqueue` bằng queue `drive`.
 */
@Injectable()
export class DriveSyncService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(DriveSyncService.name);
  private readonly queue: string[] = [];
  private readonly queued = new Set<string>();
  private running = 0;
  private sweepTimer?: NodeJS.Timeout;
  private readonly folderLocks = new Map<string, Promise<string>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly drive: DriveService,
    private readonly notifications: NotificationsService,
  ) {}

  onApplicationBootstrap() {
    void this.sweep();
    this.sweepTimer = setInterval(() => void this.sweep(), SWEEP_MS);
  }

  onModuleDestroy() {
    clearInterval(this.sweepTimer);
  }

  enqueue(fileIds: string[]) {
    for (const id of fileIds) {
      if (this.queued.has(id)) continue;
      this.queued.add(id);
      this.queue.push(id);
    }
    this.pump();
  }

  /** Nhận lại tệp PENDING bị bỏ dở và tệp FAILED đến hạn thử lại (UC06.9). */
  private async sweep() {
    try {
      const files = await this.prisma.submissionFile.findMany({
        where: {
          deletedAt: null,
          OR: [
            { syncStatus: { in: ['PENDING', 'UPLOADING'] }, OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: new Date() } }] },
            { syncStatus: 'FAILED', retryCount: { lt: 20 }, nextRetryAt: { lte: new Date() } },
          ],
        },
        select: { id: true },
        take: 200,
      });
      this.enqueue(files.map((f) => f.id));
    } catch (e) {
      this.logger.error(`Quét đồng bộ lỗi: ${e}`);
    }
  }

  private pump() {
    while (this.running < CONCURRENCY && this.queue.length) {
      const id = this.queue.shift()!;
      this.running++;
      this.process(id)
        .catch((e) => this.logger.error(e))
        .finally(() => {
          this.running--;
          this.queued.delete(id);
          this.pump();
        });
    }
  }

  private async process(fileId: string) {
    const file = await this.prisma.submissionFile.findUnique({
      where: { id: fileId },
      include: { submission: { include: { assignment: true } } },
    });
    if (!file || file.deletedAt || file.syncStatus === 'SYNCED' || !file.localPath) return;

    await this.prisma.submissionFile.update({ where: { id: fileId }, data: { syncStatus: 'UPLOADING' } });
    try {
      const owner = file.submission.assignment.createdById;
      const folderId = await this.targetFolder(file.submission);
      const name = `${String(file.sortOrder).padStart(2, '0')}_${sanitizeName(file.originalName, 150)}`;
      const res = await this.drive.uploadFile(file.localPath, name, file.mimeType, folderId, owner);
      // tệp có thể đã bị xóa trong lúc đang tải lên → đưa luôn vào thùng rác
      const fresh = await this.prisma.submissionFile.findUnique({ where: { id: fileId }, select: { deletedAt: true } });
      if (fresh?.deletedAt) {
        await this.drive.trash(res.id, owner).catch(() => undefined);
        return;
      }
      await this.prisma.submissionFile.update({
        where: { id: fileId },
        data: { syncStatus: 'SYNCED', driveFileId: res.id, lastError: null, nextRetryAt: null },
      });
    } catch (e) {
      await this.handleError(fileId, file.retryCount, file.submission, e);
    }
    await this.refreshSummary(file.submissionId);
  }

  private async handleError(
    fileId: string,
    retryCount: number,
    submission: { id: string; assignmentId: string; assignment: { title: string; sectionId: string } },
    e: unknown,
  ) {
    const permanent = e instanceof DriveError ? e.permanent : false;
    const attempts = retryCount + 1;
    const message = (e instanceof Error ? e.message || e.name : String(e)) || 'Lỗi không xác định';
    if (!(e instanceof DriveError)) this.logger.debug?.(e instanceof Error ? e.stack : e);
    const giveUp = permanent || attempts >= MAX_ATTEMPTS;
    const delayMs = giveUp ? 10 * 60_000 * Math.min(attempts, 36) : 30_000 * 2 ** (attempts - 1); // 30s, 1', 2', 4'…
    this.logger.warn(`Đồng bộ tệp ${fileId} lỗi (lần ${attempts}${permanent ? ', vĩnh viễn' : ''}): ${message}`);
    if (message.startsWith('invalid_grant')) {
      const a = await this.prisma.assignment.findUnique({ where: { id: submission.assignmentId }, select: { createdById: true } });
      if (a) await this.prisma.lecturerDriveLink.updateMany({ where: { lecturerId: a.createdById }, data: { status: 'EXPIRED', checkedAt: new Date() } });
    }

    await this.prisma.submissionFile.update({
      where: { id: fileId },
      data: {
        syncStatus: giveUp ? 'FAILED' : 'PENDING',
        retryCount: attempts,
        lastError: message.slice(0, 1000),
        nextRetryAt: new Date(Date.now() + delayMs),
      },
    });

    if (!giveUp) {
      setTimeout(() => this.enqueue([fileId]), delayMs).unref();
      return;
    }
    // báo GV phụ trách, gộp tối đa 1 thông báo / bài tập / giờ
    const section = await this.prisma.courseSection.findUnique({ where: { id: submission.assignment.sectionId }, include: { lecturer: true } });
    if (section)
      await this.notifications.notify([section.lecturer.userId], {
        type: 'SUBMISSION_SYNC_FAILED',
        title: `Có tệp chưa ghi được lên Google Drive`,
        body: `${submission.assignment.title}: ${message.slice(0, 200)}`,
        link: `/lecturer/assignments/${submission.assignmentId}`,
        dedupeKey: `syncfail:${submission.assignmentId}:${new Date().toISOString().slice(0, 13)}`,
      });
  }

  /** Cập nhật `submissions.sync_status` từ trạng thái các tệp. */
  async refreshSummary(submissionId: string) {
    const files = await this.prisma.submissionFile.findMany({
      where: { submissionId, deletedAt: null },
      select: { syncStatus: true },
    });
    const status = files.some((f) => f.syncStatus === 'FAILED' || f.syncStatus === 'MISSING')
      ? 'ERROR'
      : files.some((f) => f.syncStatus === 'PENDING' || f.syncStatus === 'UPLOADING')
        ? 'PENDING'
        : 'SYNCED';
    await this.prisma.submission.updateMany({ where: { id: submissionId }, data: { syncStatus: status } });
  }

  // ---------------------------------------------------------------- cây thư mục (UC04.3)
  //  <MaLHP>_<TenBaiTap>/
  //  ├── Nhom01_<TenNhom>/Bai_chung/          bài chung
  //  ├── Nhom01_<TenNhom>/<MSSV>_<HoTen>/     phần cá nhân trong nhóm
  //  └── CaNhan_<MSSV>_<HoTen>/               làm cá nhân

  private async targetFolder(s: { assignmentId: string; kind: string; groupId: string | null; studentId: string | null; assignment: { driveFolderId: string; createdById: string } }) {
    const root = s.assignment.driveFolderId;
    const owner = s.assignment.createdById;
    if (s.kind === 'GROUP_SHARED') {
      const group = await this.groupFolder(s.groupId!, root, owner);
      return this.once(`shared:${s.groupId}`, async () => {
        const g = await this.prisma.group.findUniqueOrThrow({ where: { id: s.groupId! } });
        if (g.driveSharedFolderId) return g.driveSharedFolderId;
        const id = await this.drive.createFolder('Bai_chung', group, owner);
        await this.prisma.group.update({ where: { id: g.id }, data: { driveSharedFolderId: id } });
        return id;
      });
    }

    const member = await this.prisma.groupMember.findUnique({
      where: { assignmentId_studentId: { assignmentId: s.assignmentId, studentId: s.studentId! } },
      include: { student: true },
    });
    if (member) {
      const group = await this.groupFolder(member.groupId, root, owner);
      return this.once(`personal:${member.groupId}:${member.studentId}`, async () => {
        const m = await this.prisma.groupMember.findUniqueOrThrow({ where: { groupId_studentId: { groupId: member.groupId, studentId: member.studentId } } });
        if (m.drivePersonalFolderId) return m.drivePersonalFolderId;
        const id = await this.drive.createFolder(sanitizeName(`${member.student.studentCode}_${stripVietnamese(member.student.fullName)}`), group, owner);
        await this.prisma.groupMember.update({ where: { groupId_studentId: { groupId: m.groupId, studentId: m.studentId } }, data: { drivePersonalFolderId: id } });
        return id;
      });
    }

    return this.once(`individual:${s.assignmentId}:${s.studentId}`, async () => {
      const key = { assignmentId_studentId: { assignmentId: s.assignmentId, studentId: s.studentId! } };
      const w = await this.prisma.individualWork.upsert({ where: key, create: key.assignmentId_studentId, update: {}, include: { student: true } });
      if (w.driveFolderId) return w.driveFolderId;
      const id = await this.drive.createFolder(sanitizeName(`CaNhan_${w.student.studentCode}_${stripVietnamese(w.student.fullName)}`), root, owner);
      await this.prisma.individualWork.update({ where: key, data: { driveFolderId: id } });
      return id;
    });
  }

  private groupFolder(groupId: string, root: string, owner: string) {
    return this.once(`group:${groupId}`, async () => {
      const g = await this.prisma.group.findUniqueOrThrow({ where: { id: groupId } });
      if (g.driveFolderId) return g.driveFolderId;
      const id = await this.drive.createFolder(sanitizeName(`Nhom${String(g.seq).padStart(2, '0')}_${stripVietnamese(g.name)}`), root, owner);
      await this.prisma.group.update({ where: { id: g.id }, data: { driveFolderId: id } });
      return id;
    });
  }

  /** Khóa theo khóa thư mục để hai tệp cùng lúc không tạo trùng thư mục (Architecture §5.3). */
  private once(key: string, fn: () => Promise<string>): Promise<string> {
    const pending = this.folderLocks.get(key);
    if (pending) return pending;
    const p = fn().finally(() => this.folderLocks.delete(key));
    this.folderLocks.set(key, p);
    return p;
  }
}
