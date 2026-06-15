-- CreateEnum
CREATE TYPE "PaymentItemType" AS ENUM ('SERVICE', 'PRODUCT', 'OTHER');

-- AlterTable
ALTER TABLE "inventory_movements" ADD COLUMN "paymentItemId" UUID;

-- AlterTable
ALTER TABLE "payments"
ADD COLUMN "petId" UUID,
ADD COLUMN "invoiceNumber" VARCHAR(50),
ADD COLUMN "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "voidedAt" TIMESTAMP(3);

-- Preserve compatibility if payments already exist.
UPDATE "payments"
SET
  "invoiceNumber" = 'LEGACY-' || UPPER(SUBSTRING("id"::text, 1, 8)),
  "subtotal" = "amount",
  "paidAmount" = CASE WHEN "status" = 'PAID' THEN "amount" ELSE 0 END;

ALTER TABLE "payments" ALTER COLUMN "invoiceNumber" SET NOT NULL;

-- CreateTable
CREATE TABLE "payment_items" (
    "id" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "productId" UUID,
    "type" "PaymentItemType" NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_transactions" (
    "id" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" VARCHAR(100),
    "notes" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_transactions_pkey" PRIMARY KEY ("id")
);

-- Preserve historical paid entries in the new transaction ledger.
INSERT INTO "payment_transactions" (
  "id",
  "paymentId",
  "createdById",
  "amount",
  "method",
  "reference",
  "receivedAt",
  "createdAt"
)
SELECT
  gen_random_uuid(),
  "id",
  "createdById",
  "amount",
  "method",
  "reference",
  COALESCE("paidAt", "createdAt"),
  "createdAt"
FROM "payments"
WHERE "status" = 'PAID' AND "amount" > 0;

-- CreateIndex
CREATE UNIQUE INDEX "payments_invoiceNumber_key" ON "payments"("invoiceNumber");

-- CreateIndex
CREATE INDEX "payments_petId_createdAt_idx" ON "payments"("petId", "createdAt");

-- CreateIndex
CREATE INDEX "payment_items_paymentId_idx" ON "payment_items"("paymentId");

-- CreateIndex
CREATE INDEX "payment_items_productId_idx" ON "payment_items"("productId");

-- CreateIndex
CREATE INDEX "payment_transactions_paymentId_receivedAt_idx" ON "payment_transactions"("paymentId", "receivedAt");

-- CreateIndex
CREATE INDEX "payment_transactions_receivedAt_voidedAt_idx" ON "payment_transactions"("receivedAt", "voidedAt");

-- CreateIndex
CREATE INDEX "inventory_movements_paymentItemId_idx" ON "inventory_movements"("paymentItemId");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_petId_fkey" FOREIGN KEY ("petId") REFERENCES "pets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_items" ADD CONSTRAINT "payment_items_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_items" ADD CONSTRAINT "payment_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "inventory_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_paymentItemId_fkey" FOREIGN KEY ("paymentItemId") REFERENCES "payment_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
