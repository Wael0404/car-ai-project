-- AlterTable
ALTER TABLE "PartPrices" ADD COLUMN     "oemRefs" TEXT[] DEFAULT ARRAY[]::TEXT[];
