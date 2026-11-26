import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/db.js";
import { assetUrl, modelKey, resolveModel3D, type CatalogRow } from "../lib/model3d.js";
import { brandFromTitle, guessPart } from "../lib/parts.js";
import { enqueueVinResearch } from "../lib/queue.js";
import { normalizeCode } from "../lib/specReuse.js";
import { buildReport, logEvent } from "../lib/history.js";
import { buildOilLog } from "../lib/oilLog.js";
import { computeDue, parseRegistrationDate, parseServiceDate, type PlanItem } from "../lib/maintenance.js";
import { maintenanceKey } from "../maintenanceJobs.js";
import { getOrQueuePrices, type StoredOffer } from "../priceJobs.js";
import type { VehicleProfile } from "../agent/schema.js";
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
  mileageKm: z.number().int().min(0).max(2_000_000).optional(),
});
const ItemParams = IdParamsShape().extend({ itemId: z.string().min(1).max(60) });
const DoneBody = z.object({
  km: z.number().int().min(0).max(2_000_000).optional(),
  costTnd: z.number().min(0).max(1_000_000).optional(),
  note: z.string().trim().max(300).optional(),
  /** Day the service was done (YYYY-MM-DD), for services entered afterwards. Default: today. */
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

const RecordParams = IdParamsShape().extend({ recordId: z.uuid() });

function IdParamsShape() {
  return z.object({ id: z.uuid() });
}
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
    mileageKm: v.mileageKm,
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
      await logEvent(vehicle.id, "vehicle_added", { vin, nickname: vehicle.nickname, color: vehicle.color });
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
    const before = await prisma.vehicle.findFirst({ where: { id, userId: req.user.sub } });
    if (!before) return reply.code(404).send({ error: "Véhicule introuvable." });
    const data = body.mileageKm === undefined ? body : { ...body, mileageUpdatedAt: new Date() };
    await prisma.vehicle.update({ where: { id }, data });

    // History: one entry per real change.
    if (body.mileageKm !== undefined && body.mileageKm !== before.mileageKm) {
      await logEvent(id, "mileage_updated", { fromKm: before.mileageKm, toKm: body.mileageKm });
    }
    if (body.color !== undefined && body.color !== before.color) {
      await logEvent(id, "color_changed", { from: before.color, to: body.color });
    }
    if (body.nickname !== undefined && body.nickname !== before.nickname) {
      await logEvent(id, "nickname_changed", { from: before.nickname, to: body.nickname });
    }
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
      await logEvent(id, "info_corrected", { ...hints });
      return reply.code(202).send({ ok: true });
    },
  );

  /**
   * Maintenance: the shared plan of this car version + this owner's mileage
   * and "done" marks -> what to do now, soon, later. No AI call here.
   */
  app.get("/vehicles/:id/maintenance", async (req, reply) => {
    const { id } = IdParams.parse(req.params);
    const vehicle = await prisma.vehicle.findFirst({
      where: { id, userId: req.user.sub },
      include: { spec: true, maintenanceRecords: true },
    });
    if (!vehicle) return reply.code(404).send({ error: "Véhicule introuvable." });
    if (vehicle.spec.status !== "READY" || !vehicle.spec.data) return { status: "PENDING", mileageKm: vehicle.mileageKm, items: [] };

    const key = maintenanceKey(vehicle.spec.data as unknown as VehicleProfile);
    const plan = key ? await prisma.maintenancePlan.findUnique({ where: { key } }) : null;
    if (!plan || plan.status !== "READY" || !Array.isArray(plan.items)) {
      return { status: plan?.status === "FAILED" ? "FAILED" : "PENDING", mileageKm: vehicle.mileageKm, items: [] };
    }
    const items =
      vehicle.mileageKm === null
        ? []
        : computeDue(
            plan.items as unknown as PlanItem[],
            vehicle.mileageKm,
            vehicle.maintenanceRecords,
            parseRegistrationDate(vehicle.firstRegistration),
          );
    return {
      status: "READY",
      mileageKm: vehicle.mileageKm,
      notes: plan.notes,
      confidence: plan.confidence,
      planSize: (plan.items as unknown[]).length,
      items,
    };
  });

  /**
   * "Carnet de vidange": each oil change (date, km, cost, done with it) and
   * what is left before the next one. No AI call.
   */
  app.get("/vehicles/:id/oil-log", async (req, reply) => {
    const { id } = IdParams.parse(req.params);
    const vehicle = await prisma.vehicle.findFirst({
      where: { id, userId: req.user.sub },
      include: { spec: true, maintenanceRecords: true },
    });
    if (!vehicle) return reply.code(404).send({ error: "Véhicule introuvable." });
    const profile = vehicle.spec.status === "READY" ? (vehicle.spec.data as unknown as VehicleProfile | null) : null;
    const key = profile ? maintenanceKey(profile) : null;
    const plan = key ? await prisma.maintenancePlan.findUnique({ where: { key } }) : null;
    if (!plan || plan.status !== "READY" || !Array.isArray(plan.items)) {
      return {
        status: plan?.status === "FAILED" ? "FAILED" : "PENDING",
        item: null,
        mileageKm: vehicle.mileageKm,
        next: null,
        entries: [],
      };
    }
    const log = buildOilLog(
      plan.items as unknown as PlanItem[],
      vehicle.maintenanceRecords,
      vehicle.mileageKm,
      parseRegistrationDate(vehicle.firstRegistration),
    );
    return { status: "READY", ...log };
  });

  /**
   * Prices of the parts for one maintenance item on Tunisian shops + labour
   * estimate. Looked up by the AI agent the first time someone opens the
   * item for this car version, then shared for 7 days. Poll while PENDING.
   */
  app.get("/vehicles/:id/maintenance/:itemId/prices", async (req, reply) => {
    const { id, itemId } = ItemParams.parse(req.params);
    const vehicle = await prisma.vehicle.findFirst({ where: { id, userId: req.user.sub }, include: { spec: true } });
    if (!vehicle) return reply.code(404).send({ error: "Véhicule introuvable." });
    const profile = vehicle.spec.data as unknown as VehicleProfile | null;
    const planKey = profile ? maintenanceKey(profile) : null;
    const plan = planKey ? await prisma.maintenancePlan.findUnique({ where: { key: planKey } }) : null;
    const item = Array.isArray(plan?.items) ? (plan!.items as unknown as PlanItem[]).find((i) => i.id === itemId) : undefined;
    if (!profile || !planKey || !item) return reply.code(404).send({ error: "Élément d'entretien introuvable." });

    const { row, enriching } = await getOrQueuePrices(`${planKey}|${itemId}`, profile, item);
    const offers = Array.isArray(row.offers) ? (row.offers as unknown as StoredOffer[]) : [];
    return {
      status: row.status,
      offers: offers.map((o) => ({
        part: o.part || guessPart(o.product),
        shop: o.shop,
        product: o.product,
        brand: o.brand ?? brandFromTitle(o.product, o.reference),
        reference: o.reference ?? null,
        priceTnd: o.priceTnd,
        url: o.url,
        image: o.imageFile ? assetUrl(o.imageFile) : null,
      })),
      oemRefs: row.oemRefs ?? [],
      /** Photos/references are being added: poll again in a few seconds. */
      enriching,
      labor: row.labor ?? null,
      note: row.note,
      updatedAt: row.updatedAt,
      item,
      car: [profile.make, profile.model].filter(Boolean).join(" "),
    };
  });

  /** Marks a maintenance item as done (at the given km, default: current mileage). */
  app.post("/vehicles/:id/maintenance/:itemId/done", async (req, reply) => {
    const { id, itemId } = ItemParams.parse(req.params);
    const { km, costTnd, note, date } = DoneBody.parse(req.body ?? {});
    const vehicle = await prisma.vehicle.findFirst({ where: { id, userId: req.user.sub }, include: { spec: true } });
    if (!vehicle) return reply.code(404).send({ error: "Véhicule introuvable." });
    const doneAt = date ? parseServiceDate(date) : new Date();
    if (!doneAt) return reply.code(400).send({ error: "Date invalide : elle ne peut pas être dans le futur." });
    // A service entered afterwards needs its own km (today's odometer would be wrong).
    if (date && km === undefined) return reply.code(400).send({ error: "Indiquez le kilométrage de ce jour-là." });
    const doneAtKm = km ?? vehicle.mileageKm;
    if (doneAtKm === null || doneAtKm === undefined) {
      return reply.code(400).send({ error: "Indiquez d'abord le kilométrage de la voiture." });
    }
    // Keep the item name in the record so the history stays readable.
    const profile = vehicle.spec.data as unknown as VehicleProfile | null;
    const planKey = profile ? maintenanceKey(profile) : null;
    const plan = planKey ? await prisma.maintenancePlan.findUnique({ where: { key: planKey } }) : null;
    const item = Array.isArray(plan?.items) ? (plan!.items as unknown as PlanItem[]).find((i) => i.id === itemId) : undefined;

    const record = await prisma.maintenanceRecord.create({
      data: {
        vehicleId: id,
        itemId,
        itemName: item?.name ?? null,
        category: item?.category ?? null,
        doneAtKm,
        doneAt,
        costTnd: costTnd ?? null,
        note: note || null,
      },
    });
    await logEvent(id, "maintenance_done", {
      recordId: record.id,
      itemId,
      itemName: item?.name ?? itemId,
      category: item?.category ?? null,
      km: doneAtKm,
      costTnd: costTnd ?? null,
      date: date ?? null,
    });
    // Doing a service at a higher km also tells us the current mileage.
    if (vehicle.mileageKm === null || doneAtKm > vehicle.mileageKm) {
      await prisma.vehicle.update({ where: { id }, data: { mileageKm: doneAtKm, mileageUpdatedAt: new Date() } });
      await logEvent(id, "mileage_updated", { fromKm: vehicle.mileageKm, toKm: doneAtKm });
    }
    return reply.code(201).send({ ok: true, recordId: record.id });
  });

  /** Undo a "done" mark (wrong item, wrong km...). Kept in the history. */
  app.delete("/vehicles/:id/maintenance/records/:recordId", async (req, reply) => {
    const { id, recordId } = RecordParams.parse(req.params);
    const record = await prisma.maintenanceRecord.findFirst({ where: { id: recordId, vehicle: { id, userId: req.user.sub } } });
    if (!record) return reply.code(404).send({ error: "Entretien introuvable." });
    await prisma.maintenanceRecord.delete({ where: { id: recordId } });
    await logEvent(id, "maintenance_undone", { recordId, itemId: record.itemId, itemName: record.itemName, km: record.doneAtKm });
    return reply.code(204).send();
  });

  /** Everything that happened to this car, newest first. */
  app.get("/vehicles/:id/history", async (req, reply) => {
    const { id } = IdParams.parse(req.params);
    const vehicle = await prisma.vehicle.findFirst({ where: { id, userId: req.user.sub }, select: { id: true } });
    if (!vehicle) return reply.code(404).send({ error: "Véhicule introuvable." });
    const events = await prisma.vehicleEvent.findMany({ where: { vehicleId: id }, orderBy: { createdAt: "desc" }, take: 200 });
    return { events: events.map((e) => ({ id: e.id, type: e.type, data: e.data, date: e.createdAt.toISOString() })) };
  });

  /** Report for charts: mileage over time, spending per month and category, totals. */
  app.get("/vehicles/:id/report", async (req, reply) => {
    const { id } = IdParams.parse(req.params);
    const vehicle = await prisma.vehicle.findFirst({ where: { id, userId: req.user.sub }, select: { id: true } });
    if (!vehicle) return reply.code(404).send({ error: "Véhicule introuvable." });
    const [records, mileageEvents] = await Promise.all([
      prisma.maintenanceRecord.findMany({ where: { vehicleId: id } }),
      prisma.vehicleEvent.findMany({ where: { vehicleId: id, type: "mileage_updated" }, select: { createdAt: true, data: true } }),
    ]);
    return buildReport(records, mileageEvents);
  });

  app.delete("/vehicles/:id", async (req, reply) => {
    const { id } = IdParams.parse(req.params);
    const { count } = await prisma.vehicle.deleteMany({ where: { id, userId: req.user.sub } });
    if (count === 0) return reply.code(404).send({ error: "Véhicule introuvable." });
    return reply.code(204).send();
  });
}
