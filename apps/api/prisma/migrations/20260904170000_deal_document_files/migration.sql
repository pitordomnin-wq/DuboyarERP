-- AlterTable
ALTER TABLE "DealDocument" ALTER COLUMN "html" DROP NOT NULL;
ALTER TABLE "DealDocument" ADD COLUMN "storageKey" TEXT;
ALTER TABLE "DealDocument" ADD COLUMN "mimeType" TEXT;
ALTER TABLE "DealDocument" ADD COLUMN "size" INTEGER;
