-- LAN licensing for VetCare Pro 1.1.0

CREATE TABLE "lan_licenses" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "licenseKey" VARCHAR(1800) NOT NULL,
  "licenseId" VARCHAR(80) NOT NULL,
  "clinicName" VARCHAR(180) NOT NULL,
  "clientLimit" INTEGER NOT NULL,
  "issuedAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "payload" JSONB NOT NULL,
  "signature" VARCHAR(128) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "lan_licenses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "lan_devices" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "licenseId" UUID NOT NULL,
  "deviceId" VARCHAR(120) NOT NULL,
  "deviceName" VARCHAR(180) NOT NULL,
  "runtimeMode" VARCHAR(40) NOT NULL,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "authorizedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "notes" TEXT,

  CONSTRAINT "lan_devices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "lan_licenses_licenseKey_key" ON "lan_licenses"("licenseKey");
CREATE UNIQUE INDEX "lan_licenses_licenseId_key" ON "lan_licenses"("licenseId");
CREATE INDEX "lan_licenses_revokedAt_idx" ON "lan_licenses"("revokedAt");

CREATE UNIQUE INDEX "lan_devices_deviceId_key" ON "lan_devices"("deviceId");
CREATE INDEX "lan_devices_licenseId_revokedAt_idx" ON "lan_devices"("licenseId", "revokedAt");
CREATE INDEX "lan_devices_lastSeenAt_idx" ON "lan_devices"("lastSeenAt");

ALTER TABLE "lan_devices"
  ADD CONSTRAINT "lan_devices_licenseId_fkey"
  FOREIGN KEY ("licenseId") REFERENCES "lan_licenses"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
