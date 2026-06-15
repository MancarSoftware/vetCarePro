-- CreateEnum
CREATE TYPE "TreatmentEvolutionStatus" AS ENUM ('IMPROVING', 'STABLE', 'WORSENING', 'RECOVERED');

-- CreateTable
CREATE TABLE "treatment_evolutions" (
    "id" UUID NOT NULL,
    "treatmentId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "status" "TreatmentEvolutionStatus" NOT NULL,
    "title" VARCHAR(160),
    "notes" TEXT NOT NULL,
    "weightKg" DECIMAL(7,2),
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "nextReviewAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "treatment_evolutions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "treatment_evolutions_treatmentId_occurredAt_idx" ON "treatment_evolutions"("treatmentId", "occurredAt");

-- CreateIndex
CREATE INDEX "treatment_evolutions_status_occurredAt_idx" ON "treatment_evolutions"("status", "occurredAt");

-- CreateIndex
CREATE INDEX "treatment_evolutions_deletedAt_idx" ON "treatment_evolutions"("deletedAt");

-- CreateIndex
CREATE INDEX "media_files_treatmentId_idx" ON "media_files"("treatmentId");

-- AddForeignKey
ALTER TABLE "treatment_evolutions" ADD CONSTRAINT "treatment_evolutions_treatmentId_fkey" FOREIGN KEY ("treatmentId") REFERENCES "treatments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_evolutions" ADD CONSTRAINT "treatment_evolutions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
