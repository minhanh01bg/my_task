-- CreateIndex
CREATE INDEX "Product_isActive_deletedAt_isService_soldCount_idx" ON "Product"("isActive", "deletedAt", "isService", "soldCount");

-- CreateIndex
CREATE INDEX "Product_isActive_deletedAt_name_idx" ON "Product"("isActive", "deletedAt", "name");

-- CreateIndex
CREATE INDEX "Product_categoryId_isActive_soldCount_idx" ON "Product"("categoryId", "isActive", "soldCount");

-- CreateIndex
CREATE INDEX "Product_deletedAt_isService_stock_idx" ON "Product"("deletedAt", "isService", "stock");

-- CreateIndex
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Order_channel_createdAt_idx" ON "Order"("channel", "createdAt");

-- CreateIndex
CREATE INDEX "Order_customerAccountId_channel_createdAt_idx" ON "Order"("customerAccountId", "channel", "createdAt");

-- CreateIndex
CREATE INDEX "Order_anonymizedAt_legalHold_createdAt_idx" ON "Order"("anonymizedAt", "legalHold", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_orderId_method_idx" ON "Payment"("orderId", "method");

-- CreateIndex
CREATE INDEX "GuestOrderAccess_expiresAt_idx" ON "GuestOrderAccess"("expiresAt");

-- CreateIndex
CREATE INDEX "CustomerSession_expiresAt_idx" ON "CustomerSession"("expiresAt");

-- CreateIndex
CREATE INDEX "AdminSession_expiresAt_idx" ON "AdminSession"("expiresAt");

-- CreateIndex
CREATE INDEX "CustomerNotification_createdAt_idx" ON "CustomerNotification"("createdAt");
