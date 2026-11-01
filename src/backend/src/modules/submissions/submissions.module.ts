import {
  Body,
  Controller,
  Delete,
  Get,
  Module,
  OnApplicationBootstrap,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  Res,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { diskStorage } from 'multer';
import { randomUUID } from 'node:crypto';
import { createReadStream, promises as fs } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { env } from '../../config/env';
import { AuthUser, CurrentUser, Roles } from '../../common/auth/auth.decorators';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { PrismaService } from '../../common/prisma/prisma.service';
import { forbidden, notFound } from '../../common/errors/app-exception';
import { StorageService } from '../../infra/storage/storage.service';
import { DriveService } from '../../infra/drive/drive.service';
import { GroupsService } from '../groups/groups.service';
import { TopicsService } from '../topics/topics.service';
import { StudentWorkService } from './student-work.service';
import { SubmissionsService } from './submissions.service';
import { DriveSyncService } from './drive-sync.service';

const topicSchema = z.object({
  title: z.string().trim().min(5, 'Tên đề tài 5–200 ký tự').max(200, 'Tên đề tài 5–200 ký tự'),
  keywords: z.array(z.string().trim().min(1).max(50, 'Mỗi từ khóa ≤ 50 ký tự')).min(1, 'Gắn ít nhất 1 từ khóa').max(5, 'Tối đa 5 từ khóa'),
});
const reportSchema = z.object({ content: z.string().trim().min(5, 'Mô tả ít nhất 5 ký tự').max(500, 'Tối đa 500 ký tự') });
const submitSchema = z.object({
  kind: z.enum(['GROUP_SHARED', 'PERSONAL']),
  figmaUrl: z.string().optional(),
  gitUrl: z.string().optional(),
  note: z.string().max(2000).optional(),
  contributionPercent: z.coerce.number().int().min(0).max(100).optional(),
});
const deleteFilesSchema = z.object({ fileIds: z.array(z.string().uuid()).min(1, 'Chọn tệp cần xóa') });

/** API phía sinh viên – ModulesStructure §4.4–4.6. */
@Controller('student')
@Roles('STUDENT')
export class StudentController {
  constructor(
    private readonly work: StudentWorkService,
    private readonly submissions: SubmissionsService,
    private readonly groups: GroupsService,
    private readonly topics: TopicsService,
  ) {}

  @Get('sections')
  sections(@CurrentUser() u: AuthUser) {
    return this.work.mySections(u.studentId!);
  }

  @Get('sections/:id')
  sectionDetail(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.work.sectionDetail(u.studentId!, id);
  }

  @Get('assignments')
  myAssignments(@CurrentUser() u: AuthUser) {
    return this.work.myAssignments(u.studentId!);
  }

  @Get('assignments/:id')
  myWork(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.work.myWork(u.studentId!, id);
  }

  // ---- nhóm (GV tải lên) – SV chỉ xem và báo chưa đúng
  @Post('assignments/:id/group-report')
  groupReport(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(reportSchema)) dto: { content: string }) {
    return this.groups.report(u.studentId!, id, dto.content);
  }

  // ---- đề tài
  @Put('assignments/:id/topic')
  saveTopic(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(topicSchema)) dto: z.infer<typeof topicSchema>) {
    return this.topics.save(u.studentId!, u.sub, id, dto);
  }

  // ---- nộp bài
  /** Nộp / nộp lại (multipart: files[] + kind, figmaUrl, gitUrl, note, contributionPercent). */
  @Post('assignments/:id/submissions')
  @UseInterceptors(
    FilesInterceptor('files', 40, {
      storage: diskStorage({ destination: path.join(env.DATA_DIR, 'uploads'), filename: (_req, _file, cb) => cb(null, randomUUID()) }),
      limits: { fileSize: env.UPLOAD_MAX_FILE_MB * 1024 * 1024, files: 40 },
    }),
  )
  submit(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(submitSchema)) dto: z.infer<typeof submitSchema>,
    @UploadedFiles() files: Express.Multer.File[] = [],
  ) {
    // multer đọc tên tệp theo latin1 → đổi về UTF-8 để giữ tiếng Việt
    for (const f of files) f.originalname = Buffer.from(f.originalname, 'latin1').toString('utf8');
    return this.submissions.submit(u.studentId!, id, dto, files);
  }

  @Delete('submissions/:id/files')
  deleteFiles(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(deleteFilesSchema)) dto: { fileIds: string[] }) {
    return this.submissions.deleteFiles(u.studentId!, id, dto.fileIds);
  }
}

