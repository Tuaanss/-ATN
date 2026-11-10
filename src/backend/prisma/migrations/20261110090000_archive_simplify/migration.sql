-- Hệ thống lưu trữ bài tập: bỏ điểm học phần, yêu cầu sửa điểm, trọng số, loại môn, sĩ số / tuần / lịch học

-- Xóa phiên import điểm học phần trước khi thu hẹp enum
DELETE FROM `import_jobs` WHERE `type` = 'SECTION_GRADES';

-- DropForeignKey
ALTER TABLE `grade_change_requests` DROP FOREIGN KEY `grade_change_requests_section_id_fkey`;

-- DropForeignKey
ALTER TABLE `grade_change_requests` DROP FOREIGN KEY `grade_change_requests_student_id_fkey`;

-- DropForeignKey
ALTER TABLE `grade_change_requests` DROP FOREIGN KEY `grade_change_requests_lecturer_id_fkey`;

-- DropForeignKey
ALTER TABLE `section_grades` DROP FOREIGN KEY `section_grades_section_id_fkey`;

-- DropForeignKey
ALTER TABLE `section_grades` DROP FOREIGN KEY `section_grades_student_id_fkey`;

-- AlterTable
ALTER TABLE `courses` DROP COLUMN `course_type`,
    DROP COLUMN `w_assignment`,
    DROP COLUMN `w_attendance`,
    DROP COLUMN `w_final`,
    DROP COLUMN `w_midterm`;

-- AlterTable
ALTER TABLE `course_sections` DROP COLUMN `grades_published_at`,
    DROP COLUMN `max_students`,
    DROP COLUMN `schedule`,
    DROP COLUMN `sessions`,
    DROP COLUMN `week_end`,
    DROP COLUMN `week_start`;

-- AlterTable
ALTER TABLE `assignments` DROP COLUMN `weight`;

-- AlterTable
ALTER TABLE `import_jobs` MODIFY `type` ENUM('ASSIGNMENT_GROUPS', 'ASSIGNMENT_GRADES') NOT NULL;

-- DropTable
DROP TABLE `grade_change_requests`;

-- DropTable
DROP TABLE `section_grades`;

