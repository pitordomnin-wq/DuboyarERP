-- WarehouseCategory
CREATE TABLE "WarehouseCategory" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarehouseCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WarehouseCategory_organizationId_name_key" ON "WarehouseCategory"("organizationId", "name");
CREATE INDEX "WarehouseCategory_organizationId_position_idx" ON "WarehouseCategory"("organizationId", "position");

ALTER TABLE "WarehouseCategory" ADD CONSTRAINT "WarehouseCategory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ProductGroup
CREATE TABLE "ProductGroup" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductGroup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductGroup_organizationId_name_key" ON "ProductGroup"("organizationId", "name");
CREATE INDEX "ProductGroup_organizationId_name_idx" ON "ProductGroup"("organizationId", "name");

ALTER TABLE "ProductGroup" ADD CONSTRAINT "ProductGroup_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed default categories per org from ProductKind labels
INSERT INTO "WarehouseCategory" ("id", "organizationId", "name", "position", "createdAt", "updatedAt")
SELECT
  'c' || substr(md5(o.id || k.kind), 1, 24),
  o.id,
  k.name,
  k.pos,
  NOW(),
  NOW()
FROM "Organization" o
CROSS JOIN (
  VALUES
    ('CONSUMABLE', 'Расходники', 0),
    ('MATERIAL', 'Сырьё', 1),
    ('SEMI_FINISHED', 'Заготовки', 2),
    ('FINISHED', 'Готовая продукция', 3)
) AS k(kind, name, pos);

-- Product.categoryId + groupId
ALTER TABLE "Product" ADD COLUMN "categoryId" TEXT;
ALTER TABLE "Product" ADD COLUMN "groupId" TEXT;

UPDATE "Product" p
SET "categoryId" = c.id
FROM "WarehouseCategory" c
WHERE c."organizationId" = p."organizationId"
  AND c."name" = CASE p.kind
    WHEN 'CONSUMABLE' THEN 'Расходники'
    WHEN 'MATERIAL' THEN 'Сырьё'
    WHEN 'SEMI_FINISHED' THEN 'Заготовки'
    WHEN 'FINISHED' THEN 'Готовая продукция'
  END;

-- Fallback for any orphan products
UPDATE "Product" p
SET "categoryId" = (
  SELECT c.id FROM "WarehouseCategory" c
  WHERE c."organizationId" = p."organizationId"
  ORDER BY c."position" ASC
  LIMIT 1
)
WHERE p."categoryId" IS NULL;

ALTER TABLE "Product" ALTER COLUMN "categoryId" SET NOT NULL;

CREATE INDEX "Product_organizationId_categoryId_idx" ON "Product"("organizationId", "categoryId");
CREATE INDEX "Product_organizationId_groupId_idx" ON "Product"("organizationId", "groupId");

ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "WarehouseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ProductGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ProductionStage.lossPercent
ALTER TABLE "ProductionStage" ADD COLUMN "lossPercent" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- ProductionStageInput: nullable productId + productGroupId
ALTER TABLE "ProductionStageInput" DROP CONSTRAINT IF EXISTS "ProductionStageInput_stageId_productId_key";
ALTER TABLE "ProductionStageInput" ALTER COLUMN "productId" DROP NOT NULL;
ALTER TABLE "ProductionStageInput" ADD COLUMN "productGroupId" TEXT;

CREATE INDEX "ProductionStageInput_stageId_idx" ON "ProductionStageInput"("stageId");
CREATE INDEX "ProductionStageInput_productId_idx" ON "ProductionStageInput"("productId");
CREATE INDEX "ProductionStageInput_productGroupId_idx" ON "ProductionStageInput"("productGroupId");

ALTER TABLE "ProductionStageInput" ADD CONSTRAINT "ProductionStageInput_productGroupId_fkey" FOREIGN KEY ("productGroupId") REFERENCES "ProductGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- StockLot
CREATE TABLE "StockLot" (
    "id" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceMovementId" TEXT,

    CONSTRAINT "StockLot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StockLot_warehouseId_productId_receivedAt_idx" ON "StockLot"("warehouseId", "productId", "receivedAt");
CREATE INDEX "StockLot_sourceMovementId_idx" ON "StockLot"("sourceMovementId");

ALTER TABLE "StockLot" ADD CONSTRAINT "StockLot_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockLot" ADD CONSTRAINT "StockLot_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockLot" ADD CONSTRAINT "StockLot_sourceMovementId_fkey" FOREIGN KEY ("sourceMovementId") REFERENCES "StockMovement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- StockMovementAllocation
CREATE TABLE "StockMovementAllocation" (
    "id" TEXT NOT NULL,
    "movementId" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "StockMovementAllocation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StockMovementAllocation_movementId_idx" ON "StockMovementAllocation"("movementId");
CREATE INDEX "StockMovementAllocation_lotId_idx" ON "StockMovementAllocation"("lotId");

ALTER TABLE "StockMovementAllocation" ADD CONSTRAINT "StockMovementAllocation_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "StockMovement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockMovementAllocation" ADD CONSTRAINT "StockMovementAllocation_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "StockLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill lots from current balances (one lot per product+warehouse with positive balance)
INSERT INTO "StockLot" ("id", "warehouseId", "productId", "quantity", "receivedAt", "sourceMovementId")
SELECT
  'c' || substr(md5(b."warehouseId" || b."productId" || 'lot'), 1, 24),
  b."warehouseId",
  b."productId",
  b.qty,
  COALESCE(b.first_receipt, NOW()),
  NULL
FROM (
  SELECT
    m."warehouseId",
    m."productId",
    ROUND((
      SUM(CASE WHEN m.type = 'RECEIPT' THEN m.quantity ELSE 0 END)
      - SUM(CASE WHEN m.type = 'WRITEOFF' THEN m.quantity ELSE 0 END)
    )::numeric, 3)::double precision AS qty,
    MIN(CASE WHEN m.type = 'RECEIPT' THEN m."createdAt" END) AS first_receipt
  FROM "StockMovement" m
  GROUP BY m."warehouseId", m."productId"
) b
WHERE b.qty > 0;
