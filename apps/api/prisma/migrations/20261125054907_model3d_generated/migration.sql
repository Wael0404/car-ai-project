-- AlterTable
ALTER TABLE "CarModel3D" ADD COLUMN     "glbFile" VARCHAR(200),
ADD COLUMN     "source" VARCHAR(20) NOT NULL DEFAULT 'sketchfab';
