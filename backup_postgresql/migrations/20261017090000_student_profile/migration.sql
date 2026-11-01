-- CreateEnum
CREATE TYPE "parent_relation" AS ENUM ('FATHER', 'MOTHER', 'GUARDIAN');

-- AlterTable
ALTER TABLE "students" ADD COLUMN     "avatar_path" TEXT,
ADD COLUMN     "behance_url" VARCHAR(255),
ADD COLUMN     "bio" VARCHAR(1000),
ADD COLUMN     "discoverable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "father_phone" VARCHAR(10),
ADD COLUMN     "github_url" VARCHAR(255),
ADD COLUMN     "guardian_phone" VARCHAR(10),
ADD COLUMN     "linkedin_url" VARCHAR(255),
ADD COLUMN     "mother_phone" VARCHAR(10),
ADD COLUMN     "no_parent_reason" VARCHAR(255),
ADD COLUMN     "skills" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "parents" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "phone" VARCHAR(10) NOT NULL,
    "full_name" VARCHAR(100),
    "email" VARCHAR(255),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "parents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parent_students" (
    "parent_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "relation" "parent_relation" NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parent_students_pkey" PRIMARY KEY ("parent_id","student_id","relation")
);

-- CreateIndex
CREATE UNIQUE INDEX "parents_user_id_key" ON "parents"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "parents_phone_key" ON "parents"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "parent_students_student_id_relation_key" ON "parent_students"("student_id", "relation");

-- AddForeignKey
ALTER TABLE "parents" ADD CONSTRAINT "parents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_students" ADD CONSTRAINT "parent_students_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "parents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_students" ADD CONSTRAINT "parent_students_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

