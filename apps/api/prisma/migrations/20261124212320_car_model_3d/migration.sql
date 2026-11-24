-- CreateEnum
CREATE TYPE "Model3DStatus" AS ENUM ('SEARCHING', 'FOUND', 'NOT_FOUND');

-- CreateTable
CREATE TABLE "CarModel3D" (
    "key" VARCHAR(200) NOT NULL,
    "status" "Model3DStatus" NOT NULL DEFAULT 'SEARCHING',
    "sketchfabUid" VARCHAR(40),
    "title" TEXT,
    "author" TEXT,
    "license" TEXT,
    "viewerUrl" TEXT,
    "thumbnailUrl" TEXT,
    "reason" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarModel3D_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "CarModel3D_status_idx" ON "CarModel3D"("status");
