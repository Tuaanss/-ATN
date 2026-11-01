-- CreateEnum
CREATE TYPE "group_origin" AS ENUM ('STUDENT', 'AUTO', 'LECTURER');

-- CreateEnum
CREATE TYPE "invitation_status" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "member_change" AS ENUM ('ADD', 'REMOVE', 'MOVE', 'AUTO_ASSIGN', 'SWITCH_INDIVIDUAL');

-- CreateEnum
CREATE TYPE "topic_action" AS ENUM ('CREATE', 'UPDATE', 'SUBMIT', 'APPROVE', 'REQUEST_REVISION');

-- AlterEnum
ALTER TYPE "topic_approval" ADD VALUE 'DRAFT';

-- AlterTable
ALTER TABLE "assignments" ADD COLUMN     "allow_duplicate_topics" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "auto_open" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "brief_drive_file_id" VARCHAR(100),
ADD COLUMN     "brief_file_name" VARCHAR(255),
ADD COLUMN     "brief_file_path" TEXT,
ADD COLUMN     "brief_file_size" BIGINT,
ADD COLUMN     "brief_mime_type" VARCHAR(100),
ADD COLUMN     "suggested_topics" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "groups" ADD COLUMN     "formed_by" "group_origin" NOT NULL DEFAULT 'STUDENT';

-- AlterTable
ALTER TABLE "submissions" ADD COLUMN     "contribution_percent" SMALLINT;

-- AlterTable
ALTER TABLE "topics" ADD COLUMN     "reviewed_at" TIMESTAMPTZ,
ADD COLUMN     "reviewed_by" UUID,
ADD COLUMN     "submit_count" SMALLINT NOT NULL DEFAULT 0,
ADD COLUMN     "submitted_at" TIMESTAMPTZ;

-- CreateTable
CREATE TABLE "topic_histories" (
    "id" UUID NOT NULL,
    "topic_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "action" "topic_action" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "note" VARCHAR(1000),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "topic_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignment_views" (
    "assignment_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "first_viewed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assignment_views_pkey" PRIMARY KEY ("assignment_id","student_id")
);

-- CreateTable
CREATE TABLE "group_invitations" (
    "id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "inviter_id" UUID NOT NULL,
    "invitee_id" UUID NOT NULL,
    "status" "invitation_status" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMPTZ NOT NULL,
    "responded_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_member_changes" (
    "id" UUID NOT NULL,
    "assignment_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "action" "member_change" NOT NULL,
    "from_group_id" UUID,
    "to_group_id" UUID,
    "actor_id" UUID,
    "reason" VARCHAR(500),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_member_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "actor_id" UUID,
    "action" VARCHAR(60) NOT NULL,
    "entity_type" VARCHAR(40) NOT NULL,
    "entity_id" VARCHAR(64),
    "summary" VARCHAR(500),
    "old_data" JSONB,
    "new_data" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "topic_histories_topic_id_created_at_idx" ON "topic_histories"("topic_id", "created_at");

-- CreateIndex
CREATE INDEX "group_invitations_invitee_id_status_idx" ON "group_invitations"("invitee_id", "status");

-- CreateIndex
CREATE INDEX "group_invitations_status_expires_at_idx" ON "group_invitations"("status", "expires_at");

-- CreateIndex
CREATE INDEX "group_member_changes_assignment_id_created_at_idx" ON "group_member_changes"("assignment_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_created_at_idx" ON "audit_logs"("entity_type", "entity_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "topic_histories" ADD CONSTRAINT "topic_histories_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topic_histories" ADD CONSTRAINT "topic_histories_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_views" ADD CONSTRAINT "assignment_views_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_views" ADD CONSTRAINT "assignment_views_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_invitations" ADD CONSTRAINT "group_invitations_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_invitations" ADD CONSTRAINT "group_invitations_inviter_id_fkey" FOREIGN KEY ("inviter_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_invitations" ADD CONSTRAINT "group_invitations_invitee_id_fkey" FOREIGN KEY ("invitee_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_member_changes" ADD CONSTRAINT "group_member_changes_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
