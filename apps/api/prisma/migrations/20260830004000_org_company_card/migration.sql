ALTER TABLE "Organization" ADD COLUMN "legalName" TEXT;
ALTER TABLE "Organization" ADD COLUMN "brandAddress" TEXT;
ALTER TABLE "Organization" ADD COLUMN "phone" TEXT;
ALTER TABLE "Organization" ADD COLUMN "email" TEXT;
ALTER TABLE "Organization" ADD COLUMN "logoKey" TEXT;
ALTER TABLE "Organization" ADD COLUMN "logoMime" TEXT;

UPDATE "Organization" SET "legalName" = "name" WHERE "legalName" IS NULL;
UPDATE "Organization" SET "brandAddress" = "legalAddress" WHERE "brandAddress" IS NULL AND "legalAddress" IS NOT NULL;
