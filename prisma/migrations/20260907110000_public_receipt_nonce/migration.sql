-- AlterTable
ALTER TABLE "Order" ADD COLUMN "receiptNonceHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Order_receiptNonceHash_key" ON "Order"("receiptNonceHash");
