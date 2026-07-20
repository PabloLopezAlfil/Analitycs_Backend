-- CreateTable
CREATE TABLE `analyses` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `html_id` INTEGER NOT NULL,
    `score` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `analysis_checks` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `analysis_id` INTEGER NOT NULL,
    `rule` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `message` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `analysis_findings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `check_id` INTEGER NOT NULL,
    `location` VARCHAR(191) NOT NULL,
    `evidence` TEXT NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `analyses` ADD CONSTRAINT `analyses_html_id_fkey` FOREIGN KEY (`html_id`) REFERENCES `html_documents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `analysis_checks` ADD CONSTRAINT `analysis_checks_analysis_id_fkey` FOREIGN KEY (`analysis_id`) REFERENCES `analyses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `analysis_findings` ADD CONSTRAINT `analysis_findings_check_id_fkey` FOREIGN KEY (`check_id`) REFERENCES `analysis_checks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
