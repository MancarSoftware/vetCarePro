CREATE TYPE "ExpenseCategory" AS ENUM (
  'INVENTORY',
  'SALARIES',
  'RENT',
  'UTILITIES',
  'SERVICES',
  'MAINTENANCE',
  'TAXES',
  'MARKETING',
  'ADMINISTRATIVE',
  'OTHER'
);

CREATE TABLE "finance_expenses" (
  "id" UUID NOT NULL,
  "createdById" UUID NOT NULL,
  "category" "ExpenseCategory" NOT NULL,
  "description" VARCHAR(255) NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "vendor" VARCHAR(180),
  "reference" VARCHAR(120),
  "occurredAt" DATE NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),

  CONSTRAINT "finance_expenses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "finance_expenses_occurredAt_deletedAt_idx"
  ON "finance_expenses"("occurredAt", "deletedAt");

CREATE INDEX "finance_expenses_category_occurredAt_idx"
  ON "finance_expenses"("category", "occurredAt");

CREATE INDEX "finance_expenses_createdById_createdAt_idx"
  ON "finance_expenses"("createdById", "createdAt");

ALTER TABLE "finance_expenses"
  ADD CONSTRAINT "finance_expenses_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
