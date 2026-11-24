import type { Logger } from "pino";
import { findCarModel } from "./agent/modelFinder.js";
import type { VehicleProfile } from "./agent/schema.js";
import { prisma } from "./lib/db.js";
import { modelKey } from "./lib/model3d.js";
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

/** Worker job: the agent searches Sketchfab and validates the best model with vision. */
export async function runModel3DSearch(data: Model3DJobData, finalAttempt: boolean, log: Logger): Promise<void> {
  await prisma.carModel3D.update({ where: { key: data.key }, data: { attempts: { increment: 1 } } });
  try {
    const { candidate, exact, reason } = await findCarModel(data);
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
