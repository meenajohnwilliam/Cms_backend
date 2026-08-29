-- CreateEnum
CREATE TYPE "UsageResetCycle" AS ENUM ('MONTHLY');

-- AlterTable
ALTER TABLE "Plan" ADD COLUMN     "usageResetCycle" "UsageResetCycle" NOT NULL DEFAULT 'MONTHLY',
ALTER COLUMN "billingCycle" DROP DEFAULT;
