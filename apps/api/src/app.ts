import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { config, isProd } from "./config.js";
import { prisma } from "./lib/db.js";
import { MODELS_DIR, SERVE_MODELS_LOCALLY } from "./lib/model3d.js";
import { redis } from "./lib/redis.js";
import { authRoutes } from "./routes/auth.js";
import { garageRoutes } from "./routes/garages.js";
import { vehicleRoutes } from "./routes/vehicles.js";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: string };
    user: { sub: string };
  }
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: isProd ? "info" : "debug",
      redact: ["req.headers.authorization", "body.refreshToken", "body.code"],
      ...(isProd ? {} : { transport: { target: "pino-pretty" } }),
    },
    trustProxy: true, // behind a load balancer in production
    bodyLimit: 16 * 1024,
  });

  await app.register(helmet);
  await app.register(cors, {
    origin: config.CORS_ORIGINS ? config.CORS_ORIGINS.split(",").map((o) => o.trim()) : false,
  });
  // Shared counters in Redis, so limits hold across all API instances.
  await app.register(rateLimit, { global: true, max: 120, timeWindow: "1 minute", redis });
  await app.register(jwt, { secret: config.JWT_SECRET });

  app.decorate("authenticate", async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify();
    } catch {
      await reply.code(401).send({ error: "Non authentifié." });
    }
  });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ZodError) {
      return reply.code(400).send({ error: "Requête invalide.", details: err.issues });
    }
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    if (status >= 500) req.log.error(err);
    return reply.code(status).send({ error: status >= 500 ? "Erreur interne." : (err as Error).message });
  });

  // Liveness/readiness for the load balancer.
  app.get("/health", { config: { rateLimit: false } }, async () => {
    await prisma.$queryRaw`SELECT 1`;
    await redis.ping();
    return { ok: true };
  });

  // Development only: serve 3D models from apps/api/models (production uses a CDN).
  if (SERVE_MODELS_LOCALLY) {
    await app.register(fastifyStatic, {
      root: MODELS_DIR,
      prefix: "/models/",
      maxAge: "7d",
      immutable: true,
    });
  }

  await app.register(authRoutes, { prefix: "/v1" });
  await app.register(vehicleRoutes, { prefix: "/v1" });
  await app.register(garageRoutes, { prefix: "/v1" });

  return app;
}
