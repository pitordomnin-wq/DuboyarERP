-- CreateTable
CREATE TABLE "Counterparty" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "inn" TEXT NOT NULL,
    "kpp" TEXT,
    "ogrn" TEXT,
    "legalAddress" TEXT NOT NULL,
    "actualAddress" TEXT,
    "bankName" TEXT,
    "bik" TEXT,
    "checkingAccount" TEXT,
    "correspondentAccount" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "telegram" TEXT,
    "contactName" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Counterparty_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Counterparty_organizationId_name_idx" ON "Counterparty"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Counterparty_organizationId_inn_key" ON "Counterparty"("organizationId", "inn");

-- AddForeignKey
ALTER TABLE "Counterparty" ADD CONSTRAINT "Counterparty_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
