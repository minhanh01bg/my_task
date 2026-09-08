-- CreateTable
CREATE TABLE "StorefrontPromotion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "imageUrl" TEXT,
    "ctaLabel" TEXT,
    "ctaHref" TEXT,
    "placement" TEXT NOT NULL DEFAULT 'announcement',
    "startsAt" DATETIME,
    "endsAt" DATETIME,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "StorefrontPromotion_placement_isActive_priority_idx" ON "StorefrontPromotion"("placement", "isActive", "priority");

-- CreateIndex
CREATE INDEX "StorefrontPromotion_isActive_startsAt_endsAt_idx" ON "StorefrontPromotion"("isActive", "startsAt", "endsAt");
