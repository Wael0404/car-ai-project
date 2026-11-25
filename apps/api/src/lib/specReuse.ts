import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "./db.js";
import type { OwnerHints } from "./queue.js";

/** "312pxg110  p2f" -> "312PXG110 P2F": one spelling for the registration codes. */
export function normalizeCode(value: string | null | undefined): string | undefined {
  const v = value?.trim().replace(/\s+/g, " ").toUpperCase();
  return v ? v : undefined;
}

const yearOf = (date: string | null | undefined) => date?.match(/\b(19|20)\d{2}\b/)?.[0];

/**
 * Free shortcut before the AI agent: another owner already registered a car
 * with the same make, the same type constructeur (registration type code) and
 * the same first-registration year, and its profile is ready. Same type code
 * means same version, so its profile is reused without any Claude call.
 */
export async function findReusableProfile(vin: string, hints?: OwnerHints): Promise<Prisma.JsonValue | null> {
  const variant = normalizeCode(hints?.variant);
  const make = normalizeCode(hints?.make);
  const year = yearOf(hints?.firstRegistration);
  if (!variant || !make || !year) return null;

  const candidates = await prisma.vehicle.findMany({
    where: {
      declaredVariant: variant,
      declaredMake: make,
      vin: { not: vin },
      spec: { status: "READY" },
    },
    select: { firstRegistration: true, spec: { select: { data: true } } },
    take: 20,
  });
  const match = candidates.find((c) => yearOf(c.firstRegistration) === year && c.spec.data);
  return match?.spec.data ?? null;
}
