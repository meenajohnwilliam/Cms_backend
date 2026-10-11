/*
  Warnings:

  - Made the column `webhookSecret` on table `TenantPaymentGateway` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "TenantPaymentGateway" ALTER COLUMN "webhookSecret" SET NOT NULL;
