-- CreateTable
CREATE TABLE "Media" (
    "mediaId" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "fieldId" TEXT,
    "type" "FieldType" NOT NULL,
    "originalName" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Media_pkey" PRIMARY KEY ("mediaId")
);

-- CreateIndex
CREATE INDEX "Media_recordId_idx" ON "Media"("recordId");

-- CreateIndex
CREATE INDEX "Media_fieldId_idx" ON "Media"("fieldId");

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "Record"("recordId") ON DELETE CASCADE ON UPDATE CASCADE;
