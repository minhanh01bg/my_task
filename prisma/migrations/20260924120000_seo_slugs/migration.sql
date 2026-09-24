-- AlterTable
ALTER TABLE "Category" ADD COLUMN "slug" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "slug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");
