-- CreateTable
CREATE TABLE "BackInStockSubscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BackInStockSubscription_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "CustomerAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BackInStockSubscription_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "BackInStockSubscription_accountId_productId_key" ON "BackInStockSubscription"("accountId", "productId");

-- CreateIndex
CREATE INDEX "BackInStockSubscription_productId_createdAt_idx" ON "BackInStockSubscription"("productId", "createdAt");
