import { Body, Controller, Delete, Get, Module, Param, ParseUUIDPipe, Post, Put, Query, Res, UploadedFile } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { AuthUser, CurrentUser, Roles } from '../../common/auth/auth.decorators';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { SystemConfigValue } from '../../common/config/system-config.service';
import { ExcelUpload, excelFile, sendXlsx } from '../grades/grades.module';
import { AdminUsersService, LecturerInput, StudentInput } from './admin-users.service';
import { AdminAcademicService, CourseInput, SectionInput, SemesterInput } from './admin-academic.service';
import { AdminSystemService, EnterpriseInput } from './admin-system.service';
import { AdminImportService, IMPORT_KINDS, ImportKind } from './admin-import.service';
import { AppException } from '../../common/errors/app-exception';

const text = (max: number, msg = 'Không được để trống') => z.string().trim().min(1, msg).max(max);
const uuidOrNull = z.string().uuid().nullable().optional();

const lecturerSchema = z.object({ code: text(20, 'Nhập mã giảng viên'), fullName: text(100, 'Nhập họ tên'), email: z.string().trim().email('Email không hợp lệ'), phone: z.string().trim().max(10).optional(), facultyId: uuidOrNull });
const studentSchema = z.object({
  studentCode: text(20, 'Nhập MSSV'),
  fullName: text(100, 'Nhập họ tên'),
  dateOfBirth: text(10, 'Nhập ngày sinh'),
  adminClassId: uuidOrNull,
  email: z.string().trim().max(255).optional(),
  phone: z.string().trim().max(10).optional(),
});
const lockSchema = z.object({ lock: z.boolean(), reason: z.string().trim().max(300).optional() });
const phoneSchema = z.object({ studentId: z.string().uuid('Chọn sinh viên'), relation: z.enum(['FATHER', 'MOTHER', 'GUARDIAN']), phone: text(15, 'Nhập SĐT mới'), note: z.string().trim().max(300).optional() });
const facultySchema = z.object({ code: text(20, 'Nhập mã khoa'), name: text(200, 'Nhập tên khoa') });
const majorSchema = z.object({ code: text(20, 'Nhập mã ngành'), name: text(200, 'Nhập tên ngành'), facultyId: z.string().uuid('Chọn khoa') });
const cohortSchema = z.object({ name: text(10, 'Nhập tên khóa'), startYear: z.number().int().min(2000).max(2100) });
const classSchema = z.object({ code: text(30, 'Nhập mã lớp'), majorId: z.string().uuid('Chọn ngành'), cohortId: z.string().uuid('Chọn khóa') });
const semesterSchema = z.object({ academicYear: text(9), term: z.enum(['TERM_1', 'TERM_2', 'SUMMER']), startDate: text(10), endDate: text(10) });
const weight = z.number().int().min(0).max(100);
const courseSchema = z.object({
  code: text(20, 'Nhập mã môn'),
  name: text(200, 'Nhập tên môn'),
  credits: z.number().int().min(1, 'Tín chỉ 1–10').max(10, 'Tín chỉ 1–10'),
  courseType: z.enum(['DESIGN', 'PROGRAMMING', 'OTHER']),
  facultyId: uuidOrNull,
  wAttendance: weight,
  wAssignment: weight,
  wMidterm: weight,
  wFinal: weight,
  isActive: z.boolean().optional(),
});
const sectionSchema = z.object({
  semesterId: z.string().uuid('Chọn học kỳ'),
  courseId: z.string().uuid('Chọn môn'),
  code: text(30, 'Nhập mã lớp'),
  lecturerId: z.string().uuid('Chọn giảng viên'),
  maxStudents: z.number().int(),
  weekStart: z.number().int(),
  weekEnd: z.number().int(),
  sessions: z.array(z.object({ day: z.number().int(), from: z.number().int(), to: z.number().int(), room: z.string().max(30) })).max(7),
});
const codesSchema = z.object({ codes: z.array(z.string().max(20)).min(1, 'Nhập ít nhất một MSSV').max(300) });
const decideSchema = z.object({ action: z.enum(['approve', 'reject', 'lock', 'unlock']), reason: z.string().trim().max(500).optional() });
const enterpriseSchema = z.object({
  name: text(200, 'Nhập tên doanh nghiệp'),
  taxCode: text(20, 'Nhập mã số thuế'),
  field: text(100, 'Chọn lĩnh vực'),
  website: z.string().trim().max(255).optional(),
  contactName: text(100, 'Nhập người liên hệ'),
  phone: text(15, 'Nhập SĐT'),
  email: z.string().trim().email('Email không hợp lệ'),
});
const configSchema = z.object({
  files: z.object({
    imageMaxMB: z.number().min(1).max(100),
    imageMax: z.number().int().min(1).max(100),
    videoMaxMB: z.number().min(1).max(2000),
    videoMax: z.number().int().min(1).max(20),
    sourceMaxMB: z.number().min(1).max(500),
    sourceMax: z.number().int().min(1).max(20),
    documentMaxMB: z.number().min(1).max(100),
    documentMax: z.number().int().min(1).max(20),
    linkDomains: z.array(z.string().trim().min(1).max(100)).max(30),
  }),
  grading: z.object({ scale: z.array(z.tuple([z.number().min(0).max(10), z.string().trim().min(1).max(3), z.number().min(0).max(4)])).min(2).max(15), retake: z.enum(['HIGHEST', 'LATEST']) }),
  security: z.object({ maxFailed: z.number().int().min(3).max(20), lockMinutes: z.number().int().min(1).max(1440), forceChangeFirstLogin: z.boolean() }),
  warning: z.object({ scoreThreshold: z.number().min(0).max(10), gpaDrop: z.number().min(0).max(4) }),
  enterprise: z.object({ viewDaysMin: z.number().int().min(1).max(365), viewDaysMax: z.number().int().min(1).max(365) }),
  reminder: z.object({ hours: z.number().int().min(1).max(168) }),
  email: z.object({ sender: z.string().trim().min(3).max(200) }),
});

