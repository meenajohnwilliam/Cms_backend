/*
  Warnings:

  - Added the required column `planLevel` to the `Plan` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Plan" ADD COLUMN     "planLevel" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "gracePeriodEndDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Usage" ADD COLUMN     "usageResetAt" TIMESTAMP(3);
