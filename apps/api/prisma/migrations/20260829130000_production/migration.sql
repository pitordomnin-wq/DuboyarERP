-- CreateEnum
CREATE TYPE "ProductionJobStatus" AS ENUM ('ACTIVE', 'DONE');

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN "productionJobId" TEXT;

-- CreateTable
CREATE TABLE "ProductionType" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionStage" (
    "id" TEXT NOT NULL,
    "typeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "outputProductId" TEXT,

    CONSTRAINT "ProductionStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionStageInput" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ProductionStageInput_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionJob" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "typeId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "dealId" TEXT,
    "title" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "status" "ProductionJobStatus" NOT NULL DEFAULT 'ACTIVE',
    "position" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductionType_organizationId_name_idx" ON "ProductionType"("organizationId", "name");

-- CreateIndex
CREATE INDEX "ProductionStage_typeId_position_idx" ON "ProductionStage"("typeId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionStageInput_stageId_productId_key" ON "ProductionStageInput"("stageId", "productId");

-- CreateIndex
CREATE INDEX "ProductionJob_organizationId_typeId_status_idx" ON "ProductionJob"("organizationId", "typeId", "status");

-- CreateIndex
CREATE INDEX "ProductionJob_dealId_idx" ON "ProductionJob"("dealId");

-- CreateIndex
CREATE INDEX "StockMovement_productionJobId_idx" ON "StockMovement"("productionJobId");

-- AddForeignKey
ALTER TABLE "ProductionType" ADD CONSTRAINT "ProductionType_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionType" ADD CONSTRAINT "ProductionType_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionStage" ADD CONSTRAINT "ProductionStage_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "ProductionType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionStage" ADD CONSTRAINT "ProductionStage_outputProductId_fkey" FOREIGN KEY ("outputProductId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionStageInput" ADD CONSTRAINT "ProductionStageInput_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "ProductionStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionStageInput" ADD CONSTRAINT "ProductionStageInput_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionJob" ADD CONSTRAINT "ProductionJob_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionJob" ADD CONSTRAINT "ProductionJob_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "ProductionType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionJob" ADD CONSTRAINT "ProductionJob_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "ProductionStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionJob" ADD CONSTRAINT "ProductionJob_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionJob" ADD CONSTRAINT "ProductionJob_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionJob" ADD CONSTRAINT "ProductionJob_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productionJobId_fkey" FOREIGN KEY ("productionJobId") REFERENCES "ProductionJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
