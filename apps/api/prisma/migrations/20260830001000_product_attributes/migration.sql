-- CreateTable
CREATE TABLE "ProductAttribute" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductAttribute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductAttributeTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductAttributeTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductAttributeTemplateItem" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductAttributeTemplateItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductAttribute_productId_position_idx" ON "ProductAttribute"("productId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAttributeTemplate_organizationId_name_key" ON "ProductAttributeTemplate"("organizationId", "name");

-- CreateIndex
CREATE INDEX "ProductAttributeTemplate_organizationId_idx" ON "ProductAttributeTemplate"("organizationId");

-- CreateIndex
CREATE INDEX "ProductAttributeTemplateItem_templateId_position_idx" ON "ProductAttributeTemplateItem"("templateId", "position");

-- AddForeignKey
ALTER TABLE "ProductAttribute" ADD CONSTRAINT "ProductAttribute_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAttributeTemplate" ADD CONSTRAINT "ProductAttributeTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAttributeTemplateItem" ADD CONSTRAINT "ProductAttributeTemplateItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ProductAttributeTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
