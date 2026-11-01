import { HttpStatus, Injectable } from '@nestjs/common';
import { CourseType, Prisma, TermType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppException, notFound } from '../../common/errors/app-exception';
import { AuditService } from '../../common/audit/audit.service';
import { normCode } from '../../common/utils/excel';

export interface Session {
  day: number; // 2..7 = Thứ 2..Thứ 7, 8 = Chủ nhật
  from: number; // tiết 1..12
  to: number;
  room: string;
}
export interface SectionInput {
  semesterId: string;
  courseId: string;
  code: string;
  lecturerId: string;
  maxStudents: number;
  weekStart: number;
  weekEnd: number;
  sessions: Session[];
}
export interface CourseInput {
  code: string;
  name: string;
  credits: number;
  courseType: CourseType;
  facultyId?: string | null;
  wAttendance: number;
  wAssignment: number;
  wMidterm: number;
  wFinal: number;
  isActive?: boolean;
}
export interface SemesterInput {
  academicYear: string;
  term: TermType;
  startDate: string;
  endDate: string;
}

const TERM_CODE: Record<TermType, string> = { TERM_1: '1', TERM_2: '2', SUMMER: 'HE' };
const dayName = (d: number) => (d === 8 ? 'CN' : `T${d}`);
export const scheduleText = (ss: Session[]) => ss.map((s) => `${dayName(s.day)} Tiết ${s.from}–${s.to}${s.room ? ` · ${s.room}` : ''}`).join('; ');
const inUse = (what: string) => new AppException('CONFLICT', `Không xóa được: ${what}`, HttpStatus.CONFLICT);

