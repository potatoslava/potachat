-- Add inviteCode to Chat for group/channel invite links
ALTER TABLE "Chat" ADD COLUMN "inviteCode" TEXT;
CREATE UNIQUE INDEX "Chat_inviteCode_key" ON "Chat"("inviteCode");
