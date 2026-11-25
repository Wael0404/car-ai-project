/**
 * Development helper: prints a 15-minute access token for the owner of a car,
 * to call the API with curl without going through the email code.
 * Usage: npx tsx scripts/dev-token.ts [vehicleId]   (default: most recent car)
 * Prints "<vehicleId> <token>".
 */
import { createSigner } from "fast-jwt";
import { config } from "../src/config.js";
import { prisma } from "../src/lib/db.js";

if (config.NODE_ENV === "production") throw new Error("dev-token is for development only");
const vehicleId = process.argv[2];
const v = vehicleId
  ? await prisma.vehicle.findUniqueOrThrow({ where: { id: vehicleId }, select: { id: true, userId: true } })
  : await prisma.vehicle.findFirstOrThrow({ orderBy: { createdAt: "desc" }, select: { id: true, userId: true } });
const sign = createSigner({ key: config.JWT_SECRET, expiresIn: 15 * 60 * 1000 });
process.stdout.write(`${v.id} ${sign({ sub: v.userId })}`);
await prisma.$disconnect();
