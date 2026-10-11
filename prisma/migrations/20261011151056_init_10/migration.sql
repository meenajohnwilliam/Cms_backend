/*
  Warnings:

  - You are about to drop the column `isConnected` on the `TenantPaymentGateway` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[testPaymentOrderId]` on the table `TenantPaymentGateway` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "GatewayConnectionStatus" AS ENUM ('DISCONNECTED', 'CREDENTIALS_VERIFIED', 'WEBHOOK_PENDING', 'WEBHOOK_VERIFIED', 'TEST_PAYMENT_PENDING', 'CONNECTED', 'ERROR');

-- CreateEnum
CREATE TYPE "CustomerPaymentStatus" AS ENUM ('PENDING', 'CAPTURED', 'FAILED');

-- DropIndex
DROP INDEX "TenantPaymentGateway_isConnected_idx";

-- DropIndex
DROP INDEX "TenantPaymentGateway_provider_idx";

-- AlterTable
ALTER TABLE "TenantPaymentGateway" DROP COLUMN "isConnected",
ADD COLUMN     "connectionStatus" "GatewayConnectionStatus" NOT NULL DEFAULT 'DISCONNECTED',
ADD COLUMN     "isVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "testPaymentOrderId" TEXT,
ADD COLUMN     "webhookSecret" TEXT,
ADD COLUMN     "webhookVerifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "TenantPayment" (
    "paymentId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "razorpayOrderId" TEXT NOT NULL,
    "razorpayPaymentId" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "CustomerPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantPayment_pkey" PRIMARY KEY ("paymentId")
);

-- CreateTable
CREATE TABLE "RazorpayWebhookEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RazorpayWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TenantPayment_razorpayOrderId_key" ON "TenantPayment"("razorpayOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantPayment_razorpayPaymentId_key" ON "TenantPayment"("razorpayPaymentId");

-- CreateIndex
CREATE INDEX "TenantPayment_tenantId_status_idx" ON "TenantPayment"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RazorpayWebhookEvent_eventId_key" ON "RazorpayWebhookEvent"("eventId");

-- CreateIndex
CREATE INDEX "RazorpayWebhookEvent_tenantId_createdAt_idx" ON "RazorpayWebhookEvent"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TenantPaymentGateway_testPaymentOrderId_key" ON "TenantPaymentGateway"("testPaymentOrderId");

-- CreateIndex
CREATE INDEX "TenantPaymentGateway_connectionStatus_idx" ON "TenantPaymentGateway"("connectionStatus");
