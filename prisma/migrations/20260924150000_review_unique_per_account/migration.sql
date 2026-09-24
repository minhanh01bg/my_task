-- CreateIndex
CREATE UNIQUE INDEX "ProductReview_productId_accountId_key" ON "ProductReview"("productId", "accountId");
