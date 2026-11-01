-- AlterTable
ALTER TABLE "course_sections" ADD COLUMN     "sessions" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "week_end" SMALLINT NOT NULL DEFAULT 15,
ADD COLUMN     "week_start" SMALLINT NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "faculty_id" UUID;

-- AlterTable
ALTER TABLE "lecturers" ADD COLUMN     "faculty_id" UUID;

-- AlterTable
ALTER TABLE "students" ADD COLUMN     "admin_class_id" UUID;

-- CreateTable
CREATE TABLE "faculties" (
    "id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "faculties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "majors" (
    "id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "faculty_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "majors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cohorts" (
    "id" UUID NOT NULL,
    "name" VARCHAR(10) NOT NULL,
    "start_year" SMALLINT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cohorts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_classes" (
    "id" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "major_id" UUID NOT NULL,
    "cohort_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enterprises" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "tax_code" VARCHAR(20) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "contact_name" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(15) NOT NULL,
    "field" VARCHAR(100) NOT NULL,
    "website" VARCHAR(255),
    "reject_reason" VARCHAR(500),
    "approved_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "enterprises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_configs" (
    "key" VARCHAR(40) NOT NULL,
    "value" JSONB NOT NULL,
    "updated_by" UUID,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "system_configs_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "faculties_code_key" ON "faculties"("code");

-- CreateIndex
CREATE UNIQUE INDEX "faculties_name_key" ON "faculties"("name");

-- CreateIndex
CREATE UNIQUE INDEX "majors_code_key" ON "majors"("code");

-- CreateIndex
CREATE UNIQUE INDEX "cohorts_name_key" ON "cohorts"("name");

-- CreateIndex
CREATE UNIQUE INDEX "admin_classes_code_key" ON "admin_classes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "enterprises_user_id_key" ON "enterprises"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "enterprises_tax_code_key" ON "enterprises"("tax_code");

-- CreateIndex
CREATE UNIQUE INDEX "enterprises_email_key" ON "enterprises"("email");

-- AddForeignKey
ALTER TABLE "lecturers" ADD CONSTRAINT "lecturers_faculty_id_fkey" FOREIGN KEY ("faculty_id") REFERENCES "faculties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_admin_class_id_fkey" FOREIGN KEY ("admin_class_id") REFERENCES "admin_classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "majors" ADD CONSTRAINT "majors_faculty_id_fkey" FOREIGN KEY ("faculty_id") REFERENCES "faculties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_classes" ADD CONSTRAINT "admin_classes_major_id_fkey" FOREIGN KEY ("major_id") REFERENCES "majors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_classes" ADD CONSTRAINT "admin_classes_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enterprises" ADD CONSTRAINT "enterprises_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_faculty_id_fkey" FOREIGN KEY ("faculty_id") REFERENCES "faculties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

