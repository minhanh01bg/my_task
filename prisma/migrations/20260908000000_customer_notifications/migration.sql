-- CreateTable
CREATE TABLE "CustomerNotification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "orderId" TEXT,
    "href" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" DATETIME,
    CONSTRAINT "CustomerNotification_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "CustomerAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerNotification_eventKey_key" ON "CustomerNotification"("eventKey");

-- CreateIndex
CREATE INDEX "CustomerNotification_accountId_readAt_createdAt_idx" ON "CustomerNotification"("accountId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "CustomerNotification_accountId_createdAt_id_idx" ON "CustomerNotification"("accountId", "createdAt", "id");
