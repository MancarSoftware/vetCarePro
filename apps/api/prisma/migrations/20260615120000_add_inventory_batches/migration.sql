-- CreateTable
CREATE TABLE "inventory_batches" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "batchNumber" VARCHAR(100),
    "initialQuantity" DECIMAL(12,3) NOT NULL,
    "currentQuantity" DECIMAL(12,3) NOT NULL,
    "unitCost" DECIMAL(12,2),
    "expirationDate" DATE,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "inventory_batches_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "inventory_movements" ADD COLUMN "batchId" UUID;

-- CreateIndex
CREATE INDEX "inventory_batches_productId_expirationDate_idx" ON "inventory_batches"("productId", "expirationDate");

-- CreateIndex
CREATE INDEX "inventory_batches_productId_currentQuantity_idx" ON "inventory_batches"("productId", "currentQuantity");

-- CreateIndex
CREATE INDEX "inventory_batches_batchNumber_idx" ON "inventory_batches"("batchNumber");

-- CreateIndex
CREATE INDEX "inventory_batches_deletedAt_idx" ON "inventory_batches"("deletedAt");

-- CreateIndex
CREATE INDEX "inventory_movements_batchId_createdAt_idx" ON "inventory_movements"("batchId", "createdAt");

-- AddForeignKey
ALTER TABLE "inventory_batches" ADD CONSTRAINT "inventory_batches_productId_fkey" FOREIGN KEY ("productId") REFERENCES "inventory_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "inventory_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
