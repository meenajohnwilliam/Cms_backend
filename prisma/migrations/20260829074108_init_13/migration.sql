/*
  Warnings:

  - You are about to drop the column `monthlyPrice` on the `Plan` table. All the data in the column will be lost.
  - You are about to drop the column `razorpayMonthlyPlanId` on the `Plan` table. All the data in the column will be lost.
  - You are about to drop the column `razorpaySubscriptionId` on the `Plan` table. All the data in the column will be lost.
  - You are about to drop the column `razorpayYearlyPlanId` on the `Plan` table. All the data in the column will be lost.
  - You are about to drop the column `yearlyPrice` on the `Plan` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[razorpayPlanId]` on the table `Plan` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `billingCycle` to the `Plan` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('FREE', 'PAID');

-- AlterEnum
ALTER TYPE "BillingCycle" ADD VALUE 'NONE';

-- DropIndex
DROP INDEX "Plan_razorpayMonthlyPlanId_key";

-- DropIndex
DROP INDEX "Plan_razorpayYearlyPlanId_key";

-- AlterTable
ALTER TABLE "Plan" DROP COLUMN "monthlyPrice",
DROP COLUMN "razorpayMonthlyPlanId",
DROP COLUMN "razorpaySubscriptionId",
DROP COLUMN "razorpayYearlyPlanId",
DROP COLUMN "yearlyPrice",
ADD COLUMN     "billingCycle" "BillingCycle" NOT NULL,
ADD COLUMN     "planType" "PlanType" NOT NULL DEFAULT 'PAID',
ADD COLUMN     "price" TEXT NOT NULL DEFAULT '0',
ADD COLUMN     "razorpayPlanId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Plan_razorpayPlanId_key" ON "Plan"("razorpayPlanId");
