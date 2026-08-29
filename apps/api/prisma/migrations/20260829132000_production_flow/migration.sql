-- CreateEnum
CREATE TYPE "ProductionStageStatus" AS ENUM ('TO_START', 'IN_PROGRESS');

-- CreateEnum
CREATE TYPE "DealItemProductionStatus" AS ENUM ('NONE', 'IN_PRODUCTION', 'IN_WAREHOUSE');

-- AlterTable
ALTER TABLE "ProductionType" ADD COLUMN "productId" TEXT;

UPDATE "ProductionType" AS t
SET "productId" = p.id
FROM "Product" AS p
WHERE p."organizationId" = t."organizationId"
  AND p.sku = 'PAN-600-GR'
  AND t."productId" IS NULL;

ALTER TABLE "ProductionType" ALTER COLUMN "productId" SET NOT NULL;

-- AlterTable
ALTER TABLE "ProductionJob" ADD COLUMN "dealItemId" TEXT;
ALTER TABLE "ProductionJob" ADD COLUMN "stageStatus" "ProductionStageStatus" NOT NULL DEFAULT 'TO_START';

-- AlterTable
ALTER TABLE "DealItem" ADD COLUMN "productionStatus" "DealItemProductionStatus" NOT NULL DEFAULT 'NONE';

-- CreateIndex
CREATE UNIQUE INDEX "ProductionType_organizationId_productId_key" ON "ProductionType"("organizationId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionJob_dealItemId_key" ON "ProductionJob"("dealItemId");

-- AddForeignKey
ALTER TABLE "ProductionType" ADD CONSTRAINT "ProductionType_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionJob" ADD CONSTRAINT "ProductionJob_dealItemId_fkey" FOREIGN KEY ("dealItemId") REFERENCES "DealItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
