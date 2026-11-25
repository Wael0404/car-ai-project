-- CreateTable
CREATE TABLE "PartPrices" (
    "key" VARCHAR(320) NOT NULL,
    "status" "PlanStatus" NOT NULL DEFAULT 'PENDING',
    "offers" JSONB,
    "labor" JSONB,
    "note" TEXT,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartPrices_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "PartPrices_status_idx" ON "PartPrices"("status");
