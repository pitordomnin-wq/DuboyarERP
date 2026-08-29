-- CreateTable
CREATE TABLE "MailAttachment" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MailAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MailAttachment_messageId_idx" ON "MailAttachment"("messageId");

-- CreateIndex
CREATE INDEX "MailAttachment_storageKey_idx" ON "MailAttachment"("storageKey");

-- AddForeignKey
ALTER TABLE "MailAttachment" ADD CONSTRAINT "MailAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "MailMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
