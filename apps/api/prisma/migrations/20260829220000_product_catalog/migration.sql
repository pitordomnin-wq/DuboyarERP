ALTER TABLE "Product" ADD COLUMN "inCatalog" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Product" SET "inCatalog" = true WHERE "kind" = 'FINISHED';

CREATE INDEX "Product_organizationId_inCatalog_idx" ON "Product"("organizationId", "inCatalog");
