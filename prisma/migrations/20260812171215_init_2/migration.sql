/*
  Warnings:

  - You are about to drop the column `razorpaySignature` on the `Payment` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Payment" DROP COLUMN "razorpaySignature",
ADD COLUMN     "razorpaySubscriptionId" TEXT;
