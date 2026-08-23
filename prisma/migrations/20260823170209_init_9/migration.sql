/*
  Warnings:

  - You are about to drop the column `storageUsedMB` on the `Usage` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Usage" DROP COLUMN "storageUsedMB",
ADD COLUMN     "storageUsedBytes" BIGINT NOT NULL DEFAULT 0;
