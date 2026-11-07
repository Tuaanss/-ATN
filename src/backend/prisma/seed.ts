/**
 * Dữ liệu khởi tạo để chạy thử: xóa sạch dữ liệu cũ (kể cả tệp đã tải lên, Drive mô phỏng),
 * rồi tạo đúng 1 học kỳ, 1 môn, 1 lớp học phần và 3 tài khoản.
 *
 *   Quản trị    admin  / Admin@123
 *   Phụ huynh   0912345678 / Phuhuynh@123  (bố của SV0001 và SV0002)
 *   Doanh nghiệp hr@doanhnghiepa.vn / Doanhnghiep@123
 *   Giảng viên  GV001  / GV001
 *   Sinh viên   SV0001 / 01012005   (ngày sinh 01/01/2005)
 *   Sinh viên   SV0002 / 02022005   (ngày sinh 02/02/2005)
 *
 * Hai sinh viên cùng lớp MH01_01 do GV001 phụ trách. Chưa có bài tập nào – GV tự giao để test.
 */
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';

try {
  process.loadEnvFile(path.resolve(__dirname, '..', '.env'));
} catch {
  /* dùng biến môi trường hệ thống */
}

const prisma = new PrismaClient();
const DATA_DIR = path.resolve(__dirname, '..', process.env.DATA_DIR ?? './data');

async function wipe() {
  await prisma.auditLog.deleteMany();
  await prisma.gradeChangeRequest.deleteMany();
  await prisma.lecturerNote.deleteMany();
  await prisma.lecturerSemesterFolder.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.parentStudent.deleteMany();
  await prisma.parent.deleteMany();
  await prisma.enterpriseView.deleteMany();
  await prisma.enterpriseSearch.deleteMany();
  await prisma.enterpriseInterest.deleteMany();
  await prisma.viewRequest.deleteMany();
  await prisma.enterprise.deleteMany();
  await prisma.systemConfig.deleteMany();
  await prisma.topicHistory.deleteMany();
  await prisma.assignmentView.deleteMany();
  await prisma.groupReport.deleteMany();
  await prisma.assignmentGrade.deleteMany();
  await prisma.sectionGrade.deleteMany();
  await prisma.importJob.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.submissionEvent.deleteMany();
  await prisma.submissionFile.deleteMany();
  await prisma.submission.deleteMany();
  await prisma.topic.deleteMany();
  await prisma.groupMember.deleteMany();
  await prisma.group.deleteMany();
  await prisma.individualWork.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.lecturerDriveLink.deleteMany();
  await prisma.sectionStudent.deleteMany();
  await prisma.courseSection.deleteMany();
  await prisma.course.deleteMany();
  await prisma.semester.deleteMany();
  await prisma.student.deleteMany();
  await prisma.lecturer.deleteMany();
  await prisma.adminClass.deleteMany();
  await prisma.major.deleteMany();
  await prisma.cohort.deleteMany();
  await prisma.faculty.deleteMany();
  await prisma.user.deleteMany();
  // tệp tải lên, đề bài, Drive mô phỏng
  rmSync(DATA_DIR, { recursive: true, force: true });
  mkdirSync(DATA_DIR, { recursive: true });
}

