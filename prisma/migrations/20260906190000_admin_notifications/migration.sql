-- CreateTable
CREATE TABLE "AdminNotification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" DATETIME
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminNotification_eventKey_key" ON "AdminNotification"("eventKey");

-- CreateIndex
CREATE INDEX "AdminNotification_readAt_createdAt_idx" ON "AdminNotification"("readAt", "createdAt");

-- CreateIndex
CREATE INDEX "AdminNotification_createdAt_id_idx" ON "AdminNotification"("createdAt", "id");