@Controller('admin')
@Roles('ADMIN')
export class AdminUsersController {
  constructor(private readonly svc: AdminUsersService) {}

  @Post('users/:id/status')
  status(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(lockSchema)) d: { lock: boolean; reason?: string }) {
    return this.svc.setStatus(u.sub, id, d.lock, d.reason);
  }

  @Post('users/:id/reset-password')
  reset(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.resetPassword(u.sub, id);
  }

  @Get('lecturers')
  lecturers() {
    return this.svc.lecturers();
  }

  @Post('lecturers')
  createLecturer(@CurrentUser() u: AuthUser, @Body(new ZodPipe(lecturerSchema)) d: LecturerInput) {
    return this.svc.createLecturer(u.sub, d);
  }

  @Put('lecturers/:id')
  updateLecturer(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(lecturerSchema)) d: LecturerInput) {
    return this.svc.updateLecturer(u.sub, id, d);
  }

  @Get('students')
  students() {
    return this.svc.students();
  }

  @Post('students')
  createStudent(@CurrentUser() u: AuthUser, @Body(new ZodPipe(studentSchema)) d: StudentInput) {
    return this.svc.createStudent(u.sub, d);
  }

  @Put('students/:id')
  updateStudent(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(studentSchema)) d: StudentInput) {
    return this.svc.updateStudent(u.sub, id, d);
  }

  @Get('students/import/template')
  async template(@Res() res: Response) {
    sendXlsx(res, await this.svc.studentTemplate());
  }

  @Post('students/import/preview')
  @ExcelUpload()
  preview(@UploadedFile() file?: Express.Multer.File) {
    return this.svc.importPreview(excelFile(file));
  }

  @Post('students/import/:jobId/commit')
  commit(@CurrentUser() u: AuthUser, @Param('jobId', ParseUUIDPipe) jobId: string) {
    return this.svc.importCommit(u.sub, jobId);
  }

  @Get('parents')
  parents() {
    return this.svc.parents();
  }

  @Post('parents/change-phone')
  changePhone(@CurrentUser() u: AuthUser, @Body(new ZodPipe(phoneSchema)) d: z.infer<typeof phoneSchema>) {
    return this.svc.changeParentPhone(u.sub, d);
  }
}

@Controller('admin')
@Roles('ADMIN')
export class AdminAcademicController {
  constructor(private readonly svc: AdminAcademicService) {}

