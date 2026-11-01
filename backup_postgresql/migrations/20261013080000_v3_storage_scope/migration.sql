-- v3.0: đưa dữ liệu cũ về giá trị còn hợp lệ trước khi thu gọn enum
UPDATE "topic_histories" SET "action" = 'UPDATE' WHERE "action"::text NOT IN ('CREATE', 'UPDATE');
DELETE FROM "submission_events" WHERE "action"::text IN ('GRADE', 'RETURN');
UPDATE "submissions" SET "status" = CASE WHEN "is_late" THEN 'LATE'::"submission_status" ELSE 'SUBMITTED'::"submission_status" END WHERE "status"::text NOT IN ('SUBMITTED', 'LATE');
UPDATE "assignments" SET "work_mode" = 'GROUP' WHERE "work_mode"::text = 'CHOICE';

-- CreateEnum
CREATE TYPE "report_status" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "import_type" AS ENUM ('ASSIGNMENT_GROUPS', 'ASSIGNMENT_GRADES', 'SECTION_GRADES');

-- CreateEnum
CREATE TYPE "import_status" AS ENUM ('PREVIEW', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "grade_status" AS ENUM ('DRAFT', 'PUBLISHED');

-- AlterEnum
BEGIN;
CREATE TYPE "submission_action_new" AS ENUM ('SUBMIT', 'RESUBMIT', 'DELETE_FILES', 'SYNC_FAILED');
ALTER TABLE "submission_events" ALTER COLUMN "action" TYPE "submission_action_new" USING ("action"::text::"submission_action_new");
ALTER TYPE "submission_action" RENAME TO "submission_action_old";
ALTER TYPE "submission_action_new" RENAME TO "submission_action";
DROP TYPE "public"."submission_action_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "submission_status_new" AS ENUM ('SUBMITTED', 'LATE');
ALTER TABLE "submissions" ALTER COLUMN "status" TYPE "submission_status_new" USING ("status"::text::"submission_status_new");
ALTER TYPE "submission_status" RENAME TO "submission_status_old";
ALTER TYPE "submission_status_new" RENAME TO "submission_status";
DROP TYPE "public"."submission_status_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "topic_action_new" AS ENUM ('CREATE', 'UPDATE');
ALTER TABLE "topic_histories" ALTER COLUMN "action" TYPE "topic_action_new" USING ("action"::text::"topic_action_new");
ALTER TYPE "topic_action" RENAME TO "topic_action_old";
ALTER TYPE "topic_action_new" RENAME TO "topic_action";
DROP TYPE "public"."topic_action_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "work_mode_new" AS ENUM ('INDIVIDUAL', 'GROUP');
ALTER TABLE "assignments" ALTER COLUMN "work_mode" TYPE "work_mode_new" USING ("work_mode"::text::"work_mode_new");
ALTER TYPE "work_mode" RENAME TO "work_mode_old";
ALTER TYPE "work_mode_new" RENAME TO "work_mode";
DROP TYPE "public"."work_mode_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "group_invitations" DROP CONSTRAINT "group_invitations_group_id_fkey";

-- DropForeignKey
ALTER TABLE "group_invitations" DROP CONSTRAINT "group_invitations_invitee_id_fkey";

-- DropForeignKey
ALTER TABLE "group_invitations" DROP CONSTRAINT "group_invitations_inviter_id_fkey";

-- DropForeignKey
ALTER TABLE "group_member_changes" DROP CONSTRAINT "group_member_changes_assignment_id_fkey";

-- DropIndex
DROP INDEX "groups_invite_code_key";

-- AlterTable
ALTER TABLE "assignments" DROP COLUMN "allow_duplicate_topics",
DROP COLUMN "appeal_days",
DROP COLUMN "group_lock_at",
DROP COLUMN "group_lock_processed_at",
DROP COLUMN "group_weight",
DROP COLUMN "individual_weight",
DROP COLUMN "late_penalty_percent",
DROP COLUMN "max_members",
DROP COLUMN "min_members",
DROP COLUMN "require_topic_approval",
DROP COLUMN "unassigned_policy",
ADD COLUMN     "groups_imported_at" TIMESTAMPTZ,
ALTER COLUMN "weight" SET DEFAULT 10;

-- AlterTable
ALTER TABLE "groups" DROP COLUMN "formed_by",
DROP COLUMN "invite_code",
DROP COLUMN "invite_code_active",
DROP COLUMN "locked_at",
DROP COLUMN "status",
ADD COLUMN     "code" VARCHAR(20) NOT NULL,
ADD COLUMN     "import_job_id" UUID,
ALTER COLUMN "name" SET DATA TYPE VARCHAR(100);

-- AlterTable
ALTER TABLE "lecturer_drive_links" ALTER COLUMN "auth_mode" SET DEFAULT 'OAUTH';

-- AlterTable
ALTER TABLE "submissions" DROP COLUMN "feedback",
DROP COLUMN "score";

-- AlterTable
ALTER TABLE "topics" DROP COLUMN "approval_status",
DROP COLUMN "description",
DROP COLUMN "review_note",
DROP COLUMN "reviewed_at",
DROP COLUMN "reviewed_by",
DROP COLUMN "submit_count",
DROP COLUMN "submitted_at",
DROP COLUMN "technologies";

-- DropTable
DROP TABLE "group_invitations";

-- DropTable
DROP TABLE "group_member_changes";

-- DropEnum
DROP TYPE "group_origin";

-- DropEnum
DROP TYPE "group_status";

-- DropEnum
DROP TYPE "invitation_status";

-- DropEnum
DROP TYPE "member_change";

-- DropEnum
DROP TYPE "topic_approval";

-- DropEnum
DROP TYPE "unassigned_policy";

-- CreateTable
CREATE TABLE "group_reports" (
    "id" UUID NOT NULL,
    "assignment_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "group_id" UUID,
    "content" VARCHAR(500) NOT NULL,
    "status" "report_status" NOT NULL DEFAULT 'OPEN',
    "resolution_note" VARCHAR(500),
    "resolved_by" UUID,
    "resolved_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignment_grades" (
    "assignment_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "score" DECIMAL(3,1),
    "note" VARCHAR(1000),
    "import_job_id" UUID,
    "updated_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "assignment_grades_pkey" PRIMARY KEY ("assignment_id","student_id")
);

-- CreateTable
CREATE TABLE "section_grades" (
    "id" UUID NOT NULL,
    "section_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "attendance" DECIMAL(3,1),
    "assignment" DECIMAL(3,1),
    "midterm" DECIMAL(3,1),
    "final" DECIMAL(3,1),
    "total" DECIMAL(3,1),
    "letter" VARCHAR(2),
    "gpa4" DECIMAL(2,1),
    "status" "grade_status" NOT NULL DEFAULT 'DRAFT',
    "import_job_id" UUID,
    "updated_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "section_grades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_jobs" (
    "id" UUID NOT NULL,
    "type" "import_type" NOT NULL,
    "assignment_id" UUID,
    "section_id" UUID,
    "file_name" VARCHAR(255) NOT NULL,
    "status" "import_status" NOT NULL DEFAULT 'PREVIEW',
    "total_rows" INTEGER NOT NULL,
    "error_rows" INTEGER NOT NULL,
    "preview" JSONB NOT NULL,
    "errors" JSONB NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ,

    CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "group_reports_assignment_id_status_idx" ON "group_reports"("assignment_id", "status");

-- CreateIndex
CREATE INDEX "assignment_grades_student_id_idx" ON "assignment_grades"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "section_grades_section_id_student_id_key" ON "section_grades"("section_id", "student_id");

-- CreateIndex
CREATE INDEX "import_jobs_assignment_id_type_created_at_idx" ON "import_jobs"("assignment_id", "type", "created_at" DESC);

-- CreateIndex
CREATE INDEX "import_jobs_section_id_type_created_at_idx" ON "import_jobs"("section_id", "type", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "groups_assignment_id_code_key" ON "groups"("assignment_id", "code");

-- AddForeignKey
ALTER TABLE "group_reports" ADD CONSTRAINT "group_reports_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_reports" ADD CONSTRAINT "group_reports_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_grades" ADD CONSTRAINT "assignment_grades_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_grades" ADD CONSTRAINT "assignment_grades_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "section_grades" ADD CONSTRAINT "section_grades_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "course_sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "section_grades" ADD CONSTRAINT "section_grades_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

