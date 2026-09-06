-- Add isolated customer identity, DB-backed sessions and online-order access.
CREATE TABLE "CustomerAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phoneNormalized" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "phoneVerifiedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "disabledAt" DATETIME
);
CREATE UNIQUE INDEX "CustomerAccount_phoneNormalized_key" ON "CustomerAccount"("phoneNormalized");

CREATE TABLE "CustomerSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME,
    "revokedAt" DATETIME,
    CONSTRAINT "CustomerSession_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "CustomerAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CustomerSession_tokenHash_key" ON "CustomerSession"("tokenHash");
CREATE INDEX "CustomerSession_accountId_expiresAt_idx" ON "CustomerSession"("accountId", "expiresAt");

ALTER TABLE "Order" ADD COLUMN "customerAccountId" TEXT REFERENCES "CustomerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Order_customerAccountId_idx" ON "Order"("customerAccountId");

CREATE TABLE "GuestOrderAccess" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" DATETIME,
    CONSTRAINT "GuestOrderAccess_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "GuestOrderAccess_orderId_key" ON "GuestOrderAccess"("orderId");
CREATE UNIQUE INDEX "GuestOrderAccess_tokenHash_key" ON "GuestOrderAccess"("tokenHash");
