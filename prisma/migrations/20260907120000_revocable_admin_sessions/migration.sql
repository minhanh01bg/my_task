-- CreateTable
CREATE TABLE "AdminIdentity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'owner',
    "passwordHash" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "disabledAt" DATETIME
);

-- CreateTable
CREATE TABLE "AdminSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "identityId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "identityVersion" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" DATETIME NOT NULL,
    "idleExpiresAt" DATETIME NOT NULL,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" DATETIME,
    CONSTRAINT "AdminSession_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "AdminIdentity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdminAuditEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "identityId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" TEXT,
    "ipAddress" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminAuditEvent_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "AdminIdentity" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminIdentity_username_key" ON "AdminIdentity"("username");

-- CreateIndex
CREATE INDEX "AdminIdentity_disabledAt_idx" ON "AdminIdentity"("disabledAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdminSession_tokenHash_key" ON "AdminSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AdminSession_identityId_expiresAt_idx" ON "AdminSession"("identityId", "expiresAt");

-- CreateIndex
CREATE INDEX "AdminSession_tokenHash_revokedAt_idx" ON "AdminSession"("tokenHash", "revokedAt");

-- CreateIndex
CREATE INDEX "AdminAuditEvent_createdAt_idx" ON "AdminAuditEvent"("createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditEvent_entityType_entityId_idx" ON "AdminAuditEvent"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AdminAuditEvent_identityId_createdAt_idx" ON "AdminAuditEvent"("identityId", "createdAt");
