ALTER TABLE "payments"
ADD COLUMN "walkInCustomerName" VARCHAR(120),
ADD COLUMN "walkInCustomerPhone" VARCHAR(30),
ADD COLUMN "walkInCustomerDocument" VARCHAR(30);

CREATE INDEX "payments_walkInCustomerName_idx" ON "payments"("walkInCustomerName");
