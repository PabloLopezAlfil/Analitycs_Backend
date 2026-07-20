-- CreateTable
CREATE TABLE `uploads` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `type` VARCHAR(191) NOT NULL,
    `original_name` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `html_documents` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `upload_id` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `content` LONGTEXT NOT NULL,
    `relative_path` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `images` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `html_id` INTEGER NOT NULL,
    `original_name` VARCHAR(191) NOT NULL,
    `url` TEXT NOT NULL,
    `relative_path` VARCHAR(191) NULL,
    `mime_type` VARCHAR(191) NULL,
    `is_accesible` BOOLEAN NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `html_documents` ADD CONSTRAINT `html_documents_upload_id_fkey` FOREIGN KEY (`upload_id`) REFERENCES `uploads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `images` ADD CONSTRAINT `images_html_id_fkey` FOREIGN KEY (`html_id`) REFERENCES `html_documents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
