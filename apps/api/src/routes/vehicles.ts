import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/db.js";
import { modelKey, resolveModel3D, type CatalogRow } from "../lib/model3d.js";
import { enqueueVinResearch } from "../lib/queue.js";
import { normalizeCode } from "../lib/specReuse.js";
import { validateVin } from "../lib/vin.js";
import type { Prisma } from "../generated/prisma/client.js";

const MAX_VEHICLES_PER_USER = 10;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((s) => (s ? s : undefined));

/** What the owner reads on the registration card (all optional). */
const OwnerHintsBody = z.object({
  make: optionalText(40),
  model: optionalText(60),
  variant: optionalText(80),
  firstRegistration: optionalText(10),
});

const AddVehicleBody = OwnerHintsBody.extend({
  vin: z.string().min(11).max(25),
  nickname: z.string().trim().min(1).max(60).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});
const UpdateVehicleBody = z.object({
  nickname: z.string().trim().min(1).max(60).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});
const IdParams = z.object({ id: z.uuid() });

type VehicleWithSpec = Prisma.VehicleGetPayload<{ include: { spec: true } }>;

/** Public shape of a vehicle, as the mobile app receives it. */
/**
 * The worker queues the 3D search right after the profile is ready. Until its
 * row exists, report "searching" so the app keeps polling and shows the model
 * as soon as it is found or generated.
 */
const SEARCH_PENDING: CatalogRow = {
  status: "SEARCHING",
  sketchfabUid: null,
  exactMatch: false,
  source: "sketchfab",
  glbFile: null,
  photos: null,
  title: null,
  author: null,
  license: null,
  viewerUrl: null,
  thumbnailUrl: null,
};

type Profile = {
  make?: string | null;
  model?: string | null;
  generation?: string | null;
  bodyVariant?: string | null;
} | null;

function catalogKey(v: VehicleWithSpec): string | null {
  const p = v.spec.data as Profile;
  return p?.make && p.model ? modelKey(p.make, p.model, p.generation ?? null, p.bodyVariant ?? null) : null;
}

/** Loads the 3D catalog rows of these vehicles in one query. */
async function loadCatalog(vehicles: VehicleWithSpec[]): Promise<Map<string, CatalogRow>> {
  const keys = [...new Set(vehicles.map(catalogKey).filter((k): k is string => k !== null))];
  if (keys.length === 0) return new Map();
  const rows = await prisma.carModel3D.findMany({ where: { key: { in: keys } } });
  return new Map(rows.map((r) => [r.key, r]));
}

function toDto(v: VehicleWithSpec, catalog: Map<string, CatalogRow>) {
  const key = catalogKey(v);
  const spec = v.spec;
  return {
    id: v.id,
    vin: v.vin,
    nickname: v.nickname,
    color: v.color,
    declared: {
      make: v.declaredMake,
      model: v.declaredModel,
      variant: v.declaredVariant,
      firstRegistration: v.firstRegistration,
    },
    createdAt: v.createdAt,
    status: spec?.status ?? "PENDING",
    profile: spec?.status === "READY" ? spec.data : null,
    model3d:
      spec?.status === "READY"
        ? resolveModel3D({
            make: spec.make,
            model: spec.model,
            modelYear: spec.modelYear,
            generation: (spec.data as Profile)?.generation ?? null,
            bodyType: spec.bodyType,
          }, key ? (catalog.get(key) ?? SEARCH_PENDING) : null)
        : null,
  };
}

