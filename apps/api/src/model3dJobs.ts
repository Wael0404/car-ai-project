import type { Logger } from "pino";
import { mkdir, writeFile } from "node:fs/promises";
import { findCarModel } from "./agent/modelFinder.js";
import { findCarGallery } from "./agent/photoGallery.js";
import { findCarPhoto, generateGlb } from "./agent/photoTo3D.js";
import type { VehicleProfile } from "./agent/schema.js";
import { prisma } from "./lib/db.js";
import { MODELS_DIR, modelKey } from "./lib/model3d.js";
import { enqueueModel3DSearch, type Model3DJobData } from "./lib/queue.js";

/** A car with no free 3D model is searched again after this delay. */
const RETRY_NOT_FOUND_MS = 30 * 24 * 3600 * 1000;

/** Called when a VIN profile is ready: makes sure its car has a 3D model search. */
export async function ensureModel3D(profile: VehicleProfile, log: Logger): Promise<void> {
  if (!profile.make || !profile.model) return;
  const variant = profile.bodyVariant || "standard";
  const key = modelKey(profile.make, profile.model, profile.generation, variant);
  const row = await prisma.carModel3D.findUnique({ where: { key } });

  // Not found, or only a "closest" model: look again later, an exact one may appear.
  const retryable = row?.status === "NOT_FOUND" || (row?.status === "FOUND" && !row.exactMatch);
  const stale = retryable && Date.now() - row!.updatedAt.getTime() > RETRY_NOT_FOUND_MS;
  if (row && !stale) return; // already found, searching, or recently checked

  await prisma.carModel3D.upsert({
    where: { key },
    update: { status: "SEARCHING" },
    create: { key, status: "SEARCHING" },
  });
  await enqueueModel3DSearch({
    key,
    make: profile.make,
    model: profile.model,
    generation: profile.generation,
    variant,
    modelYear: profile.modelYear,
    bodyType: profile.bodyType,
  });
  log.info({ key }, "3D model search queued");
}

const slug = (key: string) =>
  key
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);

/** Real photos of the exact version, one per angle. Returns false if none fit. */
async function buildGallery(data: Model3DJobData, log: Logger): Promise<boolean> {
  const { views, reason } = await findCarGallery(data);
  if (views.length === 0) {
    log.info({ key: data.key, reason }, "No photos of this exact car");
    return false;
  }
  await prisma.carModel3D.update({
    where: { key: data.key },
    data: {
      status: "FOUND",
      source: "photos",
      exactMatch: true,
      sketchfabUid: null,
      glbFile: null,
      photos: views.map((v) => ({
        angle: v.angle,
        url: v.photo.imageUrl,
        pageUrl: v.photo.pageUrl,
        author: v.photo.author,
        license: v.photo.license,
        title: v.photo.title,
      })),
      title: views[0]!.photo.title.slice(0, 200),
      author: views[0]!.photo.author,
      license: views[0]!.photo.license,
      viewerUrl: views[0]!.photo.pageUrl,
      thumbnailUrl: views[0]!.photo.imageUrl,
      reason,
    },
  });
  log.info({ key: data.key, views: views.map((v) => v.angle) }, "Photo gallery ready");
  return true;
}

/**
 * Kept for later: generates a 3D model from photos with TRELLIS (realism
 * was judged too low by the owner, so the worker does not call it now).
 * Generates the car's 3D model from a free photo of the exact version.
 * Returns false (and changes nothing) when no suitable photo exists.
 */
async function generateFromPhoto(data: Model3DJobData, log: Logger): Promise<boolean> {
  const { photo, otherViews, reason } = await findCarPhoto(data);
  if (!photo) {
    log.info({ key: data.key, reason }, "No photo to generate a 3D model from");
    return false;
  }
  log.info({ key: data.key, photo: photo.title, views: 1 + otherViews.length }, "Generating 3D model from photos");
  const glb = await generateGlb(photo, otherViews);

  const file = `generated/${slug(data.key)}.glb`;
  await mkdir(MODELS_DIR + "generated", { recursive: true });
  await writeFile(MODELS_DIR + file, glb);

  await prisma.carModel3D.update({
    where: { key: data.key },
    data: {
      status: "FOUND",
      source: "generated",
      exactMatch: true,
      glbFile: file,
      sketchfabUid: null,
      title: photo.title.slice(0, 200),
      author: photo.author,
      license: photo.license,
      viewerUrl: photo.pageUrl,
      thumbnailUrl: photo.imageUrl,
      reason,
    },
  });
  log.info({ key: data.key, file, bytes: glb.length }, "3D model generated");
  return true;
}

/** Worker job: the agent searches Sketchfab and validates the best model with vision. */
export async function runModel3DSearch(data: Model3DJobData, finalAttempt: boolean, log: Logger): Promise<void> {
  await prisma.carModel3D.update({ where: { key: data.key }, data: { attempts: { increment: 1 } } });
  try {
    const { candidate, exact, reason } = await findCarModel(data);

    // No artist-made model of this exact car: show real photos of it instead
    // (free and photoreal; AI-generated meshes were not realistic enough).
    if (!candidate) {
      const shown = await buildGallery(data, log);
      if (shown) return;
    }

    await prisma.carModel3D.update({
      where: { key: data.key },
      data: candidate
        ? {
            status: "FOUND",
            sketchfabUid: candidate.uid,
            exactMatch: exact,
            title: candidate.name.slice(0, 200),
            author: candidate.author,
            license: candidate.license,
            viewerUrl: candidate.viewerUrl,
            thumbnailUrl: candidate.previewUrl ?? candidate.thumbnailUrl,
            reason,
          }
        : { status: "NOT_FOUND", sketchfabUid: null, reason },
    });
    log.info({ key: data.key, found: Boolean(candidate), exact, uid: candidate?.uid }, "3D model search done");
  } catch (err) {
    if (finalAttempt) {
      await prisma.carModel3D.update({
        where: { key: data.key },
        data: { status: "NOT_FOUND", reason: (err as Error).message.slice(0, 500) },
      });
    }
    throw err;
  }
}
