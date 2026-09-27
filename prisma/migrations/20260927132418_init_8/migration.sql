/*
  Warnings:

  - You are about to drop the column `upgradeType` on the `Subscription` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- AlterTable
ALTER TABLE "Plan" ADD COLUMN     "status" "PlanStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Subscription" DROP COLUMN "upgradeType";
