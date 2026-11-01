import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { FileType, SubmissionKind } from '@prisma/client';
import { promises as fs } from 'node:fs';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppException, forbidden, notFound } from '../../common/errors/app-exception';
import { PRODUCT_FOR_FILE, detectFileType, sanitizeName } from '../../common/utils/files';
import { SystemConfigService } from '../../common/config/system-config.service';
import { StorageService } from '../../infra/storage/storage.service';
import { DriveService } from '../../infra/drive/drive.service';
import { NotificationsService } from '../notifications/notifications.module';
import { isAcceptingSubmissions } from '../assignments/assignment-status';
import { StudentWorkService } from './student-work.service';
import { DriveSyncService } from './drive-sync.service';
import { strs } from '../../common/utils/json';

export interface SubmitInput {
  kind: SubmissionKind;
  figmaUrl?: string;
  gitUrl?: string;
  note?: string;
  contributionPercent?: number;
}

const LABEL: Record<FileType, string> = { IMAGE: 'ảnh', VIDEO: 'video', SOURCE: 'mã nguồn', DOCUMENT: 'báo cáo (PDF/DOC/DOCX)' };

@Injectable()
export class SubmissionsService {
  private readonly logger = new Logger(SubmissionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly drive: DriveService,
    private readonly work: StudentWorkService,
    private readonly sync: DriveSyncService,
    private readonly notifications: NotificationsService,
    private readonly config: SystemConfigService,
  ) {}

  // ================================================================ UC06.1 / UC06.2 / UC06.4

  async submit(studentId: string, assignmentId: string, input: SubmitInput, files: Express.Multer.File[]) {
    try {
      return await this.doSubmit(studentId, assignmentId, input, files);
    } finally {
      // tệp multer chưa được chuyển (do lỗi) thì dọn
      await Promise.all(files.map((f) => this.storage.remove(f.path)));
    }
  }

