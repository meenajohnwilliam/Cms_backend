-- CreateTable
CREATE TABLE "Usage" (
    "usageId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "storageUsedMB" INTEGER NOT NULL DEFAULT 0,
    "getRequestsUsed" INTEGER NOT NULL DEFAULT 0,
    "writeRequestsUsed" INTEGER NOT NULL DEFAULT 0,
    "apiKeysUsed" INTEGER NOT NULL DEFAULT 0,
    "projectsUsed" INTEGER NOT NULL DEFAULT 0,
    "collectionsUsed" INTEGER NOT NULL DEFAULT 0,
    "teamMembersUsed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usage_pkey" PRIMARY KEY ("usageId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usage_tenantId_key" ON "Usage"("tenantId");

-- AddForeignKey
ALTER TABLE "Usage" ADD CONSTRAINT "Usage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("tenantId") ON DELETE CASCADE ON UPDATE CASCADE;