/** Xem / tải tệp bài nộp và tệp đề bài qua API (BR-20, ADR-06) – hỗ trợ Range để tua video. */
@Controller('files')
export class FilesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly drive: DriveService,
  ) {}

  @Get(':id/content')
  async content(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Query('download') download: string | undefined, @Req() req: Request, @Res() res: Response) {
    const file = await this.prisma.submissionFile.findFirst({
      where: { id, deletedAt: null },
      include: { submission: { include: { assignment: { include: { section: true } } } } },
    });
    if (!file) throw notFound('Tệp');
    await this.assertCanView(u, file.submission);
    const local = (await this.storage.exists(file.localPath)) ? file.localPath! : null;
    if (!local && !file.driveFileId) throw notFound('Tệp');
    await this.stream(req, res, {
      size: Number(file.sizeBytes),
      mime: file.mimeType,
      name: file.originalName,
      download: !!download,
      open: (range) => (local ? createReadStream(local, range) : this.drive.openStream(file.driveFileId!, range, file.submission.assignment.createdById)),
    });
  }

  /** Chi tiết một bài nộp cho trang xem bài (Media Viewer). */
  @Get('submission/:id')
  async submission(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    const s = await this.prisma.submission.findUnique({
      where: { id },
      include: {
        assignment: { include: { section: { include: { course: true } } } },
        group: true,
        student: true,
        topic: true,
        lastSubmittedBy: true,
        files: { where: { deletedAt: null }, orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!s) throw notFound('Bài nộp');
    const grant = await this.assertCanView(u, s);
    if (grant && typeof grant === 'object' && 'enterpriseId' in grant) {
      const recent = await this.prisma.enterpriseView.findFirst({ where: { enterpriseId: grant.enterpriseId, submissionId: s.id, createdAt: { gt: new Date(Date.now() - 600_000) } } });
      if (!recent) await this.prisma.enterpriseView.create({ data: { enterpriseId: grant.enterpriseId, studentId: grant.studentId, kind: 'SUBMISSION', submissionId: s.id, label: `${s.topic?.title ?? s.assignment.title} · ${s.assignment.section.course.name}`.slice(0, 300) } });
    }
    // phần cá nhân trong bài nhóm: ghi rõ thuộc nhóm nào
    const member = s.kind === 'PERSONAL' && s.studentId
      ? await this.prisma.groupMember.findUnique({ where: { assignmentId_studentId: { assignmentId: s.assignmentId, studentId: s.studentId } }, include: { group: true } })
      : null;
    const groupName = (g: { code: string; name: string }) => (g.name && g.name !== g.code ? `${g.code} · ${g.name}` : `Nhóm ${g.code}`);
    return {
      id: s.id,
      kind: s.kind,
      owner: s.group
        ? groupName(s.group)
        : member
          ? `Phần cá nhân · ${s.student?.fullName ?? ''} (${s.student?.studentCode ?? ''}) · ${groupName(member.group)}`
          : (s.student?.fullName ?? ''),
      assignment: { id: s.assignment.id, title: s.assignment.title, section: s.assignment.section.code, course: s.assignment.section.course.name },
      topic: s.topic && { title: s.topic.title, keywords: s.topic.keywords },
      submittedBy: s.lastSubmittedBy.fullName,
      submittedAt: s.submittedAt,
      isLate: s.isLate,
      version: s.version,
      syncStatus: s.syncStatus,
      figmaUrl: s.figmaUrl,
      gitUrl: s.gitUrl,
      note: s.note,
      contributionPercent: s.contributionPercent,
      canDownload: u.role !== 'PARENT' && u.role !== 'ENTERPRISE',
      feedback:
        u.role === 'ENTERPRISE'
          ? []
          : (await this.prisma.submissionFeedback.findMany({ where: { submissionId: s.id }, include: { lecturer: true }, orderBy: { updatedAt: 'desc' } })).map((f) => ({ lecturer: f.lecturer.fullName, content: f.content, updatedAt: f.updatedAt })),
      files: s.files.map((f) => ({ id: f.id, name: f.originalName, fileType: f.fileType, mimeType: f.mimeType, size: Number(f.sizeBytes), syncStatus: f.syncStatus })),
    };
  }

  /** Tệp đề bài: GV phụ trách hoặc SV trong lớp. */
  @Get('brief/:assignmentId')
  async brief(@CurrentUser() u: AuthUser, @Param('assignmentId', ParseUUIDPipe) id: string, @Req() req: Request, @Res() res: Response) {
    const a = await this.prisma.assignment.findFirst({ where: { id, deletedAt: null }, include: { section: true } });
    if (!a || !a.briefFileName) throw notFound('Tệp đề bài');
    const ok =
      u.role === 'ADMIN' ||
      (u.role === 'LECTURER' && a.section.lecturerId === u.lecturerId) ||
      (u.role === 'STUDENT' && a.status !== 'DRAFT' && !!(await this.prisma.sectionStudent.findUnique({ where: { sectionId_studentId: { sectionId: a.sectionId, studentId: u.studentId! } } })));
    if (!ok) throw forbidden();
    const local = (await this.storage.exists(a.briefFilePath)) ? a.briefFilePath! : null;
    if (!local && !a.briefDriveFileId) throw notFound('Tệp đề bài');
    await this.stream(req, res, {
      size: Number(a.briefFileSize ?? 0),
      mime: a.briefMimeType ?? 'application/octet-stream',
      name: a.briefFileName,
      download: true,
      open: (range) => (local ? createReadStream(local, range) : this.drive.openStream(a.briefDriveFileId!, range, a.createdById)),
    });
  }

  private async stream(
    req: Request,
    res: Response,
    f: { size: number; mime: string; name: string; download: boolean; open: (range?: { start: number; end: number }) => NodeJS.ReadableStream | Promise<NodeJS.ReadableStream> },
  ) {
    const range = req.headers.range?.match(/bytes=(\d*)-(\d*)/);
    let start = 0;
    let end = f.size - 1;
    if (range) {
      start = range[1] ? Number(range[1]) : Math.max(0, f.size - Number(range[2]));
      end = range[1] && range[2] ? Math.min(Number(range[2]), f.size - 1) : f.size - 1;
      if (start >= f.size || start > end) {
        res.status(416).setHeader('Content-Range', `bytes */${f.size}`).end();
        return;
      }
      res.status(206).setHeader('Content-Range', `bytes ${start}-${end}/${f.size}`);
    }
    res.setHeader('Content-Type', f.mime);
    res.setHeader('Content-Length', String(end - start + 1));
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('Content-Disposition', `${f.download ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(f.name)}`);
    const stream = await f.open(range ? { start, end } : undefined);
    stream.on('error', () => res.destroy());
    stream.pipe(res);
  }

  /** canViewSubmission – Specification §3.1 (phần GV, SV, Admin). */
  private async assertCanView(u: AuthUser, s: { kind: string; groupId: string | null; studentId: string | null; assignment: { section: { lecturerId: string } } }) {
    if (u.role === 'ADMIN') return;
    if (u.role === 'LECTURER' && s.assignment.section.lecturerId === u.lecturerId) return;
    if (u.role === 'STUDENT') {
      if (s.kind === 'PERSONAL' && s.studentId === u.studentId) return;
      if (s.kind === 'GROUP_SHARED') {
        const m = await this.prisma.groupMember.findUnique({ where: { groupId_studentId: { groupId: s.groupId!, studentId: u.studentId! } } });
        if (m) return;
      }
    }
    if (u.role === 'ENTERPRISE') {
      const e = await this.prisma.enterprise.findUnique({ where: { userId: u.sub } });
      const owners = s.kind === 'PERSONAL' && s.studentId ? [s.studentId] : s.groupId ? (await this.prisma.groupMember.findMany({ where: { groupId: s.groupId }, select: { studentId: true } })).map((m) => m.studentId) : [];
      const grant = e && (await this.prisma.viewRequest.findFirst({ where: { enterpriseId: e.id, studentId: { in: owners }, status: 'APPROVED', expiresAt: { gt: new Date() } } }));
      if (grant) return grant;
    }
    if (u.role === 'PARENT') {
      const parent = await this.prisma.parent.findUnique({ where: { userId: u.sub }, include: { students: { select: { studentId: true } } } });
      const kids = parent?.students.map((l) => l.studentId) ?? [];
      if (s.kind === 'PERSONAL' && s.studentId && kids.includes(s.studentId)) return;
      if (s.kind === 'GROUP_SHARED' && s.groupId && (await this.prisma.groupMember.count({ where: { groupId: s.groupId, studentId: { in: kids } } }))) return;
    }
    throw forbidden('Bạn không có quyền xem bài nộp này');
  }
}

@Module({
  controllers: [StudentController, FilesController],
  providers: [StudentWorkService, SubmissionsService, DriveSyncService, GroupsService, TopicsService],
  exports: [StudentWorkService, GroupsService, TopicsService],
})
export class SubmissionsModule implements OnApplicationBootstrap {
  constructor(private readonly submissions: SubmissionsService) {}

  async onApplicationBootstrap() {
    await fs.mkdir(path.join(env.DATA_DIR, 'uploads'), { recursive: true });
    await this.submissions.cleanupUploads();
  }
}
