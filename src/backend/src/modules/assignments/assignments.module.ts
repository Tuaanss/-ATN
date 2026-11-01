import {
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  Logger,
  Module,
  OnModuleDestroy,
  OnModuleInit,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { diskStorage } from 'multer';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { z } from 'zod';
import { env } from '../../config/env';
import { AuthUser, CurrentUser, Roles } from '../../common/auth/auth.decorators';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { AppException } from '../../common/errors/app-exception';
import { SubmissionsModule } from '../submissions/submissions.module';
import { GroupsService } from '../groups/groups.service';
import { ExcelUpload, excelFile, sendXlsx } from '../grades/grades.module';
import { AssignmentsService } from './assignments.service';
import { AssignmentDetailService } from './assignment-detail.service';
import {
  AssignmentUpdate,
  BatchCreateDto,
  SingleCreateDto,
  batchCreateSchema,
  checkFolderSchema,
  commitSchema,
  driveLinkSchema,
  editSchema,
  resolveReportSchema,
  singleCreateSchema,
} from './assignments.schemas';

const reopenSchema = z.object({ dueAt: z.coerce.date() });

/** API phía giảng viên – ModulesStructure §4.4. */
@Controller('lecturer')
@Roles('LECTURER')
export class LecturerAssignmentsController {
  constructor(
    private readonly service: AssignmentsService,
    private readonly detailService: AssignmentDetailService,
    private readonly groups: GroupsService,
  ) {}

  // ---- Drive
  @Get('drive-link')
  driveLink(@CurrentUser() u: AuthUser) {
    return this.service.getDriveLink(u.lecturerId!);
  }

  @Put('drive-link')
  saveDriveLink(@CurrentUser() u: AuthUser, @Body(new ZodPipe(driveLinkSchema)) dto: { folderUrl: string }) {
    return this.service.saveDriveLink(u.lecturerId!, dto.folderUrl);
  }

  @Get('drive/oauth/start')
  oauthStart(@CurrentUser() u: AuthUser) {
    return this.service.oauthStart(u.lecturerId!);
  }

  /** Google chuyển hướng về đây sau khi GV đồng ý → quay lại trang Kết nối Google Drive. */
  @Get('drive/oauth/callback')
  async oauthCallback(@CurrentUser() u: AuthUser, @Query('code') code: string, @Query('state') state: string, @Query('error') error: string | undefined, @Res() res: Response) {
    const back = `${env.WEB_ORIGIN.replace(/\/$/, '')}/lecturer/drive`;
    if (error || !code) return res.redirect(`${back}?error=${encodeURIComponent(error === 'access_denied' ? 'Bạn đã từ chối cấp quyền' : (error ?? 'Thiếu mã ủy quyền'))}`);
    try {
      await this.service.oauthCallback(u.lecturerId!, u.code ?? 'GV', code, state);
      return res.redirect(`${back}?linked=1`);
    } catch (e) {
      return res.redirect(`${back}?error=${encodeURIComponent((e as Error).message)}`);
    }
  }

  @Delete('drive/oauth')
  oauthUnlink(@CurrentUser() u: AuthUser) {
    return this.service.oauthUnlink(u.lecturerId!);
  }

  /** Chuyển thư mục bài tập cũ vào cấu trúc <học kỳ>/<lớp học phần>. */
  @Post('drive/reorganize')
  reorganize(@CurrentUser() u: AuthUser) {
    return this.service.reorganizeFolders(u.lecturerId!);
  }

  @Post('drive/recheck')
  recheckDrive(@CurrentUser() u: AuthUser) {
    return this.service.recheckDrive(u.lecturerId!);
  }

  @Post('drive/check')
  checkFolder(@CurrentUser() u: AuthUser, @Body(new ZodPipe(checkFolderSchema)) dto: { folderUrl: string }) {
    return this.service.checkFolder(u.lecturerId!, dto.folderUrl);
  }

  // ---- lớp học phần
  @Get('sections')
  sections(@CurrentUser() u: AuthUser) {
    return this.service.lecturerSections(u.lecturerId!);
  }

  @Get('sections/:id/assignments')
  sectionAssignments(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.sectionAssignments(u.lecturerId!, id);
  }

  @Get('sections/:id/students')
  sectionStudents(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.sectionStudents(u.lecturerId!, id);
  }

  @Get('sections/:id/groups')
  sectionGroups(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.sectionGroups(u.lecturerId!, id);
  }

  // ---- tạo / sửa bài tập
  @Post('sections/:id/assignments')
  createForSection(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(singleCreateSchema)) dto: SingleCreateDto) {
    return this.service.createBatch(u.lecturerId!, { common: dto.common, sections: [{ ...dto.schedule, sectionId: id }] });
  }

  @Post('assignments/batch')
  createBatch(@CurrentUser() u: AuthUser, @Body(new ZodPipe(batchCreateSchema)) dto: BatchCreateDto) {
    return this.service.createBatch(u.lecturerId!, dto);
  }

  @Get('assignments/:id')
  detail(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.detailService.get(u.lecturerId!, id);
  }

  @Get('assignments/:id/edit')
  editData(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.editData(u.lecturerId!, id);
  }

  @Patch('assignments/:id')
  update(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(editSchema)) dto: AssignmentUpdate) {
    return this.service.update(u.lecturerId!, u.sub, id, dto);
  }

  @Post('assignments/:id/publish')
  publish(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.publish(u.lecturerId!, u.sub, id);
  }

  @Post('assignments/:id/brief')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({ destination: path.join(env.DATA_DIR, 'uploads'), filename: (_r, _f, cb) => cb(null, randomUUID()) }),
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  )
  uploadBrief(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new AppException('VALIDATION_ERROR', 'Chọn tệp đề bài');
    return this.service.uploadBrief(u.lecturerId!, u.sub, id, file);
  }

  @Post('assignments/:id/close')
  close(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.close(u.lecturerId!, id);
  }

  @Post('assignments/:id/reopen')
  reopen(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(reopenSchema)) dto: { dueAt: Date }) {
    return this.service.reopen(u.lecturerId!, id, dto.dueAt);
  }

  @Delete('assignments/:id')
  remove(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(u.lecturerId!, id);
  }

  // ---- nhóm theo file Excel (UC05.1–5.4, 5.6)
  @Get('assignments/:id/groups')
  groupList(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.groups.list(u.lecturerId!, id);
  }

  @Get('assignments/:id/groups/template')
  async groupTemplate(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    sendXlsx(res, await this.groups.template(u.lecturerId!, id));
  }

  @Post('assignments/:id/groups/import/preview')
  @ExcelUpload()
  groupPreview(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @UploadedFile() file?: Express.Multer.File) {
    return this.groups.preview(u.lecturerId!, u.sub, id, excelFile(file));
  }

  @Post('assignments/:id/groups/import/:jobId/commit')
  groupCommit(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Body(new ZodPipe(commitSchema)) dto: { onlyValid?: boolean },
  ) {
    return this.groups.commit(u.lecturerId!, u.sub, id, jobId, dto.onlyValid);
  }

  @Post('group-reports/:id/resolve')
  resolveReport(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(resolveReportSchema)) dto: { note?: string }) {
    return this.groups.resolveReport(u.lecturerId!, u.sub, id, dto.note);
  }
}

/**
 * Bộ hẹn giờ tối giản trong tiến trình api (mỗi phút): mở bài tập đến hạn.
 * Khi tách worker + BullMQ (TechTasks T-302) thì chuyển sang job lặp `assignments.open-due`.
 */
@Injectable()
export class AssignmentsScheduler implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private readonly logger = new Logger('Scheduler');

  constructor(private readonly service: AssignmentsService) {}

  onModuleInit() {
    const tick = async () => {
      try {
        const opened = await this.service.openDue();
        if (opened) this.logger.log(`Đã mở ${opened} bài tập đến hạn`);
        const reminded = await this.service.remindDue();
        if (reminded) this.logger.log(`Đã gửi nhắc hạn nộp cho ${reminded} sinh viên`);
      } catch (e) {
        this.logger.error(e);
      }
    };
    this.timer = setInterval(() => void tick(), 60_000);
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }
}

@Module({
  imports: [SubmissionsModule],
  controllers: [LecturerAssignmentsController],
  providers: [AssignmentsService, AssignmentDetailService, AssignmentsScheduler],
  exports: [AssignmentsService],
})
export class AssignmentsModule {}
