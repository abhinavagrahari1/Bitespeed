-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "phonenumber" TEXT NOT NULL,
    "linkedId" INTEGER NOT NULL,
    "linkedPrecedence" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phonenumber_key" ON "User"("phonenumber");
