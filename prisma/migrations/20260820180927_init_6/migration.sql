-- AlterTable
ALTER TABLE "Media" ADD COLUMN     "submissionId" TEXT,
ALTER COLUMN "recordId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "FormSubmission"("submissionId") ON DELETE CASCADE ON UPDATE CASCADE;
