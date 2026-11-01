-- AlterTable
ALTER TABLE "lecturer_drive_links" ADD COLUMN     "google_email" VARCHAR(255),
ADD COLUMN     "linked_at" TIMESTAMPTZ,
ADD COLUMN     "refresh_token_enc" TEXT;
