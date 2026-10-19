/*
  Warnings:

  - You are about to drop the column `lastVerifiedAt` on the `TenantPaymentGateway` table. All the data in the column will be lost.
  - You are about to drop the column `webhookVerificationOrderId` on the `TenantPaymentGateway` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[testPaymentId]` on the table `TenantPaymentGateway` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "TenantPaymentGateway" DROP COLUMN "lastVerifiedAt",
DROP COLUMN "webhookVerificationOrderId",
ADD COLUMN     "lastTestPaymentVerifiedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "TenantPaymentGateway_testPaymentId_key" ON "TenantPaymentGateway"("testPaymentId");
