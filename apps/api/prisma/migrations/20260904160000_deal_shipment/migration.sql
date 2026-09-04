-- AlterEnum
ALTER TYPE "DealItemProductionStatus" ADD VALUE 'SHIPPED';

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN "dealId" TEXT;

-- CreateIndex
CREATE INDEX "StockMovement_dealId_idx" ON "StockMovement"("dealId");

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
