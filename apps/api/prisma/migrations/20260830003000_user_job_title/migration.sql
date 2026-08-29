-- AlterTable
ALTER TABLE "User" ADD COLUMN "jobTitle" TEXT;

UPDATE "User" SET "jobTitle" = 'Генеральный директор' WHERE "email" = 'owner@faverum.local';
UPDATE "User" SET "jobTitle" = 'Менеджер по продажам' WHERE "email" = 'manager@faverum.local';
