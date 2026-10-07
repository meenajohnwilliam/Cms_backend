-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "TenantPaymentGateway" (
    "gatewayId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'RAZORPAY',
    "keyId" TEXT NOT NULL,
    "keySecret" TEXT NOT NULL,
    "websiteUrl" TEXT,
    "isConnected" BOOLEAN NOT NULL DEFAULT false,
    "lastVerifiedAt" TIMESTAMP(3),
    "testPaymentId" TEXT,
    "testPaymentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "TenantPaymentGateway_pkey" PRIMARY KEY ("gatewayId")
);

-- CreateIndex
CREATE UNIQUE INDEX "TenantPaymentGateway_tenantId_key" ON "TenantPaymentGateway"("tenantId");

-- CreateIndex
CREATE INDEX "TenantPaymentGateway_provider_idx" ON "TenantPaymentGateway"("provider");

-- CreateIndex
CREATE INDEX "TenantPaymentGateway_isConnected_idx" ON "TenantPaymentGateway"("isConnected");

-- AddForeignKey
ALTER TABLE "TenantPaymentGateway" ADD CONSTRAINT "TenantPaymentGateway_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("tenantId") ON DELETE CASCADE ON UPDATE CASCADE;
