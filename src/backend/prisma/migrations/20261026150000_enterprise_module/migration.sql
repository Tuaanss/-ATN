-- CreateTable
CREATE TABLE `view_requests` (
    `id` CHAR(36) NOT NULL,
    `enterprise_id` CHAR(36) NOT NULL,
    `student_id` CHAR(36) NOT NULL,
    `purpose` VARCHAR(500) NOT NULL,
    `requested_days` SMALLINT NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'REVOKED') NOT NULL DEFAULT 'PENDING',
    `granted_days` SMALLINT NULL,
    `approved_at` DATETIME(3) NULL,
    `expires_at` DATETIME(3) NULL,
    `admin_note` VARCHAR(500) NULL,
    `decided_by` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `view_requests_enterprise_id_status_idx`(`enterprise_id`, `status`),
    INDEX `view_requests_student_id_status_idx`(`student_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `enterprise_views` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `enterprise_id` CHAR(36) NOT NULL,
    `student_id` CHAR(36) NOT NULL,
    `kind` VARCHAR(20) NOT NULL,
    `submission_id` CHAR(36) NULL,
    `label` VARCHAR(300) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `enterprise_views_student_id_created_at_idx`(`student_id`, `created_at`),
    INDEX `enterprise_views_enterprise_id_created_at_idx`(`enterprise_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `enterprise_searches` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `enterprise_id` CHAR(36) NOT NULL,
    `criteria` JSON NOT NULL,
    `summary` VARCHAR(300) NOT NULL,
    `results` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `enterprise_searches_enterprise_id_created_at_idx`(`enterprise_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `enterprise_interests` (
    `enterprise_id` CHAR(36) NOT NULL,
    `student_id` CHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`enterprise_id`, `student_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `view_requests` ADD CONSTRAINT `view_requests_enterprise_id_fkey` FOREIGN KEY (`enterprise_id`) REFERENCES `enterprises`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `view_requests` ADD CONSTRAINT `view_requests_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `enterprise_views` ADD CONSTRAINT `enterprise_views_enterprise_id_fkey` FOREIGN KEY (`enterprise_id`) REFERENCES `enterprises`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `enterprise_views` ADD CONSTRAINT `enterprise_views_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `enterprise_searches` ADD CONSTRAINT `enterprise_searches_enterprise_id_fkey` FOREIGN KEY (`enterprise_id`) REFERENCES `enterprises`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `enterprise_interests` ADD CONSTRAINT `enterprise_interests_enterprise_id_fkey` FOREIGN KEY (`enterprise_id`) REFERENCES `enterprises`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `enterprise_interests` ADD CONSTRAINT `enterprise_interests_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

