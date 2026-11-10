import { Body, Controller, Get, Module, Param, ParseUUIDPipe, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { AuthUser, CurrentUser, Roles } from '../../common/auth/auth.decorators';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { AppException } from '../../common/errors/app-exception';
import { IMPORT_MAX_BYTES } from '../../common/utils/excel';
import { commitSchema } from '../assignments/assignments.schemas';
import { GradesService } from './grades.service';

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

/** Điểm bài tập (chỉ lưu điểm từng bài, không tổng kết học phần) – ModulesStructure §4.7. */
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

  // ---- bảng điểm bài tập theo lớp (so sánh các bài)
  @Get('gradebooks')
  gradebooks(@CurrentUser() u: AuthUser) {
    return this.grades.gradebooks(u.lecturerId!);
  }

  @Get('sections/:id/grades')
  sectionGrades(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.grades.sectionGrades(u.lecturerId!, id);
  }

  @Get('sections/:id/grades/export')
  async sectionExport(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    sendXlsx(res, await this.grades.sectionExport(u.lecturerId!, id));
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

@Module({
  controllers: [LecturerGradesController, MyGradesController],
  providers: [GradesService],
  exports: [GradesService],
})
export class GradesModule {}
