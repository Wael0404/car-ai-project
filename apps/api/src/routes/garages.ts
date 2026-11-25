import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { findGarages } from "../lib/garages.js";

const Query = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
});

/** Garages, parts and tyre shops near the owner (OpenStreetMap, free). */
export async function garageRoutes(app: FastifyInstance) {
  app.addHook("onRequest", app.authenticate);
  app.get("/garages", { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (req, reply) => {
    const { lat, lon } = Query.parse(req.query);
    try {
      return { garages: await findGarages(lat, lon) };
    } catch (err) {
      req.log.warn({ err }, "Garage lookup failed");
      return reply.code(503).send({ error: "Recherche de garages indisponible pour le moment." });
    }
  });
}
