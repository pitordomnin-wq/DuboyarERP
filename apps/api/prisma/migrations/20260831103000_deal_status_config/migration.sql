-- CreateTable
CREATE TABLE "DealStatusConfig" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" "DealStatus" NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "DealStatusConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DealStatusConfig_organizationId_status_key" ON "DealStatusConfig"("organizationId", "status");

-- CreateIndex
CREATE INDEX "DealStatusConfig_organizationId_position_idx" ON "DealStatusConfig"("organizationId", "position");

-- AddForeignKey
ALTER TABLE "DealStatusConfig" ADD CONSTRAINT "DealStatusConfig_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
