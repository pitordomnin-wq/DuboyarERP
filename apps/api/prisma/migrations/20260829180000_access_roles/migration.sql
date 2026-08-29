-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pages" TEXT[] NOT NULL,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_organizationId_name_key" ON "Role"("organizationId", "name");

-- CreateIndex
CREATE INDEX "Role_organizationId_idx" ON "Role"("organizationId");

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "roleId" TEXT;

-- Default roles per organization
INSERT INTO "Role" ("id", "organizationId", "name", "pages", "locked", "createdAt", "updatedAt")
SELECT
    'role_admin_' || "id",
    "id",
    'Администратор',
    ARRAY['tasks','mail','sales','warehouse','production','products','purchases','counterparties','admin']::TEXT[],
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Organization";

INSERT INTO "Role" ("id", "organizationId", "name", "pages", "locked", "createdAt", "updatedAt")
SELECT
    'role_member_' || "id",
    "id",
    'Сотрудник',
    ARRAY['tasks','mail','sales','warehouse','production','products','purchases','counterparties']::TEXT[],
    false,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Organization";

UPDATE "User" SET "roleId" = 'role_admin_' || "organizationId" WHERE "role" = 'ADMIN';
UPDATE "User" SET "roleId" = 'role_member_' || "organizationId" WHERE "role" <> 'ADMIN';

ALTER TABLE "User" ALTER COLUMN "roleId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "User_roleId_idx" ON "User"("roleId");
