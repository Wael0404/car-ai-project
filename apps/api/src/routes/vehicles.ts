import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/db.js";
import { resolveModel3D } from "../lib/model3d.js";
import { enqueueVinResearch } from "../lib/queue.js";
import { validateVin } from "../lib/vin.js";
import type { Prisma } from "../generated/prisma/client.js";

const MAX_VEHICLES_PER_USER = 10;

const AddVehicleBody = z.object({
  vin: z.string().min(11).max(25),
  nickname: z.string().trim().min(1).max(60).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});
const UpdateVehicleBody = AddVehicleBody.omit({ vin: true });
const IdParams = z.object({ id: z.uuid() });

type VehicleWithSpec = Prisma.VehicleGetPayload<{ include: { spec: true } }>;

/** Public shape of a vehicle, as the mobile app receives it. */
function toDto(v: VehicleWithSpec) {
  const spec = v.spec;
  return {
    id: v.id,
    vin: v.vin,
    nickname: v.nickname,
    color: v.color,
    createdAt: v.createdAt,
    status: spec?.status ?? "PENDING",
    profile: spec?.status === "READY" ? spec.data : null,
    model3d:
      spec?.status === "READY"
        ? resolveModel3D({
            make: spec.make,
            model: spec.model,
            modelYear: spec.modelYear,
            bodyType: spec.bodyType,
          })
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
    return vehicles.map(toDto);
  });

  app.get("/vehicles/:id", async (req, reply) => {
    const { id } = IdParams.parse(req.params);
    const vehicle = await prisma.vehicle.findFirst({
      where: { id, userId: req.user.sub },
      include: { spec: true },
    });
    if (!vehicle) return reply.code(404).send({ error: "Véhicule introuvable." });
    return toDto(vehicle);
  });

  /** Adds a car. The AI research runs in the background; poll GET /vehicles/:id. */
  app.post("/vehicles", async (req, reply) => {
    const body = AddVehicleBody.parse(req.body);
    const check = validateVin(body.vin);
    if (!check.valid) return reply.code(400).send({ error: check.reason });
    const { vin } = check;
    const userId = req.user.sub;

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
      await enqueueVinResearch(vin);
    }

    try {
      const vehicle = await prisma.vehicle.create({
        data: { userId, vin, nickname: body.nickname ?? null, color: body.color ?? "#9aa0a6" },
        include: { spec: true },
      });
      return reply.code(201).send(toDto(vehicle));
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
    return toDto(vehicle);
  });

  /** Asks the agent to research a VIN again after a failure. */
  app.post("/vehicles/:id/retry", async (req, reply) => {
    const { id } = IdParams.parse(req.params);
    const vehicle = await prisma.vehicle.findFirst({ where: { id, userId: req.user.sub }, include: { spec: true } });
    if (!vehicle) return reply.code(404).send({ error: "Véhicule introuvable." });
    if (vehicle.spec?.status !== "FAILED") return reply.code(409).send({ error: "Recherche déjà terminée ou en cours." });

    await prisma.vehicleSpec.update({ where: { vin: vehicle.vin }, data: { status: "PENDING", error: null } });
    await enqueueVinResearch(vehicle.vin);
    return reply.code(202).send({ ok: true });
  });

  app.delete("/vehicles/:id", async (req, reply) => {
    const { id } = IdParams.parse(req.params);
    const { count } = await prisma.vehicle.deleteMany({ where: { id, userId: req.user.sub } });
    if (count === 0) return reply.code(404).send({ error: "Véhicule introuvable." });
    return reply.code(204).send();
  });
}
