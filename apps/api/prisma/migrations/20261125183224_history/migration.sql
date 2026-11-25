-- AlterTable
ALTER TABLE "MaintenanceRecord" ADD COLUMN     "category" VARCHAR(30),
ADD COLUMN     "costTnd" DOUBLE PRECISION,
ADD COLUMN     "itemName" VARCHAR(120),
ADD COLUMN     "note" VARCHAR(300);

-- CreateTable
CREATE TABLE "VehicleEvent" (
    "id" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "type" VARCHAR(40) NOT NULL,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VehicleEvent_vehicleId_createdAt_idx" ON "VehicleEvent"("vehicleId", "createdAt");

-- AddForeignKey
ALTER TABLE "VehicleEvent" ADD CONSTRAINT "VehicleEvent_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
