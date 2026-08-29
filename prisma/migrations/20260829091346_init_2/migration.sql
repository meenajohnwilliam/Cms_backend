/*
  Warnings:

  - You are about to drop the column `planType` on the `Plan` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Plan" DROP COLUMN "planType",
ADD COLUMN     "type" "PlanType" NOT NULL DEFAULT 'PAID';
