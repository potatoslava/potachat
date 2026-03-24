-- AlterTable
ALTER TABLE "User" ADD COLUMN     "banned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "bannedIp" TEXT,
ADD COLUMN     "frozen" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);
