-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "mileageKm" INTEGER,
ADD COLUMN     "mileageUpdatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "MaintenancePlan" (
    "key" VARCHAR(250) NOT NULL,
    "status" "PlanStatus" NOT NULL DEFAULT 'PENDING',
    "items" JSONB,
    "notes" TEXT,
    "confidence" VARCHAR(10),
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenancePlan_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "MaintenanceRecord" (
    "id" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "itemId" VARCHAR(60) NOT NULL,
    "doneAtKm" INTEGER NOT NULL,
    "doneAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaintenanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MaintenancePlan_status_idx" ON "MaintenancePlan"("status");

-- CreateIndex
CREATE INDEX "MaintenanceRecord_vehicleId_itemId_idx" ON "MaintenanceRecord"("vehicleId", "itemId");

-- AddForeignKey
ALTER TABLE "MaintenanceRecord" ADD CONSTRAINT "MaintenanceRecord_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
