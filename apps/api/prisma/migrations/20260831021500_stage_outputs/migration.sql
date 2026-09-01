CREATE TABLE "ProductionStageOutput" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ProductionStageOutput_pkey" PRIMARY KEY ("id")
);

INSERT INTO "ProductionStageOutput" ("id", "stageId", "productId", "quantity")
SELECT ('cso' || substr(md5(random()::text || s."id"), 1, 22)), s."id", s."outputProductId", 1
FROM "ProductionStage" s
WHERE s."outputProductId" IS NOT NULL;

CREATE UNIQUE INDEX "ProductionStageOutput_stageId_productId_key" ON "ProductionStageOutput"("stageId", "productId");

ALTER TABLE "ProductionStageOutput" ADD CONSTRAINT "ProductionStageOutput_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "ProductionStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductionStageOutput" ADD CONSTRAINT "ProductionStageOutput_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductionStage" DROP CONSTRAINT "ProductionStage_outputProductId_fkey";

ALTER TABLE "ProductionStage" DROP COLUMN "outputProductId";