  @Get('catalog')
  catalog() {
    return this.svc.catalog();
  }

  @Post('catalog/faculties')
  addFaculty(@CurrentUser() u: AuthUser, @Body(new ZodPipe(facultySchema)) d: z.infer<typeof facultySchema>) {
    return this.svc.saveFaculty(u.sub, null, d);
  }
  @Put('catalog/faculties/:id')
  editFaculty(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(facultySchema)) d: z.infer<typeof facultySchema>) {
    return this.svc.saveFaculty(u.sub, id, d);
  }
  @Delete('catalog/faculties/:id')
  delFaculty(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.deleteFaculty(u.sub, id);
  }

  @Post('catalog/majors')
  addMajor(@CurrentUser() u: AuthUser, @Body(new ZodPipe(majorSchema)) d: z.infer<typeof majorSchema>) {
    return this.svc.saveMajor(u.sub, null, d);
  }
  @Put('catalog/majors/:id')
  editMajor(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(majorSchema)) d: z.infer<typeof majorSchema>) {
    return this.svc.saveMajor(u.sub, id, d);
  }
  @Delete('catalog/majors/:id')
  delMajor(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.deleteMajor(u.sub, id);
  }

  @Post('catalog/cohorts')
  addCohort(@CurrentUser() u: AuthUser, @Body(new ZodPipe(cohortSchema)) d: z.infer<typeof cohortSchema>) {
    return this.svc.saveCohort(u.sub, null, d);
  }
  @Put('catalog/cohorts/:id')
  editCohort(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(cohortSchema)) d: z.infer<typeof cohortSchema>) {
    return this.svc.saveCohort(u.sub, id, d);
  }
  @Delete('catalog/cohorts/:id')
  delCohort(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.deleteCohort(u.sub, id);
  }

  @Post('catalog/classes')
  addClass(@CurrentUser() u: AuthUser, @Body(new ZodPipe(classSchema)) d: z.infer<typeof classSchema>) {
    return this.svc.saveClass(u.sub, null, d);
  }
  @Put('catalog/classes/:id')
  editClass(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(classSchema)) d: z.infer<typeof classSchema>) {
    return this.svc.saveClass(u.sub, id, d);
  }
  @Get('catalog/classes/:id/students')
  classStudents(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.classStudents(id);
  }
  @Delete('catalog/classes/:id')
  delClass(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.deleteClass(u.sub, id);
  }

  @Get('semesters')
  semesters() {
    return this.svc.semesters();
  }
  @Post('semesters')
  addSemester(@CurrentUser() u: AuthUser, @Body(new ZodPipe(semesterSchema)) d: SemesterInput) {
    return this.svc.saveSemester(u.sub, null, d);
  }
  @Put('semesters/:id')
  editSemester(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(semesterSchema)) d: SemesterInput) {
    return this.svc.saveSemester(u.sub, id, d);
  }
  @Post('semesters/:id/current')
  currentSemester(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.setCurrentSemester(u.sub, id);
  }
  @Delete('semesters/:id')
  delSemester(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.deleteSemester(u.sub, id);
  }

  @Get('courses')
  courses() {
    return this.svc.courses();
  }
  @Post('courses')
  addCourse(@CurrentUser() u: AuthUser, @Body(new ZodPipe(courseSchema)) d: CourseInput) {
    return this.svc.saveCourse(u.sub, null, d);
  }
  @Put('courses/:id')
  editCourse(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(courseSchema)) d: CourseInput) {
    return this.svc.saveCourse(u.sub, id, d);
  }
  @Delete('courses/:id')
  delCourse(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.deleteCourse(u.sub, id);
  }

  @Get('sections')
  sections(@Query('semester') semester?: string) {
    return this.svc.sections(semester || undefined);
  }
  @Post('sections/check')
  check(@Body(new ZodPipe(sectionSchema.extend({ id: z.string().uuid().optional() }))) d: SectionInput & { id?: string }) {
    return this.svc.conflicts(d, d.id);
  }
  @Post('sections')
  addSection(@CurrentUser() u: AuthUser, @Body(new ZodPipe(sectionSchema)) d: SectionInput) {
    return this.svc.saveSection(u.sub, null, d);
  }
  @Put('sections/:id')
  editSection(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(sectionSchema)) d: SectionInput) {
    return this.svc.saveSection(u.sub, id, d);
  }
  @Delete('sections/:id')
  delSection(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.deleteSection(u.sub, id);
  }
  @Get('sections/:id/students')
  sectionStudents(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.sectionStudents(id);
  }
  @Post('sections/:id/students')
  addStudents(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(codesSchema)) d: { codes: string[] }) {
    return this.svc.addStudents(u.sub, id, d.codes);
  }
  @Delete('sections/:id/students/:studentId')
  removeStudent(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Param('studentId', ParseUUIDPipe) studentId: string) {
    return this.svc.removeStudent(u.sub, id, studentId);
  }
}

