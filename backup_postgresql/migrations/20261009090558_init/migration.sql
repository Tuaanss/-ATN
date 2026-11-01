-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('ADMIN', 'LECTURER', 'STUDENT', 'PARENT', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('PENDING', 'ACTIVE', 'LOCKED', 'REJECTED', 'DISABLED');

-- CreateEnum
CREATE TYPE "term_type" AS ENUM ('TERM_1', 'TERM_2', 'SUMMER');

-- CreateEnum
CREATE TYPE "course_type" AS ENUM ('DESIGN', 'PROGRAMMING', 'OTHER');

-- CreateEnum
CREATE TYPE "drive_auth_mode" AS ENUM ('SERVICE_ACCOUNT', 'OAUTH');

-- CreateEnum
CREATE TYPE "drive_link_status" AS ENUM ('OK', 'NO_PERMISSION', 'NOT_FOUND', 'NOT_SHARED_DRIVE', 'QUOTA_EXCEEDED');

-- CreateEnum
CREATE TYPE "work_mode" AS ENUM ('INDIVIDUAL', 'GROUP', 'CHOICE');

-- CreateEnum
CREATE TYPE "product_type" AS ENUM ('IMAGE', 'FIGMA', 'VIDEO', 'SOURCE', 'GIT_LINK');

-- CreateEnum
CREATE TYPE "assignment_status" AS ENUM ('DRAFT', 'OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "unassigned_policy" AS ENUM ('AUTO_GROUP', 'INDIVIDUAL');

-- CreateEnum
CREATE TYPE "group_status" AS ENUM ('OPEN', 'LOCKED');

-- CreateEnum
CREATE TYPE "member_role" AS ENUM ('LEADER', 'MEMBER');

-- CreateEnum
CREATE TYPE "topic_approval" AS ENUM ('PENDING', 'APPROVED', 'REVISION_REQUESTED');

-- CreateEnum
CREATE TYPE "submission_kind" AS ENUM ('GROUP_SHARED', 'PERSONAL');

-- CreateEnum
CREATE TYPE "submission_status" AS ENUM ('SUBMITTED', 'LATE', 'GRADED', 'RETURNED');

-- CreateEnum
CREATE TYPE "sync_summary" AS ENUM ('PENDING', 'SYNCED', 'ERROR');

-- CreateEnum
CREATE TYPE "file_type" AS ENUM ('IMAGE', 'VIDEO', 'SOURCE');

-- CreateEnum
CREATE TYPE "file_sync_status" AS ENUM ('PENDING', 'UPLOADING', 'SYNCED', 'FAILED', 'MISSING');

-- CreateEnum
CREATE TYPE "submission_action" AS ENUM ('SUBMIT', 'RESUBMIT', 'DELETE_FILES', 'GRADE', 'RETURN', 'SYNC_FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "username" VARCHAR(100) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" "user_role" NOT NULL,
    "status" "user_status" NOT NULL DEFAULT 'ACTIVE',
    "must_change_password" BOOLEAN NOT NULL DEFAULT true,
    "failed_login_count" SMALLINT NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ,
    "email" VARCHAR(255),
    "last_login_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lecturers" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "full_name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(10),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "lecturers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "student_code" VARCHAR(20) NOT NULL,
    "full_name" VARCHAR(100) NOT NULL,
    "date_of_birth" DATE NOT NULL,
    "cohort" VARCHAR(10),
    "major" VARCHAR(200),
    "phone" VARCHAR(10),
    "email" VARCHAR(255),
    "profile_completed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "semesters" (
    "id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "academic_year" VARCHAR(9) NOT NULL,
    "term" "term_type" NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "is_current" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "semesters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courses" (
    "id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "credits" SMALLINT NOT NULL,
    "course_type" "course_type" NOT NULL,
    "w_attendance" SMALLINT NOT NULL DEFAULT 10,
    "w_assignment" SMALLINT NOT NULL DEFAULT 30,
    "w_midterm" SMALLINT NOT NULL DEFAULT 20,
    "w_final" SMALLINT NOT NULL DEFAULT 40,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_sections" (
    "id" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "course_id" UUID NOT NULL,
    "semester_id" UUID NOT NULL,
    "lecturer_id" UUID NOT NULL,
    "max_students" SMALLINT NOT NULL,
    "schedule" VARCHAR(200),
    "grades_published_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "course_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "section_students" (
    "section_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "enrolled_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "section_students_pkey" PRIMARY KEY ("section_id","student_id")
);

-- CreateTable
CREATE TABLE "lecturer_drive_links" (
    "id" UUID NOT NULL,
    "lecturer_id" UUID NOT NULL,
    "auth_mode" "drive_auth_mode" NOT NULL DEFAULT 'SERVICE_ACCOUNT',
    "root_folder_id" VARCHAR(100) NOT NULL,
    "root_folder_url" TEXT NOT NULL,
    "root_folder_name" VARCHAR(255),
    "shared_drive_id" VARCHAR(100),
    "status" "drive_link_status" NOT NULL DEFAULT 'OK',
    "checked_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lecturer_drive_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignments" (
    "id" UUID NOT NULL,
    "section_id" UUID NOT NULL,
    "batch_id" UUID,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "work_mode" "work_mode" NOT NULL,
    "min_members" SMALLINT,
    "max_members" SMALLINT,
    "product_types" "product_type"[],
    "open_at" TIMESTAMPTZ NOT NULL,
    "group_lock_at" TIMESTAMPTZ,
    "due_at" TIMESTAMPTZ NOT NULL,
    "allow_late" BOOLEAN NOT NULL DEFAULT false,
    "late_due_at" TIMESTAMPTZ,
    "late_penalty_percent" SMALLINT NOT NULL DEFAULT 0,
    "weight" SMALLINT NOT NULL DEFAULT 1,
    "unassigned_policy" "unassigned_policy",
    "require_topic_approval" BOOLEAN NOT NULL DEFAULT false,
    "has_individual_part" BOOLEAN NOT NULL DEFAULT false,
    "group_weight" SMALLINT,
    "individual_weight" SMALLINT,
    "appeal_days" SMALLINT NOT NULL DEFAULT 7,
    "status" "assignment_status" NOT NULL,
    "drive_parent_folder_id" VARCHAR(100) NOT NULL,
    "drive_folder_id" VARCHAR(100) NOT NULL,
    "grades_published_at" TIMESTAMPTZ,
    "group_lock_processed_at" TIMESTAMPTZ,
    "deadline_processed_at" TIMESTAMPTZ,
    "created_by" UUID NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "groups" (
    "id" UUID NOT NULL,
    "assignment_id" UUID NOT NULL,
    "seq" SMALLINT NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "leader_id" UUID,
    "invite_code" CHAR(8) NOT NULL,
    "invite_code_active" BOOLEAN NOT NULL DEFAULT true,
    "status" "group_status" NOT NULL DEFAULT 'OPEN',
    "locked_at" TIMESTAMPTZ,
    "drive_folder_id" VARCHAR(100),
    "drive_shared_folder_id" VARCHAR(100),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_members" (
    "group_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "assignment_id" UUID NOT NULL,
    "role" "member_role" NOT NULL DEFAULT 'MEMBER',
    "joined_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "drive_personal_folder_id" VARCHAR(100),

    CONSTRAINT "group_members_pkey" PRIMARY KEY ("group_id","student_id")
);

-- CreateTable
CREATE TABLE "individual_works" (
    "assignment_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "drive_folder_id" VARCHAR(100),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "individual_works_pkey" PRIMARY KEY ("assignment_id","student_id")
);

-- CreateTable
CREATE TABLE "topics" (
    "id" UUID NOT NULL,
    "assignment_id" UUID NOT NULL,
    "group_id" UUID,
    "student_id" UUID,
    "title" VARCHAR(200) NOT NULL,
    "description" VARCHAR(1000),
    "technologies" VARCHAR(200),
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "approval_status" "topic_approval",
    "review_note" VARCHAR(1000),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submissions" (
    "id" UUID NOT NULL,
    "assignment_id" UUID NOT NULL,
    "kind" "submission_kind" NOT NULL,
    "group_id" UUID,
    "student_id" UUID,
    "topic_id" UUID,
    "last_submitted_by" UUID NOT NULL,
    "figma_url" VARCHAR(500),
    "git_url" VARCHAR(500),
    "note" VARCHAR(2000),
    "version" INTEGER NOT NULL DEFAULT 1,
    "submitted_at" TIMESTAMPTZ NOT NULL,
    "is_late" BOOLEAN NOT NULL DEFAULT false,
    "status" "submission_status" NOT NULL,
    "sync_status" "sync_summary" NOT NULL DEFAULT 'PENDING',
    "score" DECIMAL(3,1),
    "feedback" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submission_files" (
    "id" UUID NOT NULL,
    "submission_id" UUID NOT NULL,
    "file_type" "file_type" NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "sort_order" SMALLINT NOT NULL,
    "drive_file_id" VARCHAR(100),
    "local_path" TEXT,
    "sync_status" "file_sync_status" NOT NULL DEFAULT 'PENDING',
    "retry_count" SMALLINT NOT NULL DEFAULT 0,
    "next_retry_at" TIMESTAMPTZ,
    "last_error" TEXT,
    "uploaded_by" UUID NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "submission_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submission_events" (
    "id" UUID NOT NULL,
    "assignment_id" UUID NOT NULL,
    "submission_id" UUID,
    "kind" "submission_kind" NOT NULL,
    "group_id" UUID,
    "student_id" UUID,
    "actor_id" UUID NOT NULL,
    "action" "submission_action" NOT NULL,
    "version" INTEGER NOT NULL,
    "detail" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submission_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" VARCHAR(1000),
    "link" VARCHAR(300),
    "dedupe_key" VARCHAR(150),
    "read_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "lecturers_user_id_key" ON "lecturers"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "lecturers_code_key" ON "lecturers"("code");

-- CreateIndex
CREATE UNIQUE INDEX "lecturers_email_key" ON "lecturers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "students_user_id_key" ON "students"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "students_student_code_key" ON "students"("student_code");

-- CreateIndex
CREATE UNIQUE INDEX "students_phone_key" ON "students"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "students_email_key" ON "students"("email");

-- CreateIndex
CREATE UNIQUE INDEX "semesters_code_key" ON "semesters"("code");

-- CreateIndex
CREATE UNIQUE INDEX "courses_code_key" ON "courses"("code");

-- CreateIndex
CREATE UNIQUE INDEX "course_sections_code_key" ON "course_sections"("code");

-- CreateIndex
CREATE INDEX "course_sections_lecturer_id_idx" ON "course_sections"("lecturer_id");

-- CreateIndex
CREATE INDEX "section_students_student_id_idx" ON "section_students"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "lecturer_drive_links_lecturer_id_key" ON "lecturer_drive_links"("lecturer_id");

-- CreateIndex
CREATE INDEX "assignments_section_id_status_idx" ON "assignments"("section_id", "status");

-- CreateIndex
CREATE INDEX "assignments_status_due_at_idx" ON "assignments"("status", "due_at");

-- CreateIndex
CREATE INDEX "assignments_batch_id_idx" ON "assignments"("batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "groups_invite_code_key" ON "groups"("invite_code");

-- CreateIndex
CREATE UNIQUE INDEX "groups_assignment_id_seq_key" ON "groups"("assignment_id", "seq");

-- CreateIndex
CREATE INDEX "group_members_student_id_idx" ON "group_members"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "group_members_assignment_id_student_id_key" ON "group_members"("assignment_id", "student_id");

-- CreateIndex
CREATE UNIQUE INDEX "topics_group_id_key" ON "topics"("group_id");

-- CreateIndex
CREATE INDEX "topics_assignment_id_idx" ON "topics"("assignment_id");

-- CreateIndex
CREATE UNIQUE INDEX "topics_assignment_id_student_id_key" ON "topics"("assignment_id", "student_id");

-- CreateIndex
CREATE INDEX "submissions_assignment_id_status_idx" ON "submissions"("assignment_id", "status");

-- CreateIndex
CREATE INDEX "submissions_group_id_idx" ON "submissions"("group_id");

-- CreateIndex
CREATE INDEX "submissions_student_id_idx" ON "submissions"("student_id");

-- CreateIndex
CREATE INDEX "submission_files_submission_id_sort_order_idx" ON "submission_files"("submission_id", "sort_order");

-- CreateIndex
CREATE INDEX "submission_files_sync_status_next_retry_at_idx" ON "submission_files"("sync_status", "next_retry_at");

-- CreateIndex
CREATE INDEX "submission_events_assignment_id_group_id_idx" ON "submission_events"("assignment_id", "group_id");

-- CreateIndex
CREATE INDEX "submission_events_assignment_id_student_id_idx" ON "submission_events"("assignment_id", "student_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "notifications_user_id_dedupe_key_key" ON "notifications"("user_id", "dedupe_key");

-- AddForeignKey
ALTER TABLE "lecturers" ADD CONSTRAINT "lecturers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_sections" ADD CONSTRAINT "course_sections_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_sections" ADD CONSTRAINT "course_sections_semester_id_fkey" FOREIGN KEY ("semester_id") REFERENCES "semesters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_sections" ADD CONSTRAINT "course_sections_lecturer_id_fkey" FOREIGN KEY ("lecturer_id") REFERENCES "lecturers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "section_students" ADD CONSTRAINT "section_students_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "course_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "section_students" ADD CONSTRAINT "section_students_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lecturer_drive_links" ADD CONSTRAINT "lecturer_drive_links_lecturer_id_fkey" FOREIGN KEY ("lecturer_id") REFERENCES "lecturers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "course_sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "lecturers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "individual_works" ADD CONSTRAINT "individual_works_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "individual_works" ADD CONSTRAINT "individual_works_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_last_submitted_by_fkey" FOREIGN KEY ("last_submitted_by") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_files" ADD CONSTRAINT "submission_files_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_files" ADD CONSTRAINT "submission_files_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_events" ADD CONSTRAINT "submission_events_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
