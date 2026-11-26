import type { FastifyInstance } from "fastify";
import { buildCatalog, type CatalogMake } from "../lib/carCatalog.js";
import { prisma } from "../lib/db.js";

const TTL_MS = 60 * 60 * 1000;
let cache: { at: number; makes: CatalogMake[] } | null = null;

/** Makes and commercial types for the app's drop-down lists (no AI). */
export async function catalogRoutes(app: FastifyInstance) {
  app.addHook("onRequest", app.authenticate);
  app.get("/catalog/makes", async (_req, reply) => {
    if (!cache || Date.now() - cache.at > TTL_MS) {
      // What our users' cars are (identified by the agent, or read on the card).
      const [specs, declared] = await Promise.all([
        prisma.vehicleSpec.findMany({ where: { status: "READY" }, select: { data: true }, take: 20_000 }),
        prisma.vehicle.findMany({
          where: { declaredMake: { not: null } },
          select: { declaredMake: true, declaredModel: true },
          distinct: ["declaredMake", "declaredModel"],
          take: 20_000,
        }),
      ]);
      const seen = [
        ...specs.map((s) => {
          const d = (s.data ?? {}) as { make?: string | null; model?: string | null };
          return { make: d.make, model: d.model };
        }),
        ...declared.map((v) => ({ make: v.declaredMake, model: v.declaredModel })),
      ];
      cache = { at: Date.now(), makes: buildCatalog(seen) };
    }
    void reply.header("cache-control", "private, max-age=3600");
    return { makes: cache.makes };
  });
}
