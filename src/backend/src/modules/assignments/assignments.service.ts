import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppException, forbidden, notFound } from '../../common/errors/app-exception';
import { PRODUCT_FOR_FILE, sanitizeName } from '../../common/utils/files';
import { DriveService } from '../../infra/drive/drive.service';
import { NotificationsService } from '../notifications/notifications.module';
import { AssignmentCommon, AssignmentUpdate, BatchCreateDto, SectionSchedule } from './assignments.schemas';
import { AuditService } from '../../common/audit/audit.service';
import { SystemConfigService } from '../../common/config/system-config.service';
import { env } from '../../config/env';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { assignmentPhase, finalDeadline } from './assignment-status';

export interface CreateResult {
  sectionId: string;
  sectionCode: string;
  ok: boolean;
  assignmentId?: string;
  code?: string;
  message?: string;
}

@Injectable()
export class AssignmentsService {
  private readonly logger = new Logger(AssignmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly drive: DriveService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    private readonly config: SystemConfigService,
  ) {}

  // ================================================================ Drive link (UC04.1)

  async getDriveLink(lecturerId: string) {
    const link = await this.prisma.lecturerDriveLink.findUnique({ where: { lecturerId } });
    const oauth = !!link?.refreshTokenEnc;
    const assignments = await this.prisma.assignment.findMany({
      where: { createdById: lecturerId, deletedAt: null, section: { semester: { isCurrent: true } } },
      include: { section: true },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    const failed = await this.prisma.submission.groupBy({
      by: ['assignmentId'],
      where: { assignmentId: { in: assignments.map((a) => a.id) }, syncStatus: 'ERROR' },
      _count: true,
    });
    const pending = await this.prisma.submission.groupBy({
      by: ['assignmentId'],
      where: { assignmentId: { in: assignments.map((a) => a.id) }, syncStatus: 'PENDING' },
      _count: true,
    });
    return {
      mode: this.drive.mode,
      serviceAccountEmail: this.drive.serviceAccountEmail,
      oauthAvailable: this.drive.oauthConfigured,
      link: link && {
        rootFolderName: link.rootFolderName,
        folderUrl: this.drive.folderUrl(link.rootFolderId),
        status: link.status,
        checkedAt: link.checkedAt,
        oauth,
        googleEmail: link.googleEmail,
        linkedAt: link.linkedAt,
      },
      quota: oauth ? await this.drive.quota(lecturerId) : null,
      folders: assignments.map((a) => ({
        id: a.id,
        title: a.title,
        section: a.section.code,
        url: this.drive.folderUrl(a.driveFolderId),
        failed: failed.find((f) => f.assignmentId === a.id)?._count ?? 0,
        pending: pending.find((f) => f.assignmentId === a.id)?._count ?? 0,
      })),
    };
  }

  // ---- OAuth: GV liên kết tài khoản Google của mình (mẫu GV_GoogleLink, "Cách 1")
  private oauthStates = new Map<string, { lecturerId: string; exp: number }>();

  oauthStart(lecturerId: string) {
    if (!this.drive.oauthConfigured)
      throw new AppException('DRIVE_NOT_LINKED', 'Máy chủ chưa cấu hình Google OAuth (GOOGLE_OAUTH_CLIENT_ID/SECRET, DRIVE_MODE=google)', HttpStatus.UNPROCESSABLE_ENTITY);
    const state = randomUUID();
    this.oauthStates.set(state, { lecturerId, exp: Date.now() + 10 * 60_000 });
    return { url: this.drive.authUrl(state) };
  }

  /** Nhận mã từ Google → lưu refresh token, tạo thư mục gốc "FrameUp" trong Drive của GV. */
  async oauthCallback(lecturerId: string, lecturerCode: string, code: string, state: string) {
    const st = this.oauthStates.get(state);
    this.oauthStates.delete(state);
    if (!st || st.lecturerId !== lecturerId || st.exp < Date.now()) throw new Error('Phiên liên kết đã hết hạn, hãy thử lại');
    const { email, refreshTokenEnc } = await this.drive.exchangeCode(code);
    const old = await this.prisma.lecturerDriveLink.findUnique({ where: { lecturerId } });
    const keepRoot = old?.refreshTokenEnc && old.googleEmail === email && !old.rootFolderId.startsWith('local:');
    const data = { authMode: 'OAUTH' as const, googleEmail: email, refreshTokenEnc, linkedAt: new Date(), status: 'OK' as const, checkedAt: new Date() };
    await this.prisma.lecturerDriveLink.upsert({
      where: { lecturerId },
      create: { lecturerId, rootFolderId: 'pending', rootFolderUrl: '', rootFolderName: null, ...data },
      update: data,
    });
    this.drive.forget(lecturerId);
    if (!keepRoot) {
      await this.prisma.lecturerSemesterFolder.deleteMany({ where: { lecturerId } });
      await this.prisma.courseSection.updateMany({ where: { lecturerId }, data: { driveFolderId: null } });
      const name = `FrameUp_${lecturerCode}`;
      const rootId = await this.drive.createFolder(name, 'root', lecturerId);
      await this.prisma.lecturerDriveLink.update({
        where: { lecturerId },
        data: { rootFolderId: rootId, rootFolderUrl: this.drive.folderUrl(rootId) ?? '', rootFolderName: name, sharedDriveId: null },
      });
    }
    await this.audit.log({ actorId: null, action: 'DRIVE_LINK', entityType: 'lecturer', entityId: lecturerId, summary: `Liên kết Google Drive ${email}` });
    // chuyển thư mục bài tập cũ vào cấu trúc <học kỳ>/<lớp> (chạy nền, không chặn chuyển hướng)
    if (keepRoot) this.reorganizeFolders(lecturerId).catch((e) => this.logger.warn(`Sắp xếp thư mục Drive: ${e}`));
    // tệp lỗi do mất liên kết → đưa lại hàng đợi (lần quét kế tiếp, tối đa 2 phút)
    await this.prisma.submissionFile.updateMany({
      where: { deletedAt: null, syncStatus: 'FAILED', submission: { assignment: { createdById: lecturerId } } },
      data: { retryCount: 0, nextRetryAt: new Date(), lastError: null },
    });
  }

  async oauthUnlink(lecturerId: string) {
    const link = await this.prisma.lecturerDriveLink.findUnique({ where: { lecturerId } });
    if (link?.refreshTokenEnc) await this.drive.revoke(link.refreshTokenEnc);
    if (link) await this.prisma.lecturerDriveLink.delete({ where: { lecturerId } });
    this.drive.forget(lecturerId);
    return this.getDriveLink(lecturerId);
  }

  /** Nút "Kiểm tra lại": ghi thử vào thư mục gốc. */
  async recheckDrive(lecturerId: string) {
    const link = await this.prisma.lecturerDriveLink.findUnique({ where: { lecturerId } });
    if (!link) throw new AppException('DRIVE_NOT_LINKED', 'Bạn chưa liên kết Google Drive', HttpStatus.UNPROCESSABLE_ENTITY);
    let status: 'OK' | 'NO_PERMISSION' | 'NOT_FOUND' | 'EXPIRED' = 'OK';
    try {
      await this.drive.verifyWritable(link.rootFolderId, lecturerId);
    } catch (e) {
      const code = (e as AppException).code;
      status = code === 'DRIVE_NOT_LINKED' ? 'EXPIRED' : code === 'DRIVE_FOLDER_NOT_FOUND' ? 'NOT_FOUND' : 'NO_PERMISSION';
    }
    await this.prisma.lecturerDriveLink.update({ where: { lecturerId }, data: { status, checkedAt: new Date() } });
    return this.getDriveLink(lecturerId);
  }

  async saveDriveLink(lecturerId: string, folderUrl: string) {
    const folderId = this.drive.parseFolderId(folderUrl);
    const info = await this.drive.verifyWritable(folderId, lecturerId);
    await this.prisma.lecturerDriveLink.upsert({
      where: { lecturerId },
      create: { lecturerId, rootFolderId: info.id, rootFolderUrl: folderUrl, rootFolderName: info.name, sharedDriveId: info.sharedDriveId },
      update: { rootFolderId: info.id, rootFolderUrl: folderUrl, rootFolderName: info.name, sharedDriveId: info.sharedDriveId, status: 'OK', checkedAt: new Date() },
    });
    return this.getDriveLink(lecturerId);
  }

  // ---------------------------------------------------------------- cây thư mục theo học kỳ
  //  FrameUp_<GV>/
  //  └── <năm học>_<HK1|HK2|HE>/              lecturer_semester_folders
  //      └── <MaLHP>_<TenMon>/                 course_sections.drive_folder_id
  //          └── <MaLHP>_<TenBaiTap>/          assignments.drive_folder_id
  // Nhận diện bằng id lưu trong CSDL (BR-21); tên chỉ để GV dễ đọc.

  private folderLocks = new Map<string, Promise<string>>();
  /** Hai yêu cầu cùng lúc (giao nhiều lớp) không tạo trùng thư mục. */
  private once(key: string, fn: () => Promise<string>) {
    const pending = this.folderLocks.get(key);
    if (pending) return pending;
    const p = fn().finally(() => this.folderLocks.delete(key));
    this.folderLocks.set(key, p);
    return p;
  }

  static semesterFolderName(sem: { academicYear: string; term: string }) {
    return `${sem.academicYear}_${sem.term === 'TERM_1' ? 'HK1' : sem.term === 'TERM_2' ? 'HK2' : 'HE'}`;
  }

  private semesterFolder(lecturerId: string, rootId: string, sem: { id: string; academicYear: string; term: string }) {
    return this.once(`sem:${lecturerId}:${sem.id}`, async () => {
      const key = { lecturerId_semesterId: { lecturerId, semesterId: sem.id } };
      const row = await this.prisma.lecturerSemesterFolder.findUnique({ where: key });
      if (row && row.rootFolderId === rootId) return row.folderId;
      const folderId = await this.drive.createFolder(AssignmentsService.semesterFolderName(sem), rootId, lecturerId);
      await this.prisma.lecturerSemesterFolder.upsert({ where: key, create: { lecturerId, semesterId: sem.id, rootFolderId: rootId, folderId }, update: { rootFolderId: rootId, folderId } });
      // thư mục học kỳ mới → thư mục lớp cũ (nếu có) không còn nằm trong đó
      await this.prisma.courseSection.updateMany({ where: { lecturerId, semesterId: sem.id }, data: { driveFolderId: null } });
      return folderId;
    });
  }

  /** Thư mục lớp học phần (tạo cả thư mục học kỳ nếu chưa có). */
  private sectionFolder(lecturerId: string, rootId: string, sectionId: string) {
    return this.once(`sec:${sectionId}`, async () => {
      const sec = await this.prisma.courseSection.findUniqueOrThrow({ where: { id: sectionId }, include: { course: true, semester: true } });
      const semId = await this.semesterFolder(lecturerId, rootId, sec.semester);
      const fresh = await this.prisma.courseSection.findUniqueOrThrow({ where: { id: sectionId }, select: { driveFolderId: true } });
      if (fresh.driveFolderId) return fresh.driveFolderId;
      const folderId = await this.drive.createFolder(sanitizeName(`${sec.code}_${sec.course.name}`), semId, lecturerId);
      await this.prisma.courseSection.update({ where: { id: sectionId }, data: { driveFolderId: folderId } });
      return folderId;
    });
  }

  /** Chuyển thư mục bài tập đang nằm thẳng dưới thư mục gốc vào <học kỳ>/<lớp>. Thư mục GV tự chọn thì giữ nguyên. */
  async reorganizeFolders(lecturerId: string) {
    const link = await this.prisma.lecturerDriveLink.findUnique({ where: { lecturerId } });
    if (!link) throw new AppException('DRIVE_NOT_LINKED', 'Bạn chưa liên kết Google Drive', HttpStatus.UNPROCESSABLE_ENTITY);
    const list = await this.prisma.assignment.findMany({ where: { createdById: lecturerId, deletedAt: null }, orderBy: { createdAt: 'asc' } });
    let moved = 0;
    let kept = 0;
    const failed: { title: string; message: string }[] = [];
    for (const a of list) {
      try {
        const target = await this.sectionFolder(lecturerId, link.rootFolderId, a.sectionId);
        if (a.driveParentFolderId === target) continue;
        if (a.driveParentFolderId !== link.rootFolderId) {
          kept++;
          continue;
        }
        await this.drive.move(a.driveFolderId, target, lecturerId);
        await this.prisma.assignment.update({ where: { id: a.id }, data: { driveParentFolderId: target } });
        moved++;
      } catch (e) {
        failed.push({ title: a.title, message: (e as Error).message });
      }
    }
    if (moved)
      await this.audit.log({ actorId: null, action: 'DRIVE_REORGANIZE', entityType: 'lecturer', entityId: lecturerId, summary: `Chuyển ${moved} thư mục bài tập vào cấu trúc học kỳ / lớp học phần` });
    return { moved, kept, failed };
  }

  /** Thư mục cha nhận bài: link riêng của bài > thư mục gốc của GV (chế độ local tự tạo). */
  private async resolveParentFolder(lecturerId: string, lecturerCode: string, folderUrl?: string): Promise<string> {
    if (folderUrl) return this.drive.parseFolderId(folderUrl);
    const link = await this.prisma.lecturerDriveLink.findUnique({ where: { lecturerId } });
    if (link) return link.rootFolderId;
    if (this.drive.mode === 'local') {
      const id = this.drive.parseFolderId(`GV_${lecturerCode}`);
      await this.prisma.lecturerDriveLink.create({ data: { lecturerId, rootFolderId: id, rootFolderUrl: id, rootFolderName: `GV_${lecturerCode}` } });
      return id;
    }
    throw new AppException('DRIVE_NOT_LINKED', 'Bạn chưa liên kết thư mục Google Drive nhận bài', HttpStatus.UNPROCESSABLE_ENTITY);
  }

  // ================================================================ Tạo bài tập (UC04.2, UC04.10)

  /** Giao bài cho một hoặc nhiều LHP; mỗi LHP một bài tập + một thư mục Drive, chung batch_id. */
  async createBatch(lecturerId: string, dto: BatchCreateDto): Promise<{ batchId: string; results: CreateResult[] }> {
    const lecturer = await this.prisma.lecturer.findUniqueOrThrow({ where: { id: lecturerId } });
    const sectionIds = [...new Set(dto.sections.map((s) => s.sectionId))];
    const sections = await this.prisma.courseSection.findMany({
      where: { id: { in: sectionIds } },
      include: { semester: true },
    });

    // BR-27: GV phải dạy mọi LHP được chọn
    const notOwned = sectionIds.filter((id) => !sections.find((s) => s.id === id && s.lecturerId === lecturerId));
    if (notOwned.length)
      throw new AppException('ASSIGNMENT_SECTION_NOT_OWNED', 'Có lớp học phần bạn không phụ trách', HttpStatus.FORBIDDEN, { sectionIds: notOwned });

    const parentId = await this.resolveParentFolder(lecturerId, lecturer.code, dto.common.folderUrl);
    await this.drive.verifyWritable(parentId, lecturerId); // UC04.4 – một lần cho cả đợt
    const custom = !!dto.common.folderUrl; // GV dán link thư mục riêng → không xếp theo học kỳ

    const batchId = randomUUID();
    const results: CreateResult[] = [];
    for (const schedule of dto.sections) {
      const section = sections.find((s) => s.id === schedule.sectionId)!;
      try {
        const parent = custom ? parentId : await this.sectionFolder(lecturerId, parentId, section.id);
        const id = await this.createOne(lecturerId, section, parent, dto.common, schedule, dto.sections.length > 1 ? batchId : null);
        results.push({ sectionId: section.id, sectionCode: section.code, ok: true, assignmentId: id });
      } catch (e) {
        const err = e as AppException;
        results.push({
          sectionId: section.id,
          sectionCode: section.code,
          ok: false,
          code: err.code ?? 'INTERNAL_ERROR',
          message: err.code ? err.message : 'Không tạo được bài tập cho lớp này',
        });
        if (!err.code) this.logger.error(e);
      }
    }
    return { batchId, results };
  }

  /** Cuối ngày kết thúc học kỳ (23:59:59.999). */
  private endOfSemester(semesterEnd: Date): Date {
    const end = new Date(semesterEnd);
    end.setHours(23, 59, 59, 999);
    return end;
  }

  /** Học kỳ đã kết thúc theo thời gian thực → nhập bài tập cũ: hạn nộp tùy ý (quá khứ để lưu hồ sơ, hoặc tương lai để SV đăng bài cũ lên). */
  private semesterEnded(semesterEnd: Date): boolean {
    return this.endOfSemester(semesterEnd) < new Date();
  }

  private validateDates(_common: AssignmentCommon, s: SectionSchedule, semesterEnd: Date) {
    const fail = (message: string) => new AppException('ASSIGNMENT_INVALID_DATES', message, HttpStatus.BAD_REQUEST);
    if (s.dueAt <= s.openAt) throw fail('Hạn nộp phải sau ngày mở (BR-04)');
    if (!this.semesterEnded(semesterEnd) && s.dueAt <= new Date()) throw fail('Hạn nộp phải ở tương lai');
    if (!this.semesterEnded(semesterEnd) && s.dueAt > this.endOfSemester(semesterEnd)) throw fail('Hạn nộp phải nằm trong học kỳ (BR-04)');
  }

  private async createOne(
    lecturerId: string,
    section: { id: string; code: string; semester: { endDate: Date } },
    parentId: string,
    c: AssignmentCommon,
    s: SectionSchedule,
    batchId: string | null,
  ): Promise<string> {
    this.validateDates(c, s, section.semester.endDate);

    const now = new Date();
    const openAt = c.publishNow && !c.saveDraft && s.openAt > now ? now : s.openAt;
    const status = !c.saveDraft && openAt <= now ? 'OPEN' : 'DRAFT';
    // UC04.3 – thư mục <MaLHP>_<TenBaiTap>
    const folderId = await this.drive.createFolder(sanitizeName(`${section.code}_${c.title}`), parentId, lecturerId);

    const data: Prisma.AssignmentUncheckedCreateInput = {
      sectionId: section.id,
      batchId,
      title: c.title,
      description: c.description,
      workMode: c.workMode,
      productTypes: c.productTypes,
      openAt,
      dueAt: s.dueAt,
      allowLate: c.allowLate,
      lateDueAt: c.allowLate && c.lateDays ? new Date(s.dueAt.getTime() + c.lateDays * 86400000) : null,
      hasIndividualPart: c.workMode === 'GROUP' && c.hasIndividualPart,
      suggestedTopics: c.suggestedTopics,
      autoOpen: !c.saveDraft,
      status,
      driveParentFolderId: parentId,
      driveFolderId: folderId,
      createdById: lecturerId,
    };

    let assignment;
    try {
      assignment = await this.prisma.assignment.create({ data });
    } catch (e) {
      await this.drive.trash(folderId, lecturerId).catch(() => undefined); // bù trừ (UC04.2 ngoại lệ)
      throw e;
    }
    // chỉ báo SV khi bài còn nhận nộp (bài cũ đã quá hạn thì không báo)
    if (status === 'OPEN' && (assignment.lateDueAt ?? assignment.dueAt) > now) await this.notifyOpened(assignment.id);
    await this.audit.log({ actorId: null, action: c.saveDraft ? 'DRAFT' : 'PUBLISH', entityType: 'assignment', entityId: assignment.id, summary: c.saveDraft ? 'Lưu nháp bài tập' : 'Giao bài tập', newData: { by: lecturerId } });
    return assignment.id;
  }

  /**
   * Bản nháp → giao bài: mở ngay nếu đã tới ngày mở, nếu chưa thì hẹn giờ mở.
   * Bài đang hẹn giờ (autoOpen) mà bấm giao lần nữa → mở ngay bây giờ.
   */
  async publish(lecturerId: string, userId: string, id: string) {
    const a = await this.ownAssignment(lecturerId, id);
    if (a.status !== 'DRAFT') throw new AppException('VALIDATION_ERROR', 'Bài tập đã được giao', HttpStatus.CONFLICT);
    const now = new Date();
    const open = a.autoOpen || a.openAt <= now;
    await this.prisma.assignment.update({ where: { id }, data: { autoOpen: true, status: open ? 'OPEN' : 'DRAFT', ...(open && a.openAt > now ? { openAt: now } : {}) } });
    // bài đã quá hạn (nhập cho học kỳ cũ) → không thông báo cho SV
    if (open && (a.lateDueAt ?? a.dueAt) > now) await this.notifyOpened(id);
    await this.audit.log({ actorId: userId, action: 'PUBLISH', entityType: 'assignment', entityId: id, summary: 'Giao bài tập' });
    return { ok: true, opened: open };
  }

  // ================================================================ Tệp đề bài

  async uploadBrief(lecturerId: string, userId: string, id: string, file: Express.Multer.File) {
    const a = await this.ownAssignment(lecturerId, id);
    const dir = path.join(env.DATA_DIR, 'briefs', id);
    await fs.mkdir(dir, { recursive: true });
    const name = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const dest = path.join(dir, sanitizeName(name, 150));
    await fs.rename(file.path, dest);
    if (a.briefFilePath && a.briefFilePath !== dest) await fs.unlink(a.briefFilePath).catch(() => undefined);
    if (a.briefDriveFileId) this.drive.trash(a.briefDriveFileId, lecturerId).catch(() => undefined);
    await this.prisma.assignment.update({
      where: { id },
      data: { briefFileName: name, briefFilePath: dest, briefFileSize: BigInt(file.size), briefMimeType: file.mimetype || 'application/octet-stream', briefDriveFileId: null },
    });
    await this.audit.log({ actorId: userId, action: 'BRIEF', entityType: 'assignment', entityId: id, summary: `Tải tệp đề bài ${name}` });
    // ghi bản sao lên thư mục bài tập trên Drive (không chặn)
    this.drive
      .uploadFile(dest, sanitizeName(`De_bai_${name}`, 150), file.mimetype || 'application/octet-stream', a.driveFolderId, lecturerId)
      .then((r) => this.prisma.assignment.update({ where: { id }, data: { briefDriveFileId: r.id } }))
      .catch((e) => this.logger.warn(`Không ghi được tệp đề bài lên Drive: ${e}`));
    return { name, size: file.size };
  }

  // ================================================================ Kiểm tra thư mục Drive (nút "Kiểm tra")

  async checkFolder(lecturerId: string, folderUrl: string) {
    const checks = { isFolder: false, exists: false, writable: false };
    try {
      const id = this.drive.parseFolderId(folderUrl);
      const info = await this.drive.verifyWritable(id, lecturerId);
      return { ok: true, name: info.name, checks: { isFolder: true, exists: true, writable: true } };
    } catch (e) {
      const err = e as AppException;
      if (err.code === 'DRIVE_NO_WRITE_PERMISSION' || err.code === 'DRIVE_NOT_SHARED_DRIVE') Object.assign(checks, { isFolder: true, exists: true });
      if (err.code === 'DRIVE_NOT_A_FOLDER') checks.exists = true;
      return { ok: false, message: err.message, checks };
    }
  }

  /** FR-04.10 – báo cho mọi SV trong LHP khi bài tập mở. */
  async notifyOpened(assignmentId: string) {
    const a = await this.prisma.assignment.findUniqueOrThrow({
      where: { id: assignmentId },
      include: { section: { include: { course: true, students: { include: { student: true } } } } },
    });
    await this.notifications.notify(
      a.section.students.map((ss) => ss.student.userId),
      {
        type: 'ASSIGNMENT_OPENED',
        title: `Bài tập mới: ${a.title}`,
        body: `${a.section.course.name} · ${a.section.code} · hạn ${a.dueAt.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}`,
        link: `/student/assignments/${a.id}`,
        dedupeKey: `opened:${a.id}`,
      },
    );
  }

  // ================================================================ Danh sách & chi tiết (GV)

  async lecturerSections(lecturerId: string) {
    const sections = await this.prisma.courseSection.findMany({
      where: { lecturerId },
      include: {
        course: true,
        semester: true,
        _count: { select: { students: true, assignments: { where: { deletedAt: null } } } },
      },
      orderBy: [{ semester: { startDate: 'desc' } }, { code: 'asc' }],
    });
    const ids = sections.map((s) => s.id);
    const [open, subs] = await Promise.all([
      this.prisma.assignment.groupBy({ by: ['sectionId'], where: { sectionId: { in: ids }, deletedAt: null, status: 'OPEN' }, _count: true }),
      // bài nộp tính theo đơn vị làm bài: bài chung của nhóm, hoặc bài của SV không thuộc nhóm nào
      this.prisma.submission.findMany({
        where: { assignment: { sectionId: { in: ids }, deletedAt: null } },
        select: { kind: true, isLate: true, assignmentId: true, studentId: true, assignment: { select: { sectionId: true } } },
      }),
    ]);
    const members = await this.prisma.groupMember.findMany({
      where: { assignment: { sectionId: { in: ids } } },
      select: { assignmentId: true, studentId: true },
    });
    const inGroup = new Set(members.map((m) => `${m.assignmentId}:${m.studentId}`));
    const units = subs.filter((x) => x.kind === 'GROUP_SHARED' || !inGroup.has(`${x.assignmentId}:${x.studentId}`));
    return sections.map((s) => {
      const mine = units.filter((x) => x.assignment.sectionId === s.id);
      return {
        id: s.id,
        code: s.code,
        course: { code: s.course.code, name: s.course.name, credits: s.course.credits },
        semester: { code: s.semester.code, academicYear: s.semester.academicYear, term: s.semester.term, isCurrent: s.semester.isCurrent, endDate: s.semester.endDate },
        studentCount: s._count.students,
        assignmentCount: s._count.assignments,
        openAssignmentCount: open.find((o) => o.sectionId === s.id)?._count ?? 0,
        submissionCount: mine.length,
        onTimeRate: mine.length ? Math.round((mine.filter((x) => !x.isLate).length / mine.length) * 100) : null,
      };
    });
  }

  private async ownSection(lecturerId: string, sectionId: string) {
    const section = await this.prisma.courseSection.findUnique({
      where: { id: sectionId },
      include: { course: true, semester: true, _count: { select: { students: true } } },
    });
    if (!section) throw notFound('Lớp học phần');
    if (section.lecturerId !== lecturerId) throw forbidden('Bạn không phụ trách lớp học phần này');
    return section;
  }

  async sectionAssignments(lecturerId: string, sectionId: string) {
    const section = await this.ownSection(lecturerId, sectionId);
    const assignments = await this.prisma.assignment.findMany({
      where: { sectionId, deletedAt: null },
      orderBy: { dueAt: 'asc' },
    });
    const items = await Promise.all(assignments.map((a) => this.summarize(a, section._count.students)));
    return {
      section: {
        id: section.id,
        code: section.code,
        studentCount: section._count.students,
        course: { code: section.course.code, name: section.course.name },
        semester: { code: section.semester.code, endDate: section.semester.endDate },
      },
      assignments: items,
    };
  }

  /** Bài nộp tính là một đơn vị làm bài: bài chung của nhóm, hoặc bài của SV không thuộc nhóm nào (làm cá nhân). */
  private workUnitFilter(assignmentId: string): Prisma.SubmissionWhereInput {
    return {
      OR: [{ kind: 'GROUP_SHARED' }, { kind: 'PERSONAL', student: { groupMembers: { none: { assignmentId } } } }],
    };
  }

  /** Số đơn vị làm bài (nhóm/SV), số đã nộp, số SV có điểm – chỉ để hiển thị, không theo dõi tiến độ. */
  async summarize(a: Prisma.AssignmentGetPayload<object>, studentCount: number) {
    const [groups, submitted, topics, graded, openReports, avg] = await Promise.all([
      this.prisma.group.count({ where: { assignmentId: a.id } }),
      this.prisma.submission.count({ where: { assignmentId: a.id, ...this.workUnitFilter(a.id) } }),
      this.prisma.topic.count({ where: { assignmentId: a.id } }),
      this.prisma.assignmentGrade.count({ where: { assignmentId: a.id, score: { not: null } } }),
      this.prisma.groupReport.count({ where: { assignmentId: a.id, status: 'OPEN' } }),
      this.prisma.assignmentGrade.aggregate({ where: { assignmentId: a.id, score: { not: null } }, _avg: { score: true } }),
    ]);
    const expected = a.workMode === 'INDIVIDUAL' ? studentCount : groups;
    return {
      id: a.id,
      title: a.title,
      workMode: a.workMode,
      hasIndividualPart: a.hasIndividualPart,
      status: a.status,
      autoOpen: a.autoOpen,
      openAt: a.openAt,
      dueAt: a.dueAt,
      finalDeadline: finalDeadline(a),
      batchId: a.batchId,
      groupsImportedAt: a.groupsImportedAt,
      gradesPublishedAt: a.gradesPublishedAt,
      avgScore: avg._avg.score == null ? null : Math.round(Number(avg._avg.score) * 10) / 10,
      stats: { students: studentCount, expected, submitted, groups, topics, graded, openReports },
      phase: assignmentPhase(a),
    };
  }

  /** Tab "Sinh viên" của trang lớp học phần. */
  async sectionStudents(lecturerId: string, sectionId: string) {
    await this.ownSection(lecturerId, sectionId);
    const [enrolled, assignments] = await Promise.all([
      this.prisma.sectionStudent.findMany({ where: { sectionId }, include: { student: { include: { user: true } } }, orderBy: { student: { studentCode: 'asc' } } }),
      this.prisma.assignment.findMany({ where: { sectionId, deletedAt: null, status: { not: 'DRAFT' } }, orderBy: { openAt: 'asc' } }),
    ]);
    const ids = assignments.map((a) => a.id);
    // bài có nhóm gần nhất → cột "Nhóm · <bài tập>"
    const groupAssignment = [...assignments].reverse().find((a) => a.workMode === 'GROUP') ?? null;
    const [members, personal, topics, grades] = await Promise.all([
      this.prisma.groupMember.findMany({
        where: { assignmentId: { in: ids } },
        include: { group: { include: { topic: true, submissions: { where: { kind: 'GROUP_SHARED' } } } } },
      }),
      this.prisma.submission.findMany({ where: { assignmentId: { in: ids }, kind: 'PERSONAL' } }),
      this.prisma.topic.findMany({ where: { assignmentId: { in: ids }, studentId: { not: null } }, orderBy: { createdAt: 'asc' } }),
      this.prisma.assignmentGrade.findMany({ where: { assignmentId: { in: ids }, score: { not: null } } }),
    ]);

    return {
      groupAssignment: groupAssignment && { id: groupAssignment.id, title: groupAssignment.title },
      totalAssignments: assignments.length,
      students: enrolled.map(({ student: s }) => {
        let submitted = 0;
        const scores: number[] = [];
        for (const a of assignments) {
          const m = members.find((x) => x.assignmentId === a.id && x.studentId === s.id);
          const sub = m ? m.group.submissions[0] : personal.find((p) => p.assignmentId === a.id && p.studentId === s.id);
          if (sub) submitted++;
          const g = grades.find((x) => x.assignmentId === a.id && x.studentId === s.id);
          if (g?.score != null) scores.push(Number(g.score));
        }
        const gm = groupAssignment ? members.find((x) => x.assignmentId === groupAssignment.id && x.studentId === s.id) : undefined;
        const ownTopics = topics.filter((t) => t.studentId === s.id);
        const latestTopic = gm?.group.topic?.title ?? ownTopics[ownTopics.length - 1]?.title ?? null;
        return {
          id: s.id,
          studentCode: s.studentCode,
          fullName: s.fullName,
          cohort: s.cohort,
          group: gm ? { seq: gm.group.seq, code: gm.group.code, name: gm.group.name, isLeader: gm.role === 'LEADER' } : null,
          neverLoggedIn: !s.user.lastLoginAt,
          topic: latestTopic,
          submitted,
          avgScore: scores.length ? Math.round((scores.reduce((x, y) => x + y, 0) / scores.length) * 10) / 10 : null,
          profileCompleted: !!s.profileCompletedAt,
        };
      }),
    };
  }

  /** Tab "Nhóm" của trang lớp học phần: nhóm của mọi bài tập có nhóm. */
  async sectionGroups(lecturerId: string, sectionId: string) {
    await this.ownSection(lecturerId, sectionId);
    const groups = await this.prisma.group.findMany({
      where: { assignment: { sectionId, deletedAt: null } },
      include: {
        assignment: true,
        members: { include: { student: true }, orderBy: [{ role: 'asc' }, { student: { studentCode: 'asc' } }] },
        topic: true,
        submissions: { where: { kind: 'GROUP_SHARED' } },
      },
      orderBy: [{ assignment: { openAt: 'asc' } }, { seq: 'asc' }],
    });
    return groups.map((g) => ({
      id: g.id,
      seq: g.seq,
      code: g.code,
      name: g.name,
      assignment: { id: g.assignment.id, title: g.assignment.title },
      members: g.members.map((m) => ({ studentCode: m.student.studentCode, fullName: m.student.fullName, role: m.role })),
      topic: g.topic && { title: g.topic.title, keywords: g.topic.keywords },
      submission: g.submissions[0] ? { status: g.submissions[0].status, isLate: g.submissions[0].isLate, submittedAt: g.submissions[0].submittedAt } : null,
    }));
  }

  // ================================================================ Sửa bài tập (UC04.5)

  /** Dữ liệu mở form sửa: giá trị hiện tại + các trường bị khóa. */
  async editData(lecturerId: string, id: string) {
    const a = await this.prisma.assignment.findFirst({ where: { id, deletedAt: null }, include: { section: { include: { course: true } } } });
    if (!a) throw notFound('Bài tập');
    if (a.section.lecturerId !== lecturerId) throw forbidden('Bạn không phụ trách bài tập này');
    const [subs, groups, works] = await Promise.all([
      this.prisma.submission.count({ where: { assignmentId: id } }),
      this.prisma.group.count({ where: { assignmentId: id } }),
      this.prisma.individualWork.count({ where: { assignmentId: id } }),
    ]);
    const [groupRows, graded, history] = await Promise.all([
      this.prisma.group.findMany({ where: { assignmentId: id }, include: { _count: { select: { members: true } } }, orderBy: { seq: 'asc' } }),
      this.prisma.assignmentGrade.count({ where: { assignmentId: id, score: { not: null } } }),
      this.audit.history('assignment', id, 10),
    ]);
    const { section, briefFilePath: _p, ...rest } = a;
    return {
      ...rest,
      briefFileSize: rest.briefFileSize == null ? null : Number(rest.briefFileSize),
      section: { id: section.id, code: section.code, course: { name: section.course.name } },
      counts: { groups, submissions: subs, graded, individuals: works },
      groups: groupRows.map((g) => ({ id: g.id, seq: g.seq, code: g.code, name: g.name, members: g._count.members })),
      history: history.map((h) => ({ action: h.action, summary: h.summary, actor: h.actor?.lecturer?.fullName ?? h.actor?.student?.fullName ?? 'Hệ thống', createdAt: h.createdAt })),
      locked: { workMode: groups + works + subs > 0, openAt: a.status !== 'DRAFT', hasSubmissions: subs > 0 },
    };
  }

  async update(lecturerId: string, userId: string, id: string, dto: AssignmentUpdate) {
    const a = await this.prisma.assignment.findFirst({ where: { id, deletedAt: null }, include: { section: { include: { semester: true } } } });
    if (!a) throw notFound('Bài tập');
    if (a.section.lecturerId !== lecturerId) throw forbidden('Bạn không phụ trách bài tập này');
    const [subs, groups, works] = await Promise.all([
      this.prisma.submission.count({ where: { assignmentId: id } }),
      this.prisma.group.count({ where: { assignmentId: id } }),
      this.prisma.individualWork.count({ where: { assignmentId: id } }),
    ]);
    const c = dto.common;
    const s = dto.schedule;
    const fail = (m: string) => new AppException('ASSIGNMENT_INVALID_DATES', m, HttpStatus.BAD_REQUEST);

    // SV đã bắt đầu làm bài thì không đổi hình thức; đã có bài nộp thì không bỏ loại sản phẩm đã dùng
    if ((groups || works || subs) && c.workMode !== a.workMode)
      throw new AppException('WORK_MODE_LOCKED', 'Đã có nhóm, đề tài hoặc bài nộp, không đổi được hình thức', HttpStatus.CONFLICT);
    if (subs) {
      const used = await this.prisma.submissionFile.findMany({
        where: { submission: { assignmentId: id }, deletedAt: null },
        select: { fileType: true },
        distinct: ['fileType'],
      });
      const missing = used.map((u) => PRODUCT_FOR_FILE[u.fileType]).filter((p) => !c.productTypes.includes(p));
      if (missing.length) throw new AppException('VALIDATION_ERROR', 'Không bỏ được loại sản phẩm đã có bài nộp', HttpStatus.CONFLICT, { missing });
    }

    const openAt = a.status === 'DRAFT' ? s.openAt : a.openAt; // bài đã mở thì giữ ngày mở
    if (s.dueAt <= openAt) throw fail('Hạn nộp phải sau ngày mở (BR-04)');
    const pastSemester = this.semesterEnded(a.section.semester.endDate);
    if (!pastSemester && s.dueAt.getTime() !== a.dueAt.getTime() && s.dueAt <= new Date()) throw fail('Hạn nộp mới phải ở tương lai');
    if (!pastSemester && s.dueAt > this.endOfSemester(a.section.semester.endDate)) throw fail('Hạn nộp phải nằm trong học kỳ (BR-04)');
    const lateDueAt = c.allowLate && c.lateDays ? new Date(s.dueAt.getTime() + c.lateDays * 86400000) : null;

    // ---- đổi thư mục nhận bài (UC04.6)
    let folderPatch: { driveParentFolderId: string; driveFolderId: string } | null = null;
    if (c.folderUrl) {
      const newParent = this.drive.parseFolderId(c.folderUrl);
      if (newParent !== a.driveParentFolderId) {
        await this.drive.verifyWritable(newParent, lecturerId);
        const mode = dto.folderMode ?? 'move';
        if (mode === 'move') {
          // chuyển cả thư mục bài tập (gồm thư mục nhóm/cá nhân, tệp đã nộp) sang thư mục mới
          await this.drive.move(a.driveFolderId, newParent, lecturerId);
          folderPatch = { driveParentFolderId: newParent, driveFolderId: a.driveFolderId };
        } else {
          const folderId = await this.drive.createFolder(sanitizeName(`${a.section.code}_${c.title}`), newParent, lecturerId);
          folderPatch = { driveParentFolderId: newParent, driveFolderId: folderId };
          // bài nộp mới tạo thư mục nhóm/cá nhân trong thư mục mới
          await this.prisma.$transaction([
            this.prisma.group.updateMany({ where: { assignmentId: id }, data: { driveFolderId: null, driveSharedFolderId: null } }),
            this.prisma.groupMember.updateMany({ where: { assignmentId: id }, data: { drivePersonalFolderId: null } }),
            this.prisma.individualWork.updateMany({ where: { assignmentId: id }, data: { driveFolderId: null } }),
          ]);
        }
      }
    }

    const updated = await this.prisma.assignment.update({
      where: { id },
      data: {
        title: c.title,
        description: c.description,
        workMode: c.workMode,
        productTypes: c.productTypes,
        openAt,
        dueAt: s.dueAt,
        allowLate: c.allowLate,
        lateDueAt,
        hasIndividualPart: c.workMode === 'GROUP' && c.hasIndividualPart,
        suggestedTopics: c.suggestedTopics,
        ...(folderPatch ?? {}),
        // gia hạn bài đã đóng → mở lại
        status: a.status === 'CLOSED' && (lateDueAt ?? s.dueAt) > new Date() ? 'OPEN' : a.status,
      },
    });

    // ---- lịch sử thay đổi
    const fmt = (d: Date) => d.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    const changes: string[] = [];
    if (a.title !== c.title) changes.push(`Đổi tiêu đề → “${c.title}”`);
    if (a.dueAt.getTime() !== s.dueAt.getTime()) changes.push(`${s.dueAt > a.dueAt ? 'Gia hạn' : 'Đổi hạn nộp'} ${fmt(a.dueAt)} → ${fmt(s.dueAt)}`);
    if (a.workMode !== c.workMode) changes.push(`Đổi hình thức → ${c.workMode === 'GROUP' ? 'nhóm' : 'cá nhân'}`);
    if (a.hasIndividualPart !== updated.hasIndividualPart) changes.push(`${updated.hasIndividualPart ? 'Bật' : 'Tắt'} phần cá nhân`);
    if (a.allowLate !== c.allowLate) changes.push(`${c.allowLate ? 'Cho phép' : 'Không cho'} nộp muộn`);
    if (folderPatch) changes.push('Đổi thư mục Drive nhận bài');
    if (a.description !== c.description) changes.push('Sửa mô tả đề bài');
    if (changes.length)
      await this.audit.log({ actorId: userId, action: 'UPDATE', entityType: 'assignment', entityId: id, summary: changes.join(' · ') });

    if (s.dueAt.getTime() !== a.dueAt.getTime() && updated.status === 'OPEN') {
      const students = await this.prisma.sectionStudent.findMany({ where: { sectionId: a.sectionId }, include: { student: true } });
      await this.notifications.notify(students.map((x) => x.student.userId), {
        type: 'ASSIGNMENT_UPDATED',
        title: `Đổi hạn nộp: ${updated.title}`,
        body: `Hạn mới ${s.dueAt.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}`,
        link: `/student/assignments/${id}`,
      });
    }
    return { id };
  }

  // ================================================================ Đóng / mở lại / hủy giao (UC04.5, UC04.8)

  async ownAssignment(lecturerId: string, id: string) {
    const a = await this.prisma.assignment.findFirst({ where: { id, deletedAt: null }, include: { section: true } });
    if (!a) throw notFound('Bài tập');
    if (a.section.lecturerId !== lecturerId) throw forbidden('Bạn không phụ trách bài tập này');
    return a;
  }

  async close(lecturerId: string, id: string) {
    await this.ownAssignment(lecturerId, id);
    await this.prisma.assignment.update({ where: { id }, data: { status: 'CLOSED' } });
    return { ok: true };
  }

  async reopen(lecturerId: string, id: string, dueAt: Date) {
    await this.ownAssignment(lecturerId, id);
    if (dueAt <= new Date()) throw new AppException('ASSIGNMENT_INVALID_DATES', 'Hạn nộp mới phải ở tương lai');
    await this.prisma.assignment.update({ where: { id }, data: { status: 'OPEN', dueAt, lateDueAt: null, allowLate: false } });
    return { ok: true };
  }

  /** Xóa bài tập khi chưa có đề tài, bài nộp (UC04.7). Danh sách nhóm đã tải lên bị xóa theo. */
  async remove(lecturerId: string, id: string) {
    const a = await this.ownAssignment(lecturerId, id);
    const [subs, topics] = await Promise.all([
      this.prisma.submission.count({ where: { assignmentId: id } }),
      this.prisma.topic.count({ where: { assignmentId: id } }),
    ]);
    if (subs)
      throw new AppException('ASSIGNMENT_HAS_SUBMISSIONS', 'Bài tập đã có bài nộp, chỉ có thể đóng', HttpStatus.CONFLICT);
    if (topics)
      throw new AppException('ASSIGNMENT_HAS_SUBMISSIONS', 'Sinh viên đã nhập đề tài, chỉ có thể đóng', HttpStatus.CONFLICT);
    await this.prisma.$transaction([
      this.prisma.groupMember.deleteMany({ where: { assignmentId: id } }),
      this.prisma.group.deleteMany({ where: { assignmentId: id } }),
      this.prisma.groupReport.deleteMany({ where: { assignmentId: id } }),
      this.prisma.importJob.deleteMany({ where: { assignmentId: id } }),
      this.prisma.individualWork.deleteMany({ where: { assignmentId: id } }),
      this.prisma.assignment.update({ where: { id }, data: { deletedAt: new Date() } }),
    ]);
    await this.drive.trash(a.driveFolderId, lecturerId).catch((e) => this.logger.warn(`Không chuyển được thư mục vào thùng rác: ${e}`));
    return { ok: true };
  }

  /**
   * UC06.10 – nhắc SV chưa nộp khi còn ≤ REMINDER_HOURS giờ tới hạn (mặc định 24 giờ).
   * Bài nhóm: nhóm chưa có bài chung → nhắc mọi thành viên. Mỗi SV chỉ nhận 1 lần / bài (dedupe_key).
   */
  async remindDue() {
    const now = new Date();
    const until = new Date(now.getTime() + (await this.config.get()).reminder.hours * 3600_000);
    const list = await this.prisma.assignment.findMany({
      where: { status: 'OPEN', deletedAt: null, openAt: { lte: now }, dueAt: { gt: now, lte: until } },
      include: {
        section: { include: { students: { include: { student: { select: { id: true, userId: true } } } } } },
        groups: { include: { members: { select: { studentId: true } }, submissions: { where: { kind: 'GROUP_SHARED' }, select: { id: true } } } },
        submissions: { where: { kind: 'PERSONAL' }, select: { studentId: true } },
      },
    });
    let count = 0;
    for (const a of list) {
      const users =
        a.workMode === 'GROUP'
          ? a.groups.filter((g) => !g.submissions.length).flatMap((g) => g.members.map((m) => a.section.students.find((x) => x.studentId === m.studentId)?.student.userId)).filter((x): x is string => !!x)
          : a.section.students.filter((x) => !a.submissions.some((s) => s.studentId === x.studentId)).map((x) => x.student.userId);
      if (!users.length) continue;
      const hours = Math.max(1, Math.round((a.dueAt.getTime() - now.getTime()) / 3600_000));
      count += await this.notifications.notify(users, {
        type: 'DEADLINE_REMINDER',
        title: `Còn ${hours} giờ tới hạn nộp: ${a.title}`,
        body: `${a.workMode === 'GROUP' ? 'Nhóm bạn chưa nộp bài chung.' : 'Bạn chưa nộp bài.'} Hạn nộp ${a.dueAt.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}.`,
        link: `/student/assignments/${a.id}`,
        dedupeKey: `reminder:${a.id}`,
      });
    }
    return count;
  }

  /** Bộ hẹn giờ: DRAFT có open_at ≤ now → OPEN + thông báo (job assignments.open-due). */
  async openDue() {
    const due = await this.prisma.assignment.findMany({
      where: { status: 'DRAFT', autoOpen: true, deletedAt: null, openAt: { lte: new Date() } },
      select: { id: true },
    });
    for (const { id } of due) {
      await this.prisma.assignment.update({ where: { id }, data: { status: 'OPEN' } });
      await this.notifyOpened(id);
    }
    return due.length;
  }
}
