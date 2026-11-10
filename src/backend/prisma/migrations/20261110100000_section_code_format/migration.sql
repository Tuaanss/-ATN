-- Mã lớp học phần: MÃMÔN_HKx_YYYY_STT (VD: MH01_HK1_2526_01) để phân biệt cùng một môn mở ở các kỳ / năm học khác nhau

-- AlterTable
ALTER TABLE `course_sections` MODIFY `code` VARCHAR(50) NOT NULL;

-- Đổi mã các lớp cũ sang định dạng mới (giữ số thứ tự cuối nếu có)
UPDATE `course_sections` cs
JOIN `courses` c ON c.`id` = cs.`course_id`
JOIN `semesters` s ON s.`id` = cs.`semester_id`
SET cs.`code` = CONCAT(
  UPPER(c.`code`), '_',
  CASE s.`term` WHEN 'TERM_1' THEN 'HK1' WHEN 'TERM_2' THEN 'HK2' ELSE 'HE' END, '_',
  SUBSTRING(s.`academic_year`, 3, 2), SUBSTRING(s.`academic_year`, 8, 2), '_',
  LPAD(IF(SUBSTRING_INDEX(cs.`code`, '_', -1) REGEXP '^[0-9]{1,3}$', SUBSTRING_INDEX(cs.`code`, '_', -1), '1'), 2, '0')
)
WHERE cs.`code` NOT REGEXP '^[A-Z0-9]+_(HK1|HK2|HE)_[0-9]{4}_[0-9]{2,3}$';
