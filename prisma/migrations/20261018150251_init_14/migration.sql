-- CreateEnum
CREATE TYPE "TenantOrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED');

-- AlterTable
ALTER TABLE "TenantPayment" ADD COLUMN     "orderId" TEXT,
ADD COLUMN     "paidAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "TenantOrder" (
    "orderId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerRecordId" TEXT,
    "customerSnapshot" JSONB,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "TenantOrderStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantOrder_pkey" PRIMARY KEY ("orderId")
);

-- CreateIndex
CREATE INDEX "TenantOrder_tenantId_status_idx" ON "TenantOrder"("tenantId", "status");

-- CreateIndex
CREATE INDEX "TenantOrder_customerRecordId_idx" ON "TenantOrder"("customerRecordId");

-- AddForeignKey
ALTER TABLE "TenantOrder" ADD CONSTRAINT "TenantOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantOrder" ADD CONSTRAINT "TenantOrder_customerRecordId_fkey" FOREIGN KEY ("customerRecordId") REFERENCES "Record"("recordId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantPayment" ADD CONSTRAINT "TenantPayment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantPayment" ADD CONSTRAINT "TenantPayment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "TenantOrder"("orderId") ON DELETE RESTRICT ON UPDATE CASCADE;
