-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "edited" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "replyToId" TEXT;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;
