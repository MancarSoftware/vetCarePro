CREATE TYPE "SriInvoiceStatus" AS ENUM (
  'DRAFT',
  'XML_GENERATED',
  'SIGNED',
  'SENT',
  'AUTHORIZED',
  'REJECTED',
  'CANCELLED'
);

CREATE TABLE "sri_invoices" (
  "id" UUID NOT NULL,
  "paymentId" UUID NOT NULL,
  "issuedById" UUID NOT NULL,
  "status" "SriInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
  "environment" VARCHAR(20) NOT NULL DEFAULT 'TEST',
  "establishmentCode" VARCHAR(3) NOT NULL DEFAULT '001',
  "emissionPoint" VARCHAR(3) NOT NULL DEFAULT '001',
  "sequential" INTEGER NOT NULL,
  "accessKey" VARCHAR(60) NOT NULL,
  "authorizationNumber" VARCHAR(80),
  "authorizedAt" TIMESTAMP(3),
  "customerName" VARCHAR(180) NOT NULL,
  "customerDocument" VARCHAR(30) NOT NULL,
  "customerEmail" VARCHAR(160),
  "xmlPath" VARCHAR(500),
  "ridePath" VARCHAR(500),
  "sriMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "sri_invoices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sri_invoices_paymentId_key" ON "sri_invoices"("paymentId");
CREATE UNIQUE INDEX "sri_invoices_accessKey_key" ON "sri_invoices"("accessKey");
CREATE INDEX "sri_invoices_status_createdAt_idx" ON "sri_invoices"("status", "createdAt");
CREATE INDEX "sri_invoices_issuedById_createdAt_idx" ON "sri_invoices"("issuedById", "createdAt");

ALTER TABLE "sri_invoices"
ADD CONSTRAINT "sri_invoices_paymentId_fkey"
FOREIGN KEY ("paymentId") REFERENCES "payments"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sri_invoices"
ADD CONSTRAINT "sri_invoices_issuedById_fkey"
FOREIGN KEY ("issuedById") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
