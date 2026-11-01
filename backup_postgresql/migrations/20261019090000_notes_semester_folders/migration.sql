-- AlterTable
ALTER TABLE "course_sections" ADD COLUMN     "drive_folder_id" VARCHAR(100);

-- CreateTable
CREATE TABLE "lecturer_notes" (
    "submission_id" UUID NOT NULL,
    "lecturer_id" UUID NOT NULL,
    "content" VARCHAR(2000) NOT NULL DEFAULT '',
    "is_sample" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "lecturer_notes_pkey" PRIMARY KEY ("submission_id","lecturer_id")
);

-- CreateTable
CREATE TABLE "lecturer_semester_folders" (
    "lecturer_id" UUID NOT NULL,
    "semester_id" UUID NOT NULL,
    "root_folder_id" VARCHAR(100) NOT NULL,
    "folder_id" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lecturer_semester_folders_pkey" PRIMARY KEY ("lecturer_id","semester_id")
);

-- CreateIndex
CREATE INDEX "lecturer_notes_lecturer_id_is_sample_idx" ON "lecturer_notes"("lecturer_id", "is_sample");

-- AddForeignKey
ALTER TABLE "lecturer_notes" ADD CONSTRAINT "lecturer_notes_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lecturer_notes" ADD CONSTRAINT "lecturer_notes_lecturer_id_fkey" FOREIGN KEY ("lecturer_id") REFERENCES "lecturers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lecturer_semester_folders" ADD CONSTRAINT "lecturer_semester_folders_lecturer_id_fkey" FOREIGN KEY ("lecturer_id") REFERENCES "lecturers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lecturer_semester_folders" ADD CONSTRAINT "lecturer_semester_folders_semester_id_fkey" FOREIGN KEY ("semester_id") REFERENCES "semesters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