export async function vehicleRoutes(app: FastifyInstance) {
  app.addHook("onRequest", app.authenticate);

  app.get("/vehicles", async (req) => {
    const vehicles = await prisma.vehicle.findMany({
      where: { userId: req.user.sub },
      include: { spec: true },
      orderBy: { createdAt: "asc" },
    });
    const catalog = await loadCatalog(vehicles);
    return vehicles.map((v) => toDto(v, catalog));
  });

  app.get("/vehicles/:id", async (req, reply) => {
    const { id } = IdParams.parse(req.params);
    const vehicle = await prisma.vehicle.findFirst({
      where: { id, userId: req.user.sub },
      include: { spec: true },
    });
    if (!vehicle) return reply.code(404).send({ error: "Véhicule introuvable." });
    return toDto(vehicle, await loadCatalog([vehicle]));
  });

  /** Adds a car. The AI research runs in the background; poll GET /vehicles/:id. */
  app.post("/vehicles", async (req, reply) => {
    const body = AddVehicleBody.parse(req.body);
    const check = validateVin(body.vin);
    if (!check.valid) return reply.code(400).send({ error: check.reason });
    const { vin } = check;
    const userId = req.user.sub;
    // Codes normalised so identical registrations match (see lib/specReuse.ts).
    const hints = {
      make: normalizeCode(body.make),
      model: normalizeCode(body.model),
      variant: normalizeCode(body.variant),
      firstRegistration: body.firstRegistration,
    };

    const count = await prisma.vehicle.count({ where: { userId } });
    if (count >= MAX_VEHICLES_PER_USER) {
      return reply.code(400).send({ error: `Maximum ${MAX_VEHICLES_PER_USER} véhicules par compte.` });
    }

    // The spec is shared by VIN: create it once, research it once.
    const spec = await prisma.vehicleSpec.upsert({ where: { vin }, update: {}, create: { vin } });
    if (spec.status !== "READY") {
      if (spec.status === "FAILED") {
        await prisma.vehicleSpec.update({ where: { vin }, data: { status: "PENDING", error: null } });
      }
      await enqueueVinResearch(vin, hints);
    }

    try {
      const vehicle = await prisma.vehicle.create({
        data: {
          userId,
          vin,
          nickname: body.nickname ?? null,
          color: body.color ?? "#9aa0a6",
          declaredMake: hints.make ?? null,
          declaredModel: hints.model ?? null,
          declaredVariant: hints.variant ?? null,
          firstRegistration: hints.firstRegistration ?? null,
        },
        include: { spec: true },
      });
      return reply.code(201).send(toDto(vehicle, await loadCatalog([vehicle])));
    } catch (err) {
      if ((err as { code?: string }).code === "P2002") {
        return reply.code(409).send({ error: "Cette voiture est déjà dans votre compte." });
      }
      throw err;
    }
  });

  app.patch("/vehicles/:id", async (req, reply) => {
    const { id } = IdParams.parse(req.params);
    const body = UpdateVehicleBody.parse(req.body);
    const { count } = await prisma.vehicle.updateMany({ where: { id, userId: req.user.sub }, data: body });
    if (count === 0) return reply.code(404).send({ error: "Véhicule introuvable." });
    const vehicle = await prisma.vehicle.findUniqueOrThrow({ where: { id }, include: { spec: true } });
    return toDto(vehicle, await loadCatalog([vehicle]));
  });

  /**
   * Runs the agent again for this car, with the make/model/type the owner
   * read on the registration card (corrects a wrong identification).
   */
  app.post(
    "/vehicles/:id/research",
    { config: { rateLimit: { max: 5, timeWindow: "1 hour" } } },
    async (req, reply) => {
      const { id } = IdParams.parse(req.params);
      const raw = OwnerHintsBody.parse(req.body ?? {});
      const hints = {
        ...raw,
        make: normalizeCode(raw.make),
        model: normalizeCode(raw.model),
        variant: normalizeCode(raw.variant),
      };
      const vehicle = await prisma.vehicle.findFirst({ where: { id, userId: req.user.sub }, include: { spec: true } });
      if (!vehicle) return reply.code(404).send({ error: "Véhicule introuvable." });
      if (vehicle.spec.status === "PENDING") return reply.code(409).send({ error: "Recherche déjà en cours." });

      await prisma.vehicle.update({
        where: { id },
        data: {
          declaredMake: hints.make ?? null,
          declaredModel: hints.model ?? null,
          declaredVariant: hints.variant ?? null,
          firstRegistration: hints.firstRegistration ?? null,
        },
      });
      await prisma.vehicleSpec.update({ where: { vin: vehicle.vin }, data: { status: "PENDING", error: null } });
      await enqueueVinResearch(vehicle.vin, hints);
      return reply.code(202).send({ ok: true });
    },
  );

  app.delete("/vehicles/:id", async (req, reply) => {
    const { id } = IdParams.parse(req.params);
    const { count } = await prisma.vehicle.deleteMany({ where: { id, userId: req.user.sub } });
    if (count === 0) return reply.code(404).send({ error: "Véhicule introuvable." });
    return reply.code(204).send();
  });
}