async function main() {
  await wipe();

  await prisma.user.create({ data: { username: 'admin', passwordHash: await argon2.hash('Admin@123'), role: 'ADMIN', mustChangePassword: false, email: 'admin@truong.edu.vn' } });
  const faculty = await prisma.faculty.create({ data: { code: 'MULTIMEDIA', name: 'Khoa Đa phương tiện' } });
  const major = await prisma.major.create({ data: { code: 'CNDPT', name: 'Công nghệ đa phương tiện', facultyId: faculty.id } });
  const cohort = await prisma.cohort.create({ data: { name: 'D22', startYear: 2022 } });
  const cls = await prisma.adminClass.create({ data: { code: 'D22DCPT01-B', majorId: major.id, cohortId: cohort.id } });

  const gv = await prisma.lecturer.create({
    data: {
      code: 'GV001',
      fullName: 'Giảng viên 1',
      email: 'giangvien1@truong.edu.vn',
      faculty: { connect: { id: faculty.id } },
      user: { create: { username: 'GV001', passwordHash: await argon2.hash('GV001'), role: 'LECTURER', mustChangePassword: false, email: 'giangvien1@truong.edu.vn' } },
    },
  });

  const students = [];
  for (const i of [1, 2]) {
    const code = `SV000${i}`;
    const dob = new Date(Date.UTC(2005, i - 1, i));
    const pwd = `0${i}0${i}2005`;
    students.push(
      await prisma.student.create({
        data: {
          studentCode: code,
          fullName: `Sinh viên ${i}`,
          dateOfBirth: dob,
          cohort: 'D22',
          major: 'Công nghệ đa phương tiện',
          adminClass: { connect: { id: cls.id } },
          email: `sinhvien${i}@email.com`,
          profileCompletedAt: new Date(),
          user: { create: { username: code, passwordHash: await argon2.hash(pwd), role: 'STUDENT', mustChangePassword: false, email: `sinhvien${i}@email.com` } },
        },
      }),
    );
  }

  // Phụ huynh của cả 2 sinh viên (bố) – đăng nhập bằng SĐT
  const ph = await prisma.parent.create({
    data: {
      phone: '0912345678',
      fullName: 'Nguyễn Văn Phụ Huynh',
      user: { create: { username: '0912345678', passwordHash: await argon2.hash('Phuhuynh@123'), role: 'PARENT', mustChangePassword: false } },
    },
  });
  for (const s of students) {
    await prisma.parentStudent.create({ data: { parentId: ph.id, studentId: s.id, relation: 'FATHER' } });
    await prisma.student.update({ where: { id: s.id }, data: { fatherPhone: '0912345678' } });
  }

  // Doanh nghiệp đã được duyệt – đăng nhập bằng email
  await prisma.user.create({
    data: {
      username: 'hr@doanhnghiepa.vn',
      email: 'hr@doanhnghiepa.vn',
      passwordHash: await argon2.hash('Doanhnghiep@123'),
      role: 'ENTERPRISE',
      mustChangePassword: false,
      enterprise: { create: { name: 'Công ty Cổ phần Doanh nghiệp A', taxCode: '0101234567', email: 'hr@doanhnghiepa.vn', contactName: 'Lê Thị Minh Thư', phone: '0987654321', field: 'Công nghệ thông tin', website: 'https://doanhnghiepa.vn', approvedAt: new Date() } },
    },
  });
  // SV0001 bật "cho doanh nghiệp tìm thấy" để chạy thử tìm kiếm
  await prisma.student.update({ where: { id: students[0].id }, data: { discoverable: true } });

  const semester = await prisma.semester.create({
    data: { code: '2026-2027-1', academicYear: '2026-2027', term: 'TERM_1', startDate: new Date('2026-08-31'), endDate: new Date('2027-01-15'), isCurrent: true },
  });
  const course = await prisma.course.create({ data: { code: 'MH01', name: 'Môn học 1', credits: 3, courseType: 'DESIGN', facultyId: faculty.id } });
  await prisma.courseSection.create({
    data: {
      code: 'MH01_01',
      courseId: course.id,
      semesterId: semester.id,
      lecturerId: gv.id,
      maxStudents: 60,
      schedule: 'T2 Tiết 1–3 · A2-301',
      sessions: [{ day: 2, from: 1, to: 3, room: 'A2-301' }],
      students: { create: students.map((s) => ({ studentId: s.id })) },
    },
  });

  console.log('Seed xong: 1 lớp MH01_01 · admin/Admin@123 · PH 0912345678/Phuhuynh@123 · DN hr@doanhnghiepa.vn/Doanhnghiep@123 · GV001/GV001 · SV0001/01012005 · SV0002/02022005 (chưa có bài tập).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
