import { Body, Controller, Get, Module, Param, ParseUUIDPipe, Post, Query, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { z } from 'zod';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { AuthUser, CurrentUser, Roles } from '../../common/auth/auth.decorators';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { AppException } from '../../common/errors/app-exception';
import { IMPORT_MAX_BYTES } from '../../common/utils/excel';
import { commitSchema, publishSectionSchema } from '../assignments/assignments.schemas';
import { GradesService } from './grades.service';

const score = z.number().min(0, 'Điểm 0–10').max(10, 'Điểm 0–10').nullable();
const gradeRequestSchema = z.object({
  studentId: z.string().uuid(),
  values: z.object({ attendance: score.optional(), assignment: score.optional(), midterm: score.optional(), final: score.optional() }),
  reason: z.string().trim().min(10, 'Lý do tối thiểu 10 ký tự').max(1000),
});
const resolveSchema = z.object({ note: z.string().trim().max(500).optional() });

/** Interceptor nhận một tệp Excel vào bộ nhớ (≤ 5 MB – BR-23). */
export const ExcelUpload = () =>
  UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: IMPORT_MAX_BYTES + 1024 } }));

export function excelFile(file?: Express.Multer.File) {
  if (!file) throw new AppException('IMPORT_INVALID_FILE', 'Chọn tệp Excel (.xlsx)');
  file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
  return file;
}

export function sendXlsx(res: Response, f: { buffer: Buffer; fileName: string }) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(f.fileName)}`);
  res.end(f.buffer);
}

/** Điểm bài tập & điểm học phần – ModulesStructure §4.7. */
@Controller('lecturer')
@Roles('LECTURER')
export class LecturerGradesController {
  constructor(private readonly grades: GradesService) {}

  // ---- điểm bài tập
  @Get('assignments/:id/grades')
  assignmentGrades(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.grades.assignmentGrades(u.lecturerId!, id);
  }

  @Get('assignments/:id/grades/template')
  async assignmentTemplate(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    sendXlsx(res, await this.grades.assignmentTemplate(u.lecturerId!, id));
  }

  @Post('assignments/:id/grades/import/preview')
  @ExcelUpload()
  assignmentPreview(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @UploadedFile() file?: Express.Multer.File) {
    return this.grades.assignmentPreview(u.lecturerId!, u.sub, id, excelFile(file));
  }

  @Post('assignments/:id/grades/import/:jobId/commit')
  assignmentCommit(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Body(new ZodPipe(commitSchema)) dto: { onlyValid?: boolean },
  ) {
    return this.grades.assignmentCommit(u.lecturerId!, u.sub, id, jobId, dto.onlyValid);
  }

  @Post('assignments/:id/grades/publish')
  assignmentPublish(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.grades.assignmentPublish(u.lecturerId!, u.sub, id);
  }

  // ---- bảng điểm học phần
  @Get('gradebooks')
  gradebooks(@CurrentUser() u: AuthUser) {
    return this.grades.gradebooks(u.lecturerId!);
  }

  @Get('sections/:id/grades')
  sectionGrades(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.grades.sectionGrades(u.lecturerId!, id);
  }

  @Get('sections/:id/grades/template')
  async sectionTemplate(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    sendXlsx(res, await this.grades.sectionTemplate(u.lecturerId!, id));
  }

  @Post('sections/:id/grades/import/preview')
  @ExcelUpload()
  sectionPreview(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @UploadedFile() file?: Express.Multer.File) {
    return this.grades.sectionPreview(u.lecturerId!, u.sub, id, excelFile(file));
  }

  @Post('sections/:id/grades/import/:jobId/commit')
  sectionCommit(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Body(new ZodPipe(commitSchema)) dto: { onlyValid?: boolean },
  ) {
    return this.grades.sectionCommit(u.lecturerId!, u.sub, id, jobId, dto.onlyValid);
  }

  @Get('sections/:id/grades/export')
  async sectionExport(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    sendXlsx(res, await this.grades.sectionExport(u.lecturerId!, id));
  }

  @Get('sections/:id/grade-requests')
  gradeRequests(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.grades.gradeRequests(u.lecturerId!, id);
  }

  @Post('sections/:id/grade-requests')
  createGradeRequest(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(gradeRequestSchema)) dto: z.infer<typeof gradeRequestSchema>) {
    return this.grades.createGradeRequest(u.lecturerId!, u.sub, id, dto);
  }

  @Post('grade-requests/:id/cancel')
  cancelGradeRequest(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.grades.cancelGradeRequest(u.lecturerId!, id);
  }

  @Post('sections/:id/grades/publish')
  sectionPublish(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(publishSectionSchema)) dto: { allowIncomplete?: boolean }) {
    return this.grades.sectionPublish(u.lecturerId!, u.sub, id, dto.allowIncomplete);
  }
}

@Controller('me')
@Roles('STUDENT')
export class MyGradesController {
  constructor(private readonly grades: GradesService) {}

  @Get('grades')
  myGrades(@CurrentUser() u: AuthUser) {
    return this.grades.myGrades(u.studentId!);
  }

  @Get('stats')
  myStats(@CurrentUser() u: AuthUser) {
    return this.grades.myStats(u.studentId!);
  }
}

/** UC07.8 – Admin xử lý yêu cầu sửa điểm (chưa có giao diện Admin, gọi qua API). */
@Controller('admin/grade-requests')
@Roles('ADMIN')
export class AdminGradeRequestsController {
  constructor(private readonly grades: GradesService) {}

  @Get()
  list(@Query('status') status?: string) {
    return this.grades.adminGradeRequests(status);
  }

  @Post(':id/approve')
  approve(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(resolveSchema)) dto: { note?: string }) {
    return this.grades.resolveGradeRequest(u.sub, id, true, dto.note);
  }

  @Post(':id/reject')
  reject(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(resolveSchema)) dto: { note?: string }) {
    return this.grades.resolveGradeRequest(u.sub, id, false, dto.note);
  }
}

@Module({
  controllers: [LecturerGradesController, MyGradesController, AdminGradeRequestsController],
  providers: [GradesService],
  exports: [GradesService],
})
export class GradesModule {}