@Controller('admin')
@Roles('ADMIN')
export class AdminSystemController {
  constructor(private readonly svc: AdminSystemService) {}

  @Get('dashboard')
  dashboard() {
    return this.svc.dashboard();
  }

  @Get('enterprises')
  enterprises() {
    return this.svc.enterprises();
  }
  @Post('enterprises')
  createEnterprise(@CurrentUser() u: AuthUser, @Body(new ZodPipe(enterpriseSchema)) d: EnterpriseInput) {
    return this.svc.createEnterprise(u.sub, d);
  }
  @Put('enterprises/:id')
  updateEnterprise(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(enterpriseSchema)) d: EnterpriseInput) {
    return this.svc.updateEnterprise(u.sub, id, d);
  }
  @Get('enterprises/stats')
  enterpriseStats() {
    return this.svc.enterpriseStats();
  }
  @Post('enterprises/:id/decide')
  decide(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(decideSchema)) d: z.infer<typeof decideSchema>) {
    return this.svc.decideEnterprise(u.sub, id, d.action, d.reason);
  }

  @Get('logs')
  logs(@Query() q: { role?: string; action?: string; from?: string; to?: string; q?: string; page?: string }) {
    const role = ['ADMIN', 'LECTURER', 'STUDENT', 'PARENT', 'ENTERPRISE'].includes(q.role ?? '') ? (q.role as 'ADMIN') : undefined;
    return this.svc.logs({ role, action: q.action || undefined, from: q.from || undefined, to: q.to || undefined, q: q.q?.trim() || undefined, page: Number(q.page) || 1 });
  }

  @Get('config')
  config() {
    return this.svc.getConfig();
  }
  @Put('config')
  saveConfig(@CurrentUser() u: AuthUser, @Body(new ZodPipe(configSchema)) d: SystemConfigValue) {
    return this.svc.saveConfig(u.sub, d);
  }
}

/** Import giảng viên, môn học, lớp học phần từ Excel. */
@Controller('admin/import')
@Roles('ADMIN')
export class AdminImportController {
  constructor(private readonly svc: AdminImportService) {}

  private kind(k: string): ImportKind {
    if (!IMPORT_KINDS.includes(k as ImportKind)) throw new AppException('NOT_FOUND', 'Loại import không hợp lệ');
    return k as ImportKind;
  }

  @Get(':kind/template')
  async template(@Param('kind') kind: string, @Query('section') section: string | undefined, @Res() res: Response) {
    sendXlsx(res, await this.svc.template(this.kind(kind), section || undefined));
  }

  @Post(':kind/preview')
  @ExcelUpload()
  preview(@Param('kind') kind: string, @Query('semester') semester?: string, @Query('section') section?: string, @UploadedFile() file?: Express.Multer.File) {
    return this.svc.preview(this.kind(kind), excelFile(file), semester || undefined, section || undefined);
  }

  @Post(':kind/:jobId/commit')
  commit(@CurrentUser() u: AuthUser, @Param('kind') kind: string, @Param('jobId', ParseUUIDPipe) jobId: string) {
    return this.svc.commit(u.sub, this.kind(kind), jobId);
  }
}

@Module({
  controllers: [AdminUsersController, AdminAcademicController, AdminSystemController, AdminImportController],
  providers: [AdminUsersService, AdminAcademicService, AdminSystemService, AdminImportService],
})
export class AdminModule {}
