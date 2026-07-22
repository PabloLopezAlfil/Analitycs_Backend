-- AlterTable
ALTER TABLE `analysis_findings` ADD COLUMN `ai_confidence` VARCHAR(191) NULL,
    ADD COLUMN `ai_problem` TEXT NULL,
    ADD COLUMN `ai_recommendation` TEXT NULL,
    ADD COLUMN `ai_status` VARCHAR(191) NULL;
