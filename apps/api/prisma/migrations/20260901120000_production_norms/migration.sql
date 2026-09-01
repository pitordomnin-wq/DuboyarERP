-- CreateEnum
CREATE TYPE "ProductionReleaseType" AS ENUM ('DECK', 'HERRINGBONE');

-- CreateEnum
CREATE TYPE "StageInputMode" AS ENUM ('PRODUCT', 'GROUP', 'LKP_RECIPE', 'KEYWORD');

-- CreateEnum
CREATE TYPE "LkpMaterialCategory" AS ENUM ('PRIMER', 'LACQUER_OIL', 'PASTE', 'DYE', 'PIGMENT');

-- CreateEnum
CREATE TYPE "StageQuantityBasis" AS ENUM ('M2', 'PIECE', 'PACKAGE', 'M2_ORIGINAL');

-- CreateEnum
CREATE TYPE "LayoutMaterialRole" AS ENUM ('VENEER_OAK', 'VENEER_DECK', 'VENEER_HERRINGBONE', 'BOX_DECK', 'BOX_HERRINGBONE', 'PACK_UNIVERSAL');

-- AlterTable
ALTER TABLE "ProductGroup" ADD COLUMN "keywords" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "ProductionType" ADD COLUMN "defaultReleaseType" "ProductionReleaseType",
ADD COLUMN "piecesPerM2" DOUBLE PRECISION NOT NULL DEFAULT 4.972186492063492,
ADD COLUMN "m2PerPackageDeck" DOUBLE PRECISION NOT NULL DEFAULT 0.8287063893262616,
ADD COLUMN "m2PerPackageHerringbone" DOUBLE PRECISION NOT NULL DEFAULT 0.9920634920634921;

-- AlterTable
ALTER TABLE "ProductionStageInput" ADD COLUMN "inputMode" "StageInputMode" NOT NULL DEFAULT 'PRODUCT',
ADD COLUMN "quantityBasis" "StageQuantityBasis" NOT NULL DEFAULT 'M2',
ADD COLUMN "lkpCategory" "LkpMaterialCategory",
ADD COLUMN "keyword" TEXT,
ADD COLUMN "layoutRole" "LayoutMaterialRole";

-- AlterTable
ALTER TABLE "ProductionJob" ADD COLUMN "quantityM2" DOUBLE PRECISION,
ADD COLUMN "releaseType" "ProductionReleaseType" NOT NULL DEFAULT 'DECK',
ADD COLUMN "pieceCount" DOUBLE PRECISION,
ADD COLUMN "packageCount" DOUBLE PRECISION;

UPDATE "ProductionJob" SET "quantityM2" = "quantity" WHERE "quantityM2" IS NULL;
ALTER TABLE "ProductionJob" ALTER COLUMN "quantityM2" SET NOT NULL;

-- CreateTable
CREATE TABLE "LkpNorm" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "category" "LkpMaterialCategory" NOT NULL,
    "normPerM2Kg" DOUBLE PRECISION NOT NULL,
    "keywords" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LkpNorm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCoatingRecipeLine" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "category" "LkpMaterialCategory" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "normPerM2Kg" DOUBLE PRECISION,

    CONSTRAINT "ProductCoatingRecipeLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LkpNorm_organizationId_idx" ON "LkpNorm"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "LkpNorm_organizationId_category_key" ON "LkpNorm"("organizationId", "category");

-- CreateIndex
CREATE INDEX "ProductCoatingRecipeLine_productId_idx" ON "ProductCoatingRecipeLine"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCoatingRecipeLine_productId_category_key" ON "ProductCoatingRecipeLine"("productId", "category");

-- AddForeignKey
ALTER TABLE "LkpNorm" ADD CONSTRAINT "LkpNorm_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCoatingRecipeLine" ADD CONSTRAINT "ProductCoatingRecipeLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
