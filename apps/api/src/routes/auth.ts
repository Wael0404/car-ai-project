import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { config } from "../config.js";
import { prisma } from "../lib/db.js";
import { sendLoginCode } from "../lib/mailer.js";
import { redis } from "../lib/redis.js";

const CODE_TTL_S = 10 * 60;
const MAX_ATTEMPTS = 5;
const MAX_CODES_PER_HOUR = 5;
const ACCESS_TTL = "15m";
const REFRESH_TTL_MS = 30 * 24 * 3600 * 1000;

const EmailBody = z.object({ email: z.email().max(254).transform((e) => e.trim().toLowerCase()) });
const VerifyBody = EmailBody.extend({ code: z.string().regex(/^\d{6}$/) });
const RefreshBody = z.object({ refreshToken: z.string().min(20).max(200) });

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
// Codes are stored as an HMAC, never in clear text.
const hashCode = (email: string, code: string) =>
  createHmac("sha256", config.JWT_SECRET).update(`${email}:${code}`).digest();

async function issueTokens(app: FastifyInstance, userId: string) {
  const accessToken = app.jwt.sign({ sub: userId }, { expiresIn: ACCESS_TTL });
  const refreshToken = randomBytes(48).toString("base64url");
  await prisma.refreshToken.create({
    data: { userId, tokenHash: sha256(refreshToken), expiresAt: new Date(Date.now() + REFRESH_TTL_MS) },
  });
  return { accessToken, refreshToken };
}

export async function authRoutes(app: FastifyInstance) {
  // Strict per-IP limit on top of the global one.
  const strict = { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } };

  /** Sends a 6-digit login code. Same answer whether the email exists or not. */
  app.post("/auth/code", strict, async (req, reply) => {
    const { email } = EmailBody.parse(req.body);

    const rateKey = `otp:rate:${sha256(email)}`;
    const count = await redis.incr(rateKey);
    if (count === 1) await redis.expire(rateKey, 3600);
    if (count > MAX_CODES_PER_HOUR) {
      return reply.code(429).send({ error: "Trop de demandes de code. Réessayez plus tard." });
    }

    const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
    await redis.set(
      `otp:${sha256(email)}`,
      JSON.stringify({ hash: hashCode(email, code).toString("hex"), attempts: 0 }),
      "EX",
      CODE_TTL_S,
    );
    await sendLoginCode(email, code, req.log);
    return reply.code(202).send({ ok: true });
  });

  /** Checks the code, creates the account on first login, returns tokens. */
  app.post("/auth/verify", strict, async (req, reply) => {
    const { email, code } = VerifyBody.parse(req.body);
    const key = `otp:${sha256(email)}`;
    const stored = await redis.get(key);
    const invalid = () => reply.code(401).send({ error: "Code invalide ou expiré." });
    if (!stored) return invalid();

    const entry = JSON.parse(stored) as { hash: string; attempts: number };
    const expected = Buffer.from(entry.hash, "hex");
    const given = hashCode(email, code);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
      entry.attempts += 1;
      if (entry.attempts >= MAX_ATTEMPTS) await redis.del(key);
      else await redis.set(key, JSON.stringify(entry), "KEEPTTL");
      return invalid();
    }

    await redis.del(key); // single use
    const user = await prisma.user.upsert({ where: { email }, update: {}, create: { email } });
    return issueTokens(app, user.id);
  });

  /** Rotates the refresh token: the old one stops working. */
  app.post("/auth/refresh", strict, async (req, reply) => {
    const { refreshToken } = RefreshBody.parse(req.body);
    const tokenHash = sha256(refreshToken);
    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!stored || stored.expiresAt < new Date()) {
      return reply.code(401).send({ error: "Session expirée." });
    }
    if (stored.revokedAt) {
      // A revoked token was reused: it may have been stolen. Log out everywhere.
      await prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return reply.code(401).send({ error: "Session expirée." });
    }

    await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    return issueTokens(app, stored.userId);
  });

  app.post("/auth/logout", async (req, reply) => {
    const { refreshToken } = RefreshBody.parse(req.body);
    await prisma.refreshToken.updateMany({
      where: { tokenHash: sha256(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return reply.code(204).send();
  });
}
