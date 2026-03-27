-- CreateTable
CREATE TABLE "AvatarHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "avatar" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AvatarHistory_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AvatarHistory" ADD CONSTRAINT "AvatarHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
