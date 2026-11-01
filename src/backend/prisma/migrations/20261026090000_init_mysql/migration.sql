-- CreateTable
CREATE TABLE `users` (
    `id` CHAR(36) NOT NULL,
    `username` VARCHAR(100) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `role` ENUM('ADMIN', 'LECTURER', 'STUDENT', 'PARENT', 'ENTERPRISE') NOT NULL,
    `status` ENUM('PENDING', 'ACTIVE', 'LOCKED', 'REJECTED', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',
    `must_change_password` BOOLEAN NOT NULL DEFAULT true,
    `failed_login_count` SMALLINT NOT NULL DEFAULT 0,
    `locked_until` DATETIME(3) NULL,
    `email` VARCHAR(255) NULL,
    `last_login_at` DATETIME(3) NULL,
    `notification_prefs` JSON NOT NULL DEFAULT (JSON_OBJECT()),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_username_key`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lecturers` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `code` VARCHAR(20) NOT NULL,
    `full_name` VARCHAR(100) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `phone` VARCHAR(10) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `faculty_id` CHAR(36) NULL,

    UNIQUE INDEX `lecturers_user_id_key`(`user_id`),
    UNIQUE INDEX `lecturers_code_key`(`code`),
    UNIQUE INDEX `lecturers_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `students` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `student_code` VARCHAR(20) NOT NULL,
    `full_name` VARCHAR(100) NOT NULL,
    `date_of_birth` DATE NOT NULL,
    `cohort` VARCHAR(10) NULL,
    `major` VARCHAR(200) NULL,
    `phone` VARCHAR(10) NULL,
    `email` VARCHAR(255) NULL,
    `father_phone` VARCHAR(10) NULL,
    `mother_phone` VARCHAR(10) NULL,
    `guardian_phone` VARCHAR(10) NULL,
    `no_parent_reason` VARCHAR(255) NULL,
    `discoverable` BOOLEAN NOT NULL DEFAULT false,
    `avatar_path` TEXT NULL,
    `bio` VARCHAR(1000) NULL,
    `skills` JSON NOT NULL DEFAULT (JSON_ARRAY()),
    `github_url` VARCHAR(255) NULL,
    `behance_url` VARCHAR(255) NULL,
    `linkedin_url` VARCHAR(255) NULL,
    `profile_completed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `admin_class_id` CHAR(36) NULL,

    UNIQUE INDEX `students_user_id_key`(`user_id`),
    UNIQUE INDEX `students_student_code_key`(`student_code`),
    UNIQUE INDEX `students_phone_key`(`phone`),
    UNIQUE INDEX `students_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `parents` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `phone` VARCHAR(10) NOT NULL,
    `full_name` VARCHAR(100) NULL,
    `email` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `parents_user_id_key`(`user_id`),
    UNIQUE INDEX `parents_phone_key`(`phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `parent_students` (
    `parent_id` CHAR(36) NOT NULL,
    `student_id` CHAR(36) NOT NULL,
    `relation` ENUM('FATHER', 'MOTHER', 'GUARDIAN') NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `parent_students_student_id_relation_key`(`student_id`, `relation`),
    PRIMARY KEY (`parent_id`, `student_id`, `relation`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lecturer_notes` (
    `submission_id` CHAR(36) NOT NULL,
    `lecturer_id` CHAR(36) NOT NULL,
    `content` VARCHAR(2000) NOT NULL DEFAULT '',
    `is_sample` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `lecturer_notes_lecturer_id_is_sample_idx`(`lecturer_id`, `is_sample`),
    PRIMARY KEY (`submission_id`, `lecturer_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lecturer_semester_folders` (
    `lecturer_id` CHAR(36) NOT NULL,
    `semester_id` CHAR(36) NOT NULL,
    `root_folder_id` VARCHAR(100) NOT NULL,
    `folder_id` VARCHAR(100) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`lecturer_id`, `semester_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `password_reset_tokens` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `token_hash` CHAR(64) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `used_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `password_reset_tokens_token_hash_key`(`token_hash`),
    INDEX `password_reset_tokens_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `grade_change_requests` (
    `id` CHAR(36) NOT NULL,
    `section_id` CHAR(36) NOT NULL,
    `student_id` CHAR(36) NOT NULL,
    `lecturer_id` CHAR(36) NOT NULL,
    `old_values` JSON NOT NULL,
    `new_values` JSON NOT NULL,
    `reason` VARCHAR(1000) NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `admin_note` VARCHAR(500) NULL,
    `resolved_by` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `resolved_at` DATETIME(3) NULL,

    INDEX `grade_change_requests_section_id_status_idx`(`section_id`, `status`),
    INDEX `grade_change_requests_status_created_at_idx`(`status`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `faculties` (
    `id` CHAR(36) NOT NULL,
    `code` VARCHAR(20) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `faculties_code_key`(`code`),
    UNIQUE INDEX `faculties_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `majors` (
    `id` CHAR(36) NOT NULL,
    `code` VARCHAR(20) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `faculty_id` CHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `majors_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cohorts` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(10) NOT NULL,
    `start_year` SMALLINT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `cohorts_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admin_classes` (
    `id` CHAR(36) NOT NULL,
    `code` VARCHAR(30) NOT NULL,
    `major_id` CHAR(36) NOT NULL,
    `cohort_id` CHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `admin_classes_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `enterprises` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `tax_code` VARCHAR(20) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `contact_name` VARCHAR(100) NOT NULL,
    `phone` VARCHAR(15) NOT NULL,
    `field` VARCHAR(100) NOT NULL,
    `website` VARCHAR(255) NULL,
    `reject_reason` VARCHAR(500) NULL,
    `approved_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `enterprises_user_id_key`(`user_id`),
    UNIQUE INDEX `enterprises_tax_code_key`(`tax_code`),
    UNIQUE INDEX `enterprises_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `system_configs` (
    `key` VARCHAR(40) NOT NULL,
    `value` JSON NOT NULL,
    `updated_by` CHAR(36) NULL,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `semesters` (
    `id` CHAR(36) NOT NULL,
    `code` VARCHAR(20) NOT NULL,
    `academic_year` VARCHAR(9) NOT NULL,
    `term` ENUM('TERM_1', 'TERM_2', 'SUMMER') NOT NULL,
    `start_date` DATE NOT NULL,
    `end_date` DATE NOT NULL,
    `is_current` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `semesters_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `courses` (
    `id` CHAR(36) NOT NULL,
    `code` VARCHAR(20) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `credits` SMALLINT NOT NULL,
    `course_type` ENUM('DESIGN', 'PROGRAMMING', 'OTHER') NOT NULL,
    `w_attendance` SMALLINT NOT NULL DEFAULT 10,
    `w_assignment` SMALLINT NOT NULL DEFAULT 30,
    `w_midterm` SMALLINT NOT NULL DEFAULT 20,
    `w_final` SMALLINT NOT NULL DEFAULT 40,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `faculty_id` CHAR(36) NULL,

    UNIQUE INDEX `courses_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `course_sections` (
    `id` CHAR(36) NOT NULL,
    `code` VARCHAR(30) NOT NULL,
    `course_id` CHAR(36) NOT NULL,
    `semester_id` CHAR(36) NOT NULL,
    `lecturer_id` CHAR(36) NOT NULL,
    `max_students` SMALLINT NOT NULL,
    `schedule` VARCHAR(200) NULL,
    `grades_published_at` DATETIME(3) NULL,
    `drive_folder_id` VARCHAR(100) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `week_start` SMALLINT NOT NULL DEFAULT 1,
    `week_end` SMALLINT NOT NULL DEFAULT 15,
    `sessions` JSON NOT NULL DEFAULT (JSON_ARRAY()),

    UNIQUE INDEX `course_sections_code_key`(`code`),
    INDEX `course_sections_lecturer_id_idx`(`lecturer_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `section_students` (
    `section_id` CHAR(36) NOT NULL,
    `student_id` CHAR(36) NOT NULL,
    `enrolled_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `section_students_student_id_idx`(`student_id`),
    PRIMARY KEY (`section_id`, `student_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lecturer_drive_links` (
    `id` CHAR(36) NOT NULL,
    `lecturer_id` CHAR(36) NOT NULL,
    `auth_mode` ENUM('SERVICE_ACCOUNT', 'OAUTH') NOT NULL DEFAULT 'OAUTH',
    `root_folder_id` VARCHAR(100) NOT NULL,
    `root_folder_url` TEXT NOT NULL,
    `root_folder_name` VARCHAR(255) NULL,
    `shared_drive_id` VARCHAR(100) NULL,
    `status` ENUM('OK', 'NO_PERMISSION', 'NOT_FOUND', 'NOT_SHARED_DRIVE', 'QUOTA_EXCEEDED', 'EXPIRED') NOT NULL DEFAULT 'OK',
    `checked_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `google_email` VARCHAR(255) NULL,
    `refresh_token_enc` TEXT NULL,
    `linked_at` DATETIME(3) NULL,

    UNIQUE INDEX `lecturer_drive_links_lecturer_id_key`(`lecturer_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `assignments` (
    `id` CHAR(36) NOT NULL,
    `section_id` CHAR(36) NOT NULL,
    `batch_id` CHAR(36) NULL,
    `title` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `work_mode` ENUM('INDIVIDUAL', 'GROUP') NOT NULL,
    `has_individual_part` BOOLEAN NOT NULL DEFAULT false,
    `product_types` JSON NOT NULL,
    `open_at` DATETIME(3) NOT NULL,
    `due_at` DATETIME(3) NOT NULL,
    `allow_late` BOOLEAN NOT NULL DEFAULT false,
    `late_due_at` DATETIME(3) NULL,
    `weight` SMALLINT NOT NULL DEFAULT 10,
    `suggested_topics` JSON NOT NULL DEFAULT (JSON_ARRAY()),
    `auto_open` BOOLEAN NOT NULL DEFAULT true,
    `brief_file_name` VARCHAR(255) NULL,
    `brief_file_path` TEXT NULL,
    `brief_file_size` BIGINT NULL,
    `brief_mime_type` VARCHAR(100) NULL,
    `brief_drive_file_id` VARCHAR(100) NULL,
    `status` ENUM('DRAFT', 'OPEN', 'CLOSED') NOT NULL,
    `drive_parent_folder_id` VARCHAR(100) NOT NULL,
    `drive_folder_id` VARCHAR(100) NOT NULL,
    `groups_imported_at` DATETIME(3) NULL,
    `grades_published_at` DATETIME(3) NULL,
    `deadline_processed_at` DATETIME(3) NULL,
    `created_by` CHAR(36) NOT NULL,
    `deleted_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `assignments_section_id_status_idx`(`section_id`, `status`),
    INDEX `assignments_status_due_at_idx`(`status`, `due_at`),
    INDEX `assignments_batch_id_idx`(`batch_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `groups` (
    `id` CHAR(36) NOT NULL,
    `assignment_id` CHAR(36) NOT NULL,
    `seq` SMALLINT NOT NULL,
    `code` VARCHAR(20) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `leader_id` CHAR(36) NULL,
    `import_job_id` CHAR(36) NULL,
    `drive_folder_id` VARCHAR(100) NULL,
    `drive_shared_folder_id` VARCHAR(100) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `groups_assignment_id_seq_key`(`assignment_id`, `seq`),
    UNIQUE INDEX `groups_assignment_id_code_key`(`assignment_id`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `group_members` (
    `group_id` CHAR(36) NOT NULL,
    `student_id` CHAR(36) NOT NULL,
    `assignment_id` CHAR(36) NOT NULL,
    `role` ENUM('LEADER', 'MEMBER') NOT NULL DEFAULT 'MEMBER',
    `joined_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `drive_personal_folder_id` VARCHAR(100) NULL,

    INDEX `group_members_student_id_idx`(`student_id`),
    UNIQUE INDEX `group_members_assignment_id_student_id_key`(`assignment_id`, `student_id`),
    PRIMARY KEY (`group_id`, `student_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `individual_works` (
    `assignment_id` CHAR(36) NOT NULL,
    `student_id` CHAR(36) NOT NULL,
    `drive_folder_id` VARCHAR(100) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`assignment_id`, `student_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `topics` (
    `id` CHAR(36) NOT NULL,
    `assignment_id` CHAR(36) NOT NULL,
    `group_id` CHAR(36) NULL,
    `student_id` CHAR(36) NULL,
    `title` VARCHAR(200) NOT NULL,
    `keywords` JSON NOT NULL DEFAULT (JSON_ARRAY()),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `topics_group_id_key`(`group_id`),
    INDEX `topics_assignment_id_idx`(`assignment_id`),
    UNIQUE INDEX `topics_assignment_id_student_id_key`(`assignment_id`, `student_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `topic_histories` (
    `id` CHAR(36) NOT NULL,
    `topic_id` CHAR(36) NOT NULL,
    `actor_id` CHAR(36) NOT NULL,
    `action` ENUM('CREATE', 'UPDATE') NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `note` VARCHAR(1000) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `topic_histories_topic_id_created_at_idx`(`topic_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `assignment_views` (
    `assignment_id` CHAR(36) NOT NULL,
    `student_id` CHAR(36) NOT NULL,
    `first_viewed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`assignment_id`, `student_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `group_reports` (
    `id` CHAR(36) NOT NULL,
    `assignment_id` CHAR(36) NOT NULL,
    `student_id` CHAR(36) NOT NULL,
    `group_id` CHAR(36) NULL,
    `content` VARCHAR(500) NOT NULL,
    `status` ENUM('OPEN', 'RESOLVED') NOT NULL DEFAULT 'OPEN',
    `resolution_note` VARCHAR(500) NULL,
    `resolved_by` CHAR(36) NULL,
    `resolved_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `group_reports_assignment_id_status_idx`(`assignment_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `submissions` (
    `id` CHAR(36) NOT NULL,
    `assignment_id` CHAR(36) NOT NULL,
    `kind` ENUM('GROUP_SHARED', 'PERSONAL') NOT NULL,
    `group_id` CHAR(36) NULL,
    `student_id` CHAR(36) NULL,
    `topic_id` CHAR(36) NULL,
    `last_submitted_by` CHAR(36) NOT NULL,
    `figma_url` VARCHAR(500) NULL,
    `git_url` VARCHAR(500) NULL,
    `note` VARCHAR(2000) NULL,
    `contribution_percent` SMALLINT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `submitted_at` DATETIME(3) NOT NULL,
    `is_late` BOOLEAN NOT NULL DEFAULT false,
    `status` ENUM('SUBMITTED', 'LATE') NOT NULL,
    `sync_status` ENUM('PENDING', 'SYNCED', 'ERROR') NOT NULL DEFAULT 'PENDING',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `submissions_assignment_id_status_idx`(`assignment_id`, `status`),
    INDEX `submissions_group_id_idx`(`group_id`),
    INDEX `submissions_student_id_idx`(`student_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `submission_files` (
    `id` CHAR(36) NOT NULL,
    `submission_id` CHAR(36) NOT NULL,
    `file_type` ENUM('IMAGE', 'VIDEO', 'SOURCE', 'DOCUMENT') NOT NULL,
    `original_name` VARCHAR(255) NOT NULL,
    `mime_type` VARCHAR(100) NOT NULL,
    `size_bytes` BIGINT NOT NULL,
    `sha256` CHAR(64) NOT NULL,
    `sort_order` SMALLINT NOT NULL,
    `drive_file_id` VARCHAR(100) NULL,
    `local_path` TEXT NULL,
    `sync_status` ENUM('PENDING', 'UPLOADING', 'SYNCED', 'FAILED', 'MISSING') NOT NULL DEFAULT 'PENDING',
    `retry_count` SMALLINT NOT NULL DEFAULT 0,
    `next_retry_at` DATETIME(3) NULL,
    `last_error` TEXT NULL,
    `uploaded_by` CHAR(36) NOT NULL,
    `deleted_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `submission_files_submission_id_sort_order_idx`(`submission_id`, `sort_order`),
    INDEX `submission_files_sync_status_next_retry_at_idx`(`sync_status`, `next_retry_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `submission_events` (
    `id` CHAR(36) NOT NULL,
    `assignment_id` CHAR(36) NOT NULL,
    `submission_id` CHAR(36) NULL,
    `kind` ENUM('GROUP_SHARED', 'PERSONAL') NOT NULL,
    `group_id` CHAR(36) NULL,
    `student_id` CHAR(36) NULL,
    `actor_id` CHAR(36) NOT NULL,
    `action` ENUM('SUBMIT', 'RESUBMIT', 'DELETE_FILES', 'SYNC_FAILED') NOT NULL,
    `version` INTEGER NOT NULL,
    `detail` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `submission_events_assignment_id_group_id_idx`(`assignment_id`, `group_id`),
    INDEX `submission_events_assignment_id_student_id_idx`(`assignment_id`, `student_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `assignment_grades` (
    `assignment_id` CHAR(36) NOT NULL,
    `student_id` CHAR(36) NOT NULL,
    `score` DECIMAL(3, 1) NULL,
    `note` VARCHAR(1000) NULL,
    `import_job_id` CHAR(36) NULL,
    `updated_by` CHAR(36) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `assignment_grades_student_id_idx`(`student_id`),
    PRIMARY KEY (`assignment_id`, `student_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `section_grades` (
    `id` CHAR(36) NOT NULL,
    `section_id` CHAR(36) NOT NULL,
    `student_id` CHAR(36) NOT NULL,
    `attendance` DECIMAL(3, 1) NULL,
    `assignment` DECIMAL(3, 1) NULL,
    `midterm` DECIMAL(3, 1) NULL,
    `final` DECIMAL(3, 1) NULL,
    `total` DECIMAL(3, 1) NULL,
    `letter` VARCHAR(2) NULL,
    `gpa4` DECIMAL(2, 1) NULL,
    `status` ENUM('DRAFT', 'PUBLISHED') NOT NULL DEFAULT 'DRAFT',
    `import_job_id` CHAR(36) NULL,
    `updated_by` CHAR(36) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `section_grades_section_id_student_id_key`(`section_id`, `student_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `import_jobs` (
    `id` CHAR(36) NOT NULL,
    `type` ENUM('ASSIGNMENT_GROUPS', 'ASSIGNMENT_GRADES', 'SECTION_GRADES') NOT NULL,
    `assignment_id` CHAR(36) NULL,
    `section_id` CHAR(36) NULL,
    `file_name` VARCHAR(255) NOT NULL,
    `status` ENUM('PREVIEW', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PREVIEW',
    `total_rows` INTEGER NOT NULL,
    `error_rows` INTEGER NOT NULL,
    `preview` JSON NOT NULL,
    `errors` JSON NOT NULL,
    `created_by` CHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completed_at` DATETIME(3) NULL,

    INDEX `import_jobs_assignment_id_type_created_at_idx`(`assignment_id`, `type`, `created_at` DESC),
    INDEX `import_jobs_section_id_type_created_at_idx`(`section_id`, `type`, `created_at` DESC),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `type` VARCHAR(50) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `body` VARCHAR(1000) NULL,
    `link` VARCHAR(300) NULL,
    `dedupe_key` VARCHAR(150) NULL,
    `read_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notifications_user_id_created_at_idx`(`user_id`, `created_at` DESC),
    UNIQUE INDEX `notifications_user_id_dedupe_key_key`(`user_id`, `dedupe_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `actor_id` CHAR(36) NULL,
    `action` VARCHAR(60) NOT NULL,
    `entity_type` VARCHAR(40) NOT NULL,
    `entity_id` VARCHAR(64) NULL,
    `summary` VARCHAR(500) NULL,
    `old_data` JSON NULL,
    `new_data` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_entity_type_entity_id_created_at_idx`(`entity_type`, `entity_id`, `created_at` DESC),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `lecturers` ADD CONSTRAINT `lecturers_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lecturers` ADD CONSTRAINT `lecturers_faculty_id_fkey` FOREIGN KEY (`faculty_id`) REFERENCES `faculties`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `students` ADD CONSTRAINT `students_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `students` ADD CONSTRAINT `students_admin_class_id_fkey` FOREIGN KEY (`admin_class_id`) REFERENCES `admin_classes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `parents` ADD CONSTRAINT `parents_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `parent_students` ADD CONSTRAINT `parent_students_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `parents`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `parent_students` ADD CONSTRAINT `parent_students_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lecturer_notes` ADD CONSTRAINT `lecturer_notes_submission_id_fkey` FOREIGN KEY (`submission_id`) REFERENCES `submissions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lecturer_notes` ADD CONSTRAINT `lecturer_notes_lecturer_id_fkey` FOREIGN KEY (`lecturer_id`) REFERENCES `lecturers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lecturer_semester_folders` ADD CONSTRAINT `lecturer_semester_folders_lecturer_id_fkey` FOREIGN KEY (`lecturer_id`) REFERENCES `lecturers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lecturer_semester_folders` ADD CONSTRAINT `lecturer_semester_folders_semester_id_fkey` FOREIGN KEY (`semester_id`) REFERENCES `semesters`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `password_reset_tokens` ADD CONSTRAINT `password_reset_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `grade_change_requests` ADD CONSTRAINT `grade_change_requests_section_id_fkey` FOREIGN KEY (`section_id`) REFERENCES `course_sections`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `grade_change_requests` ADD CONSTRAINT `grade_change_requests_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `grade_change_requests` ADD CONSTRAINT `grade_change_requests_lecturer_id_fkey` FOREIGN KEY (`lecturer_id`) REFERENCES `lecturers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `majors` ADD CONSTRAINT `majors_faculty_id_fkey` FOREIGN KEY (`faculty_id`) REFERENCES `faculties`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `admin_classes` ADD CONSTRAINT `admin_classes_major_id_fkey` FOREIGN KEY (`major_id`) REFERENCES `majors`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `admin_classes` ADD CONSTRAINT `admin_classes_cohort_id_fkey` FOREIGN KEY (`cohort_id`) REFERENCES `cohorts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `enterprises` ADD CONSTRAINT `enterprises_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `courses` ADD CONSTRAINT `courses_faculty_id_fkey` FOREIGN KEY (`faculty_id`) REFERENCES `faculties`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `course_sections` ADD CONSTRAINT `course_sections_course_id_fkey` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `course_sections` ADD CONSTRAINT `course_sections_semester_id_fkey` FOREIGN KEY (`semester_id`) REFERENCES `semesters`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `course_sections` ADD CONSTRAINT `course_sections_lecturer_id_fkey` FOREIGN KEY (`lecturer_id`) REFERENCES `lecturers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `section_students` ADD CONSTRAINT `section_students_section_id_fkey` FOREIGN KEY (`section_id`) REFERENCES `course_sections`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `section_students` ADD CONSTRAINT `section_students_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lecturer_drive_links` ADD CONSTRAINT `lecturer_drive_links_lecturer_id_fkey` FOREIGN KEY (`lecturer_id`) REFERENCES `lecturers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assignments` ADD CONSTRAINT `assignments_section_id_fkey` FOREIGN KEY (`section_id`) REFERENCES `course_sections`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assignments` ADD CONSTRAINT `assignments_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `lecturers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `groups` ADD CONSTRAINT `groups_assignment_id_fkey` FOREIGN KEY (`assignment_id`) REFERENCES `assignments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `group_members` ADD CONSTRAINT `group_members_group_id_fkey` FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `group_members` ADD CONSTRAINT `group_members_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `group_members` ADD CONSTRAINT `group_members_assignment_id_fkey` FOREIGN KEY (`assignment_id`) REFERENCES `assignments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `individual_works` ADD CONSTRAINT `individual_works_assignment_id_fkey` FOREIGN KEY (`assignment_id`) REFERENCES `assignments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `individual_works` ADD CONSTRAINT `individual_works_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `topics` ADD CONSTRAINT `topics_assignment_id_fkey` FOREIGN KEY (`assignment_id`) REFERENCES `assignments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `topics` ADD CONSTRAINT `topics_group_id_fkey` FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `topics` ADD CONSTRAINT `topics_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `topic_histories` ADD CONSTRAINT `topic_histories_topic_id_fkey` FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `topic_histories` ADD CONSTRAINT `topic_histories_actor_id_fkey` FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assignment_views` ADD CONSTRAINT `assignment_views_assignment_id_fkey` FOREIGN KEY (`assignment_id`) REFERENCES `assignments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assignment_views` ADD CONSTRAINT `assignment_views_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `group_reports` ADD CONSTRAINT `group_reports_assignment_id_fkey` FOREIGN KEY (`assignment_id`) REFERENCES `assignments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `group_reports` ADD CONSTRAINT `group_reports_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `submissions` ADD CONSTRAINT `submissions_assignment_id_fkey` FOREIGN KEY (`assignment_id`) REFERENCES `assignments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `submissions` ADD CONSTRAINT `submissions_group_id_fkey` FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `submissions` ADD CONSTRAINT `submissions_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `submissions` ADD CONSTRAINT `submissions_topic_id_fkey` FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `submissions` ADD CONSTRAINT `submissions_last_submitted_by_fkey` FOREIGN KEY (`last_submitted_by`) REFERENCES `students`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `submission_files` ADD CONSTRAINT `submission_files_submission_id_fkey` FOREIGN KEY (`submission_id`) REFERENCES `submissions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `submission_files` ADD CONSTRAINT `submission_files_uploaded_by_fkey` FOREIGN KEY (`uploaded_by`) REFERENCES `students`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `submission_events` ADD CONSTRAINT `submission_events_submission_id_fkey` FOREIGN KEY (`submission_id`) REFERENCES `submissions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assignment_grades` ADD CONSTRAINT `assignment_grades_assignment_id_fkey` FOREIGN KEY (`assignment_id`) REFERENCES `assignments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assignment_grades` ADD CONSTRAINT `assignment_grades_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `section_grades` ADD CONSTRAINT `section_grades_section_id_fkey` FOREIGN KEY (`section_id`) REFERENCES `course_sections`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `section_grades` ADD CONSTRAINT `section_grades_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `import_jobs` ADD CONSTRAINT `import_jobs_assignment_id_fkey` FOREIGN KEY (`assignment_id`) REFERENCES `assignments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `import_jobs` ADD CONSTRAINT `import_jobs_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_actor_id_fkey` FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