/** UC02.6, UC02.8 – UC02.10: danh mục, học kỳ, môn học, lớp học phần. */
@Injectable()
export class AdminAcademicService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private log(adminId: string, action: string, entityType: string, entityId: string | undefined, summary: string) {
    return this.audit.log({ actorId: adminId, action, entityType, entityId, summary });
  }

  private unique(e: unknown, msg: string): never {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new AppException('CONFLICT', msg, HttpStatus.CONFLICT);
    throw e;
  }

  // ================================================================ danh mục (UC02.6)

  async catalog() {
    const [faculties, majors, cohorts, classes, types] = await Promise.all([
      this.prisma.faculty.findMany({ include: { _count: { select: { majors: true, lecturers: true, courses: true } } }, orderBy: { code: 'asc' } }),
      this.prisma.major.findMany({ include: { faculty: true, classes: { include: { _count: { select: { students: true } } } } }, orderBy: { code: 'asc' } }),
      this.prisma.cohort.findMany({ include: { classes: { include: { _count: { select: { students: true } } } } }, orderBy: { startYear: 'desc' } }),
      this.prisma.adminClass.findMany({ include: { major: true, cohort: true, _count: { select: { students: true } } }, orderBy: { code: 'asc' } }),
      this.prisma.course.groupBy({ by: ['courseType'], _count: { _all: true } }),
    ]);
    const sum = (cs: { _count: { students: number } }[]) => cs.reduce((a, c) => a + c._count.students, 0);
    return {
      faculties: faculties.map((f) => ({ id: f.id, code: f.code, name: f.name, majors: f._count.majors, lecturers: f._count.lecturers, courses: f._count.courses })),
      majors: majors.map((m) => ({ id: m.id, code: m.code, name: m.name, faculty: { id: m.faculty.id, code: m.faculty.code, name: m.faculty.name }, classes: m.classes.length, students: sum(m.classes) })),
      cohorts: cohorts.map((c) => ({ id: c.id, name: c.name, startYear: c.startYear, classes: c.classes.length, students: sum(c.classes) })),
      classes: classes.map((c) => ({ id: c.id, code: c.code, major: { id: c.major.id, name: c.major.name }, cohort: { id: c.cohort.id, name: c.cohort.name }, students: c._count.students })),
      courseTypes: (['DESIGN', 'PROGRAMMING', 'OTHER'] as CourseType[]).map((t) => ({ code: t, courses: types.find((x) => x.courseType === t)?._count._all ?? 0 })),
    };
  }

  async saveFaculty(adminId: string, id: string | null, d: { code: string; name: string }) {
    const data = { code: normCode(d.code), name: d.name.trim() };
    const f = await (id ? this.prisma.faculty.update({ where: { id }, data }) : this.prisma.faculty.create({ data })).catch((e) => this.unique(e, 'Mã hoặc tên khoa đã tồn tại'));
    await this.log(adminId, id ? 'UPDATE_CATALOG' : 'CREATE_CATALOG', 'faculty', f.id, `${id ? 'Sửa' : 'Thêm'} khoa ${f.code} – ${f.name}`);
    return f;
  }

  async deleteFaculty(adminId: string, id: string) {
    const f = await this.prisma.faculty.findUnique({ where: { id }, include: { _count: { select: { majors: true, lecturers: true, courses: true } } } });
    if (!f) throw notFound('Khoa');
    if (f._count.majors || f._count.lecturers || f._count.courses) throw inUse(`khoa đang có ${f._count.majors} ngành, ${f._count.lecturers} giảng viên, ${f._count.courses} môn học`);
    await this.prisma.faculty.delete({ where: { id } });
    await this.log(adminId, 'DELETE_CATALOG', 'faculty', id, `Xóa khoa ${f.code}`);
    return { ok: true };
  }

  async saveMajor(adminId: string, id: string | null, d: { code: string; name: string; facultyId: string }) {
    const data = { code: normCode(d.code), name: d.name.trim(), facultyId: d.facultyId };
    const m = await (id ? this.prisma.major.update({ where: { id }, data }) : this.prisma.major.create({ data })).catch((e) => this.unique(e, 'Mã ngành đã tồn tại'));
    if (id) {
      // tên ngành lưu kèm trong hồ sơ SV
      await this.prisma.student.updateMany({ where: { adminClass: { majorId: id } }, data: { major: m.name } });
    }
    await this.log(adminId, id ? 'UPDATE_CATALOG' : 'CREATE_CATALOG', 'major', m.id, `${id ? 'Sửa' : 'Thêm'} ngành ${m.code} – ${m.name}`);
    return m;
  }

  async deleteMajor(adminId: string, id: string) {
    const m = await this.prisma.major.findUnique({ where: { id }, include: { _count: { select: { classes: true } } } });
    if (!m) throw notFound('Ngành');
    if (m._count.classes) throw inUse(`ngành đang có ${m._count.classes} lớp sinh hoạt`);
    await this.prisma.major.delete({ where: { id } });
    await this.log(adminId, 'DELETE_CATALOG', 'major', id, `Xóa ngành ${m.code}`);
    return { ok: true };
  }

  async saveCohort(adminId: string, id: string | null, d: { name: string; startYear: number }) {
    const data = { name: normCode(d.name), startYear: d.startYear };
    const c = await (id ? this.prisma.cohort.update({ where: { id }, data }) : this.prisma.cohort.create({ data })).catch((e) => this.unique(e, 'Khóa đã tồn tại'));
    if (id) await this.prisma.student.updateMany({ where: { adminClass: { cohortId: id } }, data: { cohort: c.name } });
    await this.log(adminId, id ? 'UPDATE_CATALOG' : 'CREATE_CATALOG', 'cohort', c.id, `${id ? 'Sửa' : 'Thêm'} khóa ${c.name}`);
    return c;
  }

  async deleteCohort(adminId: string, id: string) {
    const c = await this.prisma.cohort.findUnique({ where: { id }, include: { _count: { select: { classes: true } } } });
    if (!c) throw notFound('Khóa');
    if (c._count.classes) throw inUse(`khóa đang có ${c._count.classes} lớp sinh hoạt`);
    await this.prisma.cohort.delete({ where: { id } });
    await this.log(adminId, 'DELETE_CATALOG', 'cohort', id, `Xóa khóa ${c.name}`);
    return { ok: true };
  }

  async saveClass(adminId: string, id: string | null, d: { code: string; majorId: string; cohortId: string }) {
    const data = { code: normCode(d.code), majorId: d.majorId, cohortId: d.cohortId };
    const c = await (id ? this.prisma.adminClass.update({ where: { id }, data, include: { major: true, cohort: true } }) : this.prisma.adminClass.create({ data, include: { major: true, cohort: true } })).catch((e) =>
      this.unique(e, 'Mã lớp đã tồn tại'),
    );
    if (id) await this.prisma.student.updateMany({ where: { adminClassId: id }, data: { major: c.major.name, cohort: c.cohort.name } });
    await this.log(adminId, id ? 'UPDATE_CATALOG' : 'CREATE_CATALOG', 'admin_class', c.id, `${id ? 'Sửa' : 'Thêm'} lớp sinh hoạt ${c.code}`);
    return c;
  }

  async deleteClass(adminId: string, id: string) {
    const c = await this.prisma.adminClass.findUnique({ where: { id }, include: { _count: { select: { students: true } } } });
    if (!c) throw notFound('Lớp sinh hoạt');
    if (c._count.students) throw inUse(`lớp đang có ${c._count.students} sinh viên`);
    await this.prisma.adminClass.delete({ where: { id } });
    await this.log(adminId, 'DELETE_CATALOG', 'admin_class', id, `Xóa lớp sinh hoạt ${c.code}`);
    return { ok: true };
  }

  // ================================================================ học kỳ (UC02.8)

  async semesters() {
    const list = await this.prisma.semester.findMany({ include: { _count: { select: { sections: true } } }, orderBy: [{ startDate: 'desc' }] });
    return list.map((s) => ({
      id: s.id,
      code: s.code,
      academicYear: s.academicYear,
      term: s.term,
      startDate: s.startDate,
      endDate: s.endDate,
      weeks: Math.ceil((s.endDate.getTime() - s.startDate.getTime() + 86_400_000) / (7 * 86_400_000)),
      isCurrent: s.isCurrent,
      sections: s._count.sections,
    }));
  }

  async saveSemester(adminId: string, id: string | null, d: SemesterInput) {
    if (!/^\d{4}-\d{4}$/.test(d.academicYear) || Number(d.academicYear.slice(5)) !== Number(d.academicYear.slice(0, 4)) + 1)
      throw new AppException('VALIDATION_ERROR', 'Năm học dạng 2026-2027');
    const startDate = new Date(d.startDate);
    const endDate = new Date(d.endDate);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate <= startDate) throw new AppException('VALIDATION_ERROR', 'Ngày kết thúc phải sau ngày bắt đầu');
    const overlap = await this.prisma.semester.findFirst({ where: { id: id ? { not: id } : undefined, startDate: { lte: endDate }, endDate: { gte: startDate } } });
    if (overlap) throw new AppException('CONFLICT', `Thời gian trùng với học kỳ ${overlap.code}`, HttpStatus.CONFLICT);
    const data = { code: `${d.academicYear}-${TERM_CODE[d.term]}`, academicYear: d.academicYear, term: d.term, startDate, endDate };
    const s = await (id ? this.prisma.semester.update({ where: { id }, data }) : this.prisma.semester.create({ data })).catch((e) => this.unique(e, 'Học kỳ này đã tồn tại'));
    await this.log(adminId, id ? 'UPDATE_SEMESTER' : 'CREATE_SEMESTER', 'semester', s.id, `${id ? 'Sửa' : 'Thêm'} học kỳ ${s.code}`);
    return s;
  }

  async setCurrentSemester(adminId: string, id: string) {
    const s = await this.prisma.semester.findUnique({ where: { id } });
    if (!s) throw notFound('Học kỳ');
    await this.prisma.$transaction([this.prisma.semester.updateMany({ data: { isCurrent: false } }), this.prisma.semester.update({ where: { id }, data: { isCurrent: true } })]);
    await this.log(adminId, 'SET_CURRENT_SEMESTER', 'semester', id, `Đặt học kỳ hiện tại: ${s.code}`);
    return { ok: true };
  }

  async deleteSemester(adminId: string, id: string) {
    const s = await this.prisma.semester.findUnique({ where: { id }, include: { _count: { select: { sections: true } } } });
    if (!s) throw notFound('Học kỳ');
    if (s._count.sections) throw inUse(`học kỳ đang có ${s._count.sections} lớp học phần`);
    if (s.isCurrent) throw inUse('đây là học kỳ hiện tại');
    await this.prisma.lecturerSemesterFolder.deleteMany({ where: { semesterId: id } });
    await this.prisma.semester.delete({ where: { id } });
    await this.log(adminId, 'DELETE_SEMESTER', 'semester', id, `Xóa học kỳ ${s.code}`);
    return { ok: true };
  }

  // ================================================================ môn học (UC02.8)

  async courses() {
    const cur = await this.prisma.semester.findFirst({ where: { isCurrent: true } });
    const list = await this.prisma.course.findMany({ include: { faculty: true, sections: { select: { semesterId: true } } }, orderBy: { code: 'asc' } });
    return list.map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      credits: c.credits,
      courseType: c.courseType,
      faculty: c.faculty && { id: c.faculty.id, code: c.faculty.code, name: c.faculty.name },
      wAttendance: c.wAttendance,
      wAssignment: c.wAssignment,
      wMidterm: c.wMidterm,
      wFinal: c.wFinal,
      isActive: c.isActive,
      sectionsTotal: c.sections.length,
      sectionsCurrent: c.sections.filter((s) => s.semesterId === cur?.id).length,
    }));
  }

  async saveCourse(adminId: string, id: string | null, d: CourseInput) {
    if (d.wAttendance + d.wAssignment + d.wMidterm + d.wFinal !== 100) throw new AppException('VALIDATION_ERROR', 'Tổng trọng số CC + BT + GK + CK phải bằng 100%');
    if (id) {
      const published = await this.prisma.courseSection.count({ where: { courseId: id, gradesPublishedAt: { not: null } } });
      const old = await this.prisma.course.findUnique({ where: { id } });
      if (published && old && (old.wAttendance !== d.wAttendance || old.wAssignment !== d.wAssignment || old.wMidterm !== d.wMidterm || old.wFinal !== d.wFinal))
        throw new AppException('GRADES_LOCKED', 'Môn đã có lớp công bố điểm, không đổi được trọng số');
    }
    const data = { code: normCode(d.code), name: d.name.trim(), credits: d.credits, courseType: d.courseType, facultyId: d.facultyId || null, wAttendance: d.wAttendance, wAssignment: d.wAssignment, wMidterm: d.wMidterm, wFinal: d.wFinal, isActive: d.isActive ?? true };
    const c = await (id ? this.prisma.course.update({ where: { id }, data }) : this.prisma.course.create({ data })).catch((e) => this.unique(e, 'Mã môn đã tồn tại'));
    await this.log(adminId, id ? 'UPDATE_COURSE' : 'CREATE_COURSE', 'course', c.id, `${id ? 'Sửa' : 'Thêm'} môn ${c.code} – ${c.name}`);
    return c;
  }

  async deleteCourse(adminId: string, id: string) {
    const c = await this.prisma.course.findUnique({ where: { id }, include: { _count: { select: { sections: true } } } });
    if (!c) throw notFound('Môn học');
    if (c._count.sections) throw inUse(`môn đang có ${c._count.sections} lớp học phần`);
    await this.prisma.course.delete({ where: { id } });
    await this.log(adminId, 'DELETE_COURSE', 'course', id, `Xóa môn ${c.code}`);
    return { ok: true };
  }

  // ================================================================ lớp học phần (UC02.9, UC02.10)

  async sections(semesterId?: string) {
    const sem = semesterId ? await this.prisma.semester.findUnique({ where: { id: semesterId } }) : await this.prisma.semester.findFirst({ where: { isCurrent: true } });
    const list = sem
      ? await this.prisma.courseSection.findMany({
          where: { semesterId: sem.id },
          include: { course: true, lecturer: { select: { id: true, code: true, fullName: true } }, _count: { select: { students: true, assignments: true } } },
          orderBy: { code: 'asc' },
        })
      : [];
    return {
      semesterId: sem?.id ?? null,
      sections: list.map((s) => ({
        id: s.id,
        code: s.code,
        course: { id: s.course.id, code: s.course.code, name: s.course.name, credits: s.course.credits },
        lecturer: s.lecturer,
        maxStudents: s.maxStudents,
        students: s._count.students,
        assignments: s._count.assignments,
        weekStart: s.weekStart,
        weekEnd: s.weekEnd,
        sessions: s.sessions as unknown as Session[],
        schedule: s.schedule,
        gradesPublished: !!s.gradesPublishedAt,
      })),
    };
  }

  private checkSessions(d: SectionInput) {
    if (!d.sessions.length) throw new AppException('VALIDATION_ERROR', 'Thêm ít nhất một buổi học');
    if (d.weekStart < 1 || d.weekEnd < d.weekStart || d.weekEnd > 25) throw new AppException('VALIDATION_ERROR', 'Tuần học không hợp lệ');
    if (d.maxStudents < 1 || d.maxStudents > 300) throw new AppException('VALIDATION_ERROR', 'Sĩ số tối đa 1–300');
    for (const s of d.sessions) {
      if (s.day < 2 || s.day > 8 || s.from < 1 || s.to > 12 || s.to < s.from) throw new AppException('VALIDATION_ERROR', 'Buổi học không hợp lệ (tiết 1–12)');
    }
    d.sessions.forEach((a, i) =>
      d.sessions.slice(i + 1).forEach((b) => {
        if (a.day === b.day && a.from <= b.to && b.from <= a.to) throw new AppException('VALIDATION_ERROR', `Hai buổi ${dayName(a.day)} của lớp bị chồng tiết`);
      }),
    );
  }

  /** Trùng lịch: cùng thứ, giao tiết, giao tuần – cùng GV hoặc cùng phòng, trong cùng học kỳ. */
  async conflicts(d: SectionInput, excludeId?: string) {
    const others = await this.prisma.courseSection.findMany({
      where: { semesterId: d.semesterId, id: excludeId ? { not: excludeId } : undefined, weekStart: { lte: d.weekEnd }, weekEnd: { gte: d.weekStart } },
      include: { lecturer: { select: { fullName: true } } },
    });
    const out: { section: string; kind: 'LECTURER' | 'ROOM'; message: string }[] = [];
    for (const o of others) {
      for (const a of o.sessions as unknown as Session[]) {
        for (const b of d.sessions) {
          if (a.day !== b.day || a.from > b.to || b.from > a.to) continue;
          const when = `${dayName(b.day)} tiết ${Math.max(a.from, b.from)}–${Math.min(a.to, b.to)}`;
          if (o.lecturerId === d.lecturerId) out.push({ section: o.code, kind: 'LECTURER', message: `GV ${o.lecturer.fullName} đã dạy lớp ${o.code} vào ${when}` });
          if (a.room && b.room && a.room.trim().toUpperCase() === b.room.trim().toUpperCase()) out.push({ section: o.code, kind: 'ROOM', message: `Phòng ${b.room} đã có lớp ${o.code} vào ${when}` });
        }
      }
    }
    return out;
  }

  async saveSection(adminId: string, id: string | null, d: SectionInput) {
    this.checkSessions(d);
    d.sessions = d.sessions.map((s) => ({ day: s.day, from: s.from, to: s.to, room: s.room.trim() }));
    const clash = await this.conflicts(d, id ?? undefined);
    if (clash.length) throw new AppException('CONFLICT', `Trùng lịch: ${clash.map((c) => c.message).join('; ')}`, HttpStatus.CONFLICT);
    if (id) {
      const cur = await this.prisma.courseSection.findUnique({ where: { id }, include: { _count: { select: { students: true, assignments: true } } } });
      if (!cur) throw notFound('Lớp học phần');
      if (d.maxStudents < cur._count.students) throw new AppException('VALIDATION_ERROR', `Lớp đã có ${cur._count.students} SV, sĩ số tối đa không được nhỏ hơn`);
      if (cur._count.assignments && (cur.lecturerId !== d.lecturerId || cur.courseId !== d.courseId || cur.semesterId !== d.semesterId))
        throw new AppException('CONFLICT', 'Lớp đã có bài tập, không đổi được môn, học kỳ hoặc giảng viên', HttpStatus.CONFLICT);
    }
    const data = {
      code: normCode(d.code),
      courseId: d.courseId,
      semesterId: d.semesterId,
      lecturerId: d.lecturerId,
      maxStudents: d.maxStudents,
      weekStart: d.weekStart,
      weekEnd: d.weekEnd,
      sessions: d.sessions as unknown as Prisma.InputJsonValue,
      schedule: scheduleText(d.sessions).slice(0, 200),
    };
    const s = await (id ? this.prisma.courseSection.update({ where: { id }, data }) : this.prisma.courseSection.create({ data })).catch((e) => this.unique(e, 'Mã lớp học phần đã tồn tại'));
    await this.log(adminId, id ? 'UPDATE_SECTION' : 'CREATE_SECTION', 'course_section', s.id, `${id ? 'Sửa' : 'Mở'} lớp học phần ${s.code} (${s.schedule})`);
    return s;
  }

  async deleteSection(adminId: string, id: string) {
    const s = await this.prisma.courseSection.findUnique({ where: { id }, include: { _count: { select: { assignments: true, grades: true, students: true } } } });
    if (!s) throw notFound('Lớp học phần');
    if (s._count.students) throw inUse(`lớp đang có ${s._count.students} sinh viên, hãy gỡ sinh viên trước`);
    if (s._count.assignments) throw inUse(`lớp đã có ${s._count.assignments} bài tập`);
    if (s._count.grades) throw inUse('lớp đã có bảng điểm');
    await this.prisma.gradeChangeRequest.deleteMany({ where: { sectionId: id } });
    await this.prisma.courseSection.delete({ where: { id } });
    await this.log(adminId, 'DELETE_SECTION', 'course_section', id, `Xóa lớp học phần ${s.code}`);
    return { ok: true };
  }

  // ---- danh sách SV của lớp (UC02.10)

  async sectionStudents(id: string) {
    const s = await this.prisma.courseSection.findUnique({
      where: { id },
      include: { course: true, lecturer: { select: { fullName: true } }, students: { include: { student: { select: { id: true, studentCode: true, fullName: true, cohort: true, major: true, adminClass: { select: { code: true } } } } }, orderBy: { student: { studentCode: 'asc' } } } },
    });
    if (!s) throw notFound('Lớp học phần');
    return {
      id: s.id,
      code: s.code,
      course: s.course.name,
      lecturer: s.lecturer.fullName,
      maxStudents: s.maxStudents,
      students: s.students.map((x) => ({ ...x.student, adminClass: x.student.adminClass?.code ?? null, enrolledAt: x.enrolledAt })),
    };
  }

  /** Thêm SV theo danh sách MSSV (dán nhiều mã, cách nhau bởi dấu phẩy / xuống dòng). */
  async addStudents(adminId: string, id: string, codes: string[]) {
    const s = await this.prisma.courseSection.findUnique({ where: { id }, include: { _count: { select: { students: true } } } });
    if (!s) throw notFound('Lớp học phần');
    const wanted = [...new Set(codes.map(normCode).filter(Boolean))];
    const found = await this.prisma.student.findMany({
      where: { studentCode: { in: wanted } },
      include: { user: { select: { status: true } }, enrollments: { where: { section: { semesterId: s.semesterId } }, include: { section: { select: { code: true, courseId: true, weekStart: true, weekEnd: true, sessions: true } } } } },
    });
    const mine = s.sessions as unknown as Session[];
    const clash = (o: { weekStart: number; weekEnd: number; sessions: unknown }) =>
      o.weekStart <= s.weekEnd && s.weekStart <= o.weekEnd && (o.sessions as Session[]).some((a) => mine.some((b) => a.day === b.day && a.from <= b.to && b.from <= a.to));
    const byCode = new Map(found.map((x) => [x.studentCode.toUpperCase(), x]));
    const added: string[] = [];
    const skipped: { code: string; reason: string }[] = [];
    let room = s.maxStudents - s._count.students;
    for (const code of wanted) {
      const st = byCode.get(code);
      if (!st) skipped.push({ code, reason: 'Không có sinh viên này' });
      else if (st.user.status !== 'ACTIVE') skipped.push({ code, reason: 'Tài khoản đang bị khóa' });
      else if (st.enrollments.some((e) => e.sectionId === id)) skipped.push({ code, reason: 'Đã ở trong lớp' });
      else if (st.enrollments.some((e) => e.section.courseId === s.courseId))
        skipped.push({ code, reason: `Đã học môn này ở lớp ${st.enrollments.find((e) => e.section.courseId === s.courseId)!.section.code}` });
      else if (st.enrollments.some((e) => clash(e.section))) skipped.push({ code, reason: `Trùng lịch với lớp ${st.enrollments.find((e) => clash(e.section))!.section.code}` });
      else if (room <= 0) skipped.push({ code, reason: 'Lớp đã đủ sĩ số' });
      else {
        await this.prisma.sectionStudent.create({ data: { sectionId: id, studentId: st.id } });
        added.push(code);
        room--;
      }
    }
    if (added.length) await this.log(adminId, 'ASSIGN_STUDENTS', 'course_section', id, `Xếp ${added.length} SV vào lớp ${s.code}`);
    return { added, skipped };
  }

  async removeStudent(adminId: string, id: string, studentId: string) {
    const s = await this.prisma.courseSection.findUnique({ where: { id } });
    if (!s) throw notFound('Lớp học phần');
    const st = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!st) throw notFound('Sinh viên');
    const work = await this.prisma.groupMember.count({ where: { studentId, assignment: { sectionId: id } } });
    const subs = await this.prisma.submission.count({ where: { assignment: { sectionId: id }, OR: [{ studentId }, { lastSubmittedById: studentId }] } });
    if (work || subs) throw new AppException('CONFLICT', 'Sinh viên đã có nhóm hoặc bài nộp trong lớp, không gỡ được', HttpStatus.CONFLICT);
    await this.prisma.sectionStudent.delete({ where: { sectionId_studentId: { sectionId: id, studentId } } }).catch(() => {
      throw notFound('Sinh viên trong lớp');
    });
    await this.log(adminId, 'REMOVE_STUDENT', 'course_section', id, `Gỡ SV ${st.studentCode} khỏi lớp ${s.code}`);
    return { ok: true };
  }
}
