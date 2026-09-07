-- CreateTable
CREATE TABLE "CheckoutIdempotency" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "requestFingerprint" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "recoveryDigest" TEXT,
    "encryptedGuestToken" TEXT,
    "responsePayload" TEXT NOT NULL,
    "recoveredAt" DATETIME,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CheckoutIdempotency_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutIdempotency_clientId_key" ON "CheckoutIdempotency"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutIdempotency_orderId_key" ON "CheckoutIdempotency"("orderId");

-- CreateIndex
CREATE INDEX "CheckoutIdempotency_createdAt_idx" ON "CheckoutIdempotency"("createdAt");

-- CreateIndex
CREATE INDEX "CheckoutIdempotency_expiresAt_idx" ON "CheckoutIdempotency"("expiresAt");