  private async doSubmit(studentId: string, assignmentId: string, input: SubmitInput, files: Express.Multer.File[]) {
    const a = await this.work.accessibleAssignment(studentId, assignmentId);
    const me = await this.prisma.student.findUniqueOrThrow({ where: { id: studentId }, select: { profileCompletedAt: true } });
    if (!me.profileCompletedAt)
      throw new AppException('AUTH_PROFILE_INCOMPLETE', 'Hãy khai báo hồ sơ cá nhân trước khi nộp bài', HttpStatus.FORBIDDEN);
    const now = new Date();
    if (!isAcceptingSubmissions(a, now))
      throw new AppException('SUBMISSION_DEADLINE_PASSED', a.status === 'CLOSED' ? 'Bài tập đã đóng' : 'Đã quá hạn nộp bài', HttpStatus.CONFLICT);

    // ---- xác định chủ bài (nhóm / cá nhân)
    const group = await this.work.myGroup(studentId, a.id);
    if (a.workMode === 'GROUP' && !group)
      throw new AppException('GROUP_NOT_ASSIGNED', 'Bạn chưa có tên trong danh sách nhóm giảng viên tải lên', HttpStatus.CONFLICT);
    if (input.kind === 'GROUP_SHARED' && !group)
      throw new AppException('GROUP_NOT_ASSIGNED', 'Bài tập này làm cá nhân');
    if (input.kind === 'PERSONAL' && group && !a.hasIndividualPart)
      throw new AppException('PERSONAL_PART_DISABLED', 'Bài tập này không có phần cá nhân');

    // ---- đề tài (FR-06.02, BR-25)
    const topic = group
      ? group.topic
      : await this.prisma.topic.findUnique({ where: { assignmentId_studentId: { assignmentId: a.id, studentId } } });
    if (!topic) throw new AppException('TOPIC_REQUIRED', 'Hãy nhập tên đề tài trước khi nộp bài');

    // ---- kiểm tra link
    const figmaUrl = input.figmaUrl?.trim() || null;
    const gitUrl = input.gitUrl?.trim() || null;
    if (figmaUrl && !/^https:\/\/(www\.)?figma\.com\//i.test(figmaUrl))
      throw new AppException('LINK_INVALID_DOMAIN', 'Link Figma phải thuộc figma.com');
    if (gitUrl && !/^https:\/\/(www\.)?(github\.com|gitlab\.com)\//i.test(gitUrl))
      throw new AppException('LINK_INVALID_DOMAIN', 'Link mã nguồn phải thuộc github.com hoặc gitlab.com');
    if (figmaUrl && !strs(a.productTypes).includes('FIGMA')) throw new AppException('LINK_INVALID_DOMAIN', 'Bài tập không yêu cầu link Figma');
    if (gitUrl && !strs(a.productTypes).includes('GIT_LINK')) throw new AppException('LINK_INVALID_DOMAIN', 'Bài tập không yêu cầu link Git');

    // ---- kiểm tra tệp bằng magic bytes + dung lượng + số lượng (FR-06.04, BR-13) – giới hạn theo cấu hình hệ thống
    const fc = (await this.config.get()).files;
    const LIMITS: Record<FileType, { maxMB: number; maxCount: number }> = {
      IMAGE: { maxMB: fc.imageMaxMB, maxCount: fc.imageMax },
      VIDEO: { maxMB: fc.videoMaxMB, maxCount: fc.videoMax },
      SOURCE: { maxMB: fc.sourceMaxMB, maxCount: fc.sourceMax },
      DOCUMENT: { maxMB: fc.documentMaxMB, maxCount: fc.documentMax },
    };
    const checked: { file: Express.Multer.File; mime: string; fileType: FileType }[] = [];
    for (const f of files) {
      const detected = detectFileType(await this.storage.readHead(f.path), await this.storage.readTail(f.path));
      if (!detected)
        throw new AppException('FILE_INVALID_TYPE', `Tệp "${f.originalname}" không đúng định dạng cho phép`, HttpStatus.BAD_REQUEST, { file: f.originalname });
      if (!strs(a.productTypes).includes(PRODUCT_FOR_FILE[detected.fileType]))
        throw new AppException('FILE_INVALID_TYPE', `Bài tập không nhận ${LABEL[detected.fileType]} ("${f.originalname}")`, HttpStatus.BAD_REQUEST, { file: f.originalname });
      if (f.size > LIMITS[detected.fileType].maxMB * 1024 * 1024)
        throw new AppException('FILE_TOO_LARGE', `"${f.originalname}" vượt quá ${LIMITS[detected.fileType].maxMB} MB`, HttpStatus.BAD_REQUEST, { file: f.originalname });
      checked.push({ file: f, ...detected });
    }
    for (const t of Object.keys(LIMITS) as FileType[]) {
      const n = checked.filter((c) => c.fileType === t).length;
      if (n > LIMITS[t].maxCount) throw new AppException('FILE_TOO_MANY', `Tối đa ${LIMITS[t].maxCount} tệp ${LABEL[t]}`);
    }
    // Nộp lại: chỉ loại tệp có chọn tệp mới mới bị thay; loại không chọn tệp mới được giữ nguyên
    const current = await this.prisma.submission.findFirst({
      where:
        input.kind === 'GROUP_SHARED'
          ? { assignmentId: a.id, groupId: group!.id, kind: 'GROUP_SHARED' }
          : { assignmentId: a.id, studentId, kind: 'PERSONAL' },
      include: { files: { where: { deletedAt: null }, select: { fileType: true } } },
    });
    const newTypes = new Set(checked.map((c) => c.fileType));
    const keptTypes = (current?.files ?? []).map((f) => f.fileType).filter((t) => !newTypes.has(t));
    if (!checked.length && !keptTypes.length && !figmaUrl && !gitUrl)
      throw new AppException('SUBMISSION_EMPTY', 'Hãy chọn tệp hoặc nhập link sản phẩm');
    // Bài yêu cầu báo cáo: bài chung / bài cá nhân chính phải kèm ít nhất 1 tệp báo cáo
    // (phần cá nhân trong bài nhóm không bắt buộc – báo cáo nằm ở bài chung)
    const isMainSubmission = input.kind === 'GROUP_SHARED' || !group;
    if (strs(a.productTypes).includes('REPORT') && isMainSubmission && !newTypes.has('DOCUMENT') && !keptTypes.includes('DOCUMENT'))
      throw new AppException('REPORT_REQUIRED', 'Bài tập yêu cầu nộp kèm tệp báo cáo (PDF, DOC hoặc DOCX)');

    // ---- ghi CSDL trong transaction (khóa theo chủ bài để hai thành viên nộp cùng lúc chạy tuần tự – BR-12)
    const hashes = await Promise.all(checked.map((c) => this.storage.sha256(c.file.path)));

    const result = await this.prisma.$transaction(
      async (tx) => {
        // khóa dòng nhóm / sinh viên đến hết transaction (MySQL: SELECT … FOR UPDATE)
        if (input.kind === 'GROUP_SHARED') await tx.$queryRawUnsafe('SELECT id FROM `groups` WHERE id = ? FOR UPDATE', group!.id);
        else await tx.$queryRawUnsafe('SELECT id FROM students WHERE id = ? FOR UPDATE', studentId);
        const existing = await tx.submission.findFirst({
          where:
            input.kind === 'GROUP_SHARED'
              ? { assignmentId: a.id, groupId: group!.id, kind: 'GROUP_SHARED' }
              : { assignmentId: a.id, studentId, kind: 'PERSONAL' },
          include: { files: { where: { deletedAt: null } } },
        });

        const isLate = now > a.dueAt;
        const base = {
          topicId: topic.id,
          lastSubmittedById: studentId,
          figmaUrl,
          gitUrl,
          note: input.note?.trim() || null,
          contributionPercent: input.kind === 'PERSONAL' && group ? (input.contributionPercent ?? null) : null,
          submittedAt: now,
          isLate,
          status: isLate ? ('LATE' as const) : ('SUBMITTED' as const),
          syncStatus: checked.length ? ('PENDING' as const) : ('SYNCED' as const),
        };
        const submission = existing
          ? await tx.submission.update({ where: { id: existing.id }, data: { ...base, version: { increment: 1 } } })
          : await tx.submission.create({
              data: {
                assignmentId: a.id,
                kind: input.kind,
                groupId: input.kind === 'GROUP_SHARED' ? group!.id : null,
                studentId: input.kind === 'PERSONAL' ? studentId : null,
                ...base,
              },
            });

        // nộp lại: ẩn ngay bản cũ (UC06.4)
        const removed = (existing?.files ?? []).filter((f) => newTypes.has(f.fileType as FileType));
        const kept = (existing?.files ?? []).filter((f) => !newTypes.has(f.fileType as FileType));
        const startOrder = kept.reduce((m, f) => Math.max(m, f.sortOrder), 0);
        if (removed.length)
          await tx.submissionFile.updateMany({ where: { id: { in: removed.map((f) => f.id) } }, data: { deletedAt: now } });

        const created: string[] = [];
        for (const [i, c] of checked.entries()) {
          const order = String(startOrder + i + 1).padStart(2, '0');
          const localPath = await this.storage.moveToPending(c.file.path, submission.id, `v${submission.version}_${order}_${sanitizeName(c.file.originalname, 120)}`);
          const row = await tx.submissionFile.create({
            data: {
              submissionId: submission.id,
              fileType: c.fileType,
              originalName: c.file.originalname,
              mimeType: c.mime,
              sizeBytes: BigInt(c.file.size),
              sha256: hashes[i],
              sortOrder: startOrder + i + 1,
              localPath,
              uploadedById: studentId,
            },
          });
          created.push(row.id);
        }

        await tx.submissionEvent.create({
          data: {
            assignmentId: a.id,
            submissionId: submission.id,
            kind: input.kind,
            groupId: submission.groupId,
            studentId: submission.studentId,
            actorId: studentId,
            action: existing ? 'RESUBMIT' : 'SUBMIT',
            version: submission.version,
            detail: {
              added: checked.map((c) => ({ name: c.file.originalname, size: c.file.size })),
              removed: removed.map((f) => ({ name: f.originalName })),
            },
          },
        });
        return { submission, created, removed };
      },
      { timeout: 60_000 },
    );

    // ---- sau commit: đồng bộ Drive nền, dọn bản cũ, thông báo
    this.sync.enqueue(result.created);
    for (const f of result.removed) {
      if (f.driveFileId) this.drive.trash(f.driveFileId, a.createdById).catch((e) => this.logger.warn(`Trash ${f.driveFileId}: ${e}`));
      await this.storage.remove(f.localPath);
    }
    if (group && input.kind === 'GROUP_SHARED') {
      const me = group.members.find((m) => m.studentId === studentId)?.student.fullName ?? 'Một thành viên';
      await this.notifications.notify(
        group.members.filter((m) => m.studentId !== studentId).map((m) => m.student.userId),
        {
          type: 'SUBMISSION_UPDATED',
          title: `${me} đã ${result.removed.length ? 'nộp lại' : 'nộp'} bài chung`,
          body: a.title,
          link: `/student/assignments/${a.id}`,
        },
      );
    }
    return this.work.myWork(studentId, a.id);
  }

  // ================================================================ UC06.5 – xóa nhiều tệp

  async deleteFiles(studentId: string, submissionId: string, fileIds: string[]) {
    const s = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      include: { assignment: true, files: { where: { deletedAt: null } } },
    });
    if (!s) throw notFound('Bài nộp');
    await this.assertOwner(studentId, s);
    if (!isAcceptingSubmissions(s.assignment)) throw new AppException('SUBMISSION_DEADLINE_PASSED', 'Đã quá hạn nộp bài', HttpStatus.CONFLICT);

    const targets = s.files.filter((f) => fileIds.includes(f.id));
    if (!targets.length) throw notFound('Tệp');
    const remaining = s.files.length - targets.length;
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.submissionFile.updateMany({ where: { id: { in: targets.map((f) => f.id) } }, data: { deletedAt: now } });
      await tx.submissionEvent.create({
        data: {
          assignmentId: s.assignmentId,
          submissionId: s.id,
          kind: s.kind,
          groupId: s.groupId,
          studentId: s.studentId,
          actorId: studentId,
          action: 'DELETE_FILES',
          version: s.version,
          detail: { removed: targets.map((f) => ({ name: f.originalName })) },
        },
      });
      // xóa hết tệp và không còn link → về "chưa nộp"; lịch sử vẫn giữ (submission_id SET NULL)
      if (remaining === 0 && !s.figmaUrl && !s.gitUrl) await tx.submission.delete({ where: { id: s.id } });
      else {
        const left = await tx.submissionFile.findMany({ where: { submissionId: s.id, deletedAt: null }, orderBy: { sortOrder: 'asc' } });
        for (const [i, f] of left.entries()) if (f.sortOrder !== i + 1) await tx.submissionFile.update({ where: { id: f.id }, data: { sortOrder: i + 1 } });
      }
    });

    for (const f of targets) {
      if (f.driveFileId) this.drive.trash(f.driveFileId, s.assignment.createdById).catch((e) => this.logger.warn(`Trash ${f.driveFileId}: ${e}`));
      await this.storage.remove(f.localPath);
    }
    if (remaining > 0) await this.sync.refreshSummary(s.id);
    return this.work.myWork(studentId, s.assignmentId);
  }

  private async assertOwner(studentId: string, s: { kind: SubmissionKind; groupId: string | null; studentId: string | null; assignmentId: string }) {
    if (s.kind === 'PERSONAL') {
      if (s.studentId !== studentId) throw forbidden();
      return;
    }
    const m = await this.prisma.groupMember.findUnique({ where: { groupId_studentId: { groupId: s.groupId!, studentId } } });
    if (!m) throw forbidden();
  }

  /** Dọn các tệp multer bị bỏ dở (gọi khi khởi động). */
  async cleanupUploads() {
    const dir = this.storage.uploadsDir;
    const entries = await fs.readdir(dir).catch(() => []);
    await Promise.all(entries.map((e) => fs.unlink(`${dir}/${e}`).catch(() => undefined)));
  }
}
