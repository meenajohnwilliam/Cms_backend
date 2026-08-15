-- CreateTable
CREATE TABLE "UserProjectAccess" (
    "accessId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProjectAccess_pkey" PRIMARY KEY ("accessId")
);

-- CreateIndex
CREATE INDEX "UserProjectAccess_userId_idx" ON "UserProjectAccess"("userId");

-- CreateIndex
CREATE INDEX "UserProjectAccess_projectId_idx" ON "UserProjectAccess"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "UserProjectAccess_userId_projectId_key" ON "UserProjectAccess"("userId", "projectId");

-- AddForeignKey
ALTER TABLE "UserProjectAccess" ADD CONSTRAINT "UserProjectAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProjectAccess" ADD CONSTRAINT "UserProjectAccess_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;
