/*
  Warnings:

  - You are about to drop the `RazorpayWebhookEvent` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TenantOrder` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TenantPayment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TenantPaymentGateway` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "CustomerOrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED');

-- DropForeignKey
ALTER TABLE "TenantOrder" DROP CONSTRAINT "TenantOrder_customerRecordId_fkey";

-- DropForeignKey
ALTER TABLE "TenantOrder" DROP CONSTRAINT "TenantOrder_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "TenantPayment" DROP CONSTRAINT "TenantPayment_orderId_fkey";

-- DropForeignKey
ALTER TABLE "TenantPayment" DROP CONSTRAINT "TenantPayment_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "TenantPaymentGateway" DROP CONSTRAINT "TenantPaymentGateway_tenantId_fkey";

-- DropTable
DROP TABLE "RazorpayWebhookEvent";

-- DropTable
DROP TABLE "TenantOrder";

-- DropTable
DROP TABLE "TenantPayment";

-- DropTable
DROP TABLE "TenantPaymentGateway";

-- DropEnum
DROP TYPE "TenantOrderStatus";

-- CreateTable
CREATE TABLE "ProjectPaymentGateway" (
    "gatewayId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'RAZORPAY',
    "keyId" TEXT NOT NULL,
    "keySecret" TEXT NOT NULL,
    "webhookUrl" TEXT,
    "webhookSecret" TEXT NOT NULL,
    "websiteUrl" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "connectionStatus" "GatewayConnectionStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "testPaymentOrderId" TEXT,
    "testPaymentId" TEXT,
    "testPaymentAt" TIMESTAMP(3),
    "webhookVerifiedAt" TIMESTAMP(3),
    "lastTestPaymentVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectPaymentGateway_pkey" PRIMARY KEY ("gatewayId")
);

-- CreateTable
CREATE TABLE "CustomerOrder" (
    "orderId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "customerSnapshot" JSONB,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "CustomerOrderStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerOrder_pkey" PRIMARY KEY ("orderId")
);

-- CreateTable
CREATE TABLE "CustomerPayment" (
    "paymentId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "orderId" TEXT,
    "razorpayOrderId" TEXT NOT NULL,
    "razorpayPaymentId" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "CustomerPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerPayment_pkey" PRIMARY KEY ("paymentId")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectPaymentGateway_projectId_key" ON "ProjectPaymentGateway"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectPaymentGateway_testPaymentOrderId_key" ON "ProjectPaymentGateway"("testPaymentOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectPaymentGateway_testPaymentId_key" ON "ProjectPaymentGateway"("testPaymentId");

-- CreateIndex
CREATE INDEX "ProjectPaymentGateway_connectionStatus_idx" ON "ProjectPaymentGateway"("connectionStatus");

-- CreateIndex
CREATE INDEX "CustomerOrder_tenantId_status_idx" ON "CustomerOrder"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerPayment_razorpayOrderId_key" ON "CustomerPayment"("razorpayOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerPayment_razorpayPaymentId_key" ON "CustomerPayment"("razorpayPaymentId");

-- CreateIndex
CREATE INDEX "CustomerPayment_tenantId_status_idx" ON "CustomerPayment"("tenantId", "status");

-- CreateIndex
CREATE INDEX "CustomerPayment_projectId_status_idx" ON "CustomerPayment"("projectId", "status");

-- AddForeignKey
ALTER TABLE "ProjectPaymentGateway" ADD CONSTRAINT "ProjectPaymentGateway_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerOrder" ADD CONSTRAINT "CustomerOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerOrder" ADD CONSTRAINT "CustomerOrder_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("projectId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPayment" ADD CONSTRAINT "CustomerPayment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPayment" ADD CONSTRAINT "CustomerPayment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("projectId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPayment" ADD CONSTRAINT "CustomerPayment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "CustomerOrder"("orderId") ON DELETE RESTRICT ON UPDATE CASCADE;
