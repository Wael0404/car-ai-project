import { z } from "zod";

export const BODY_TYPES = [
  "sedan",
  "hatchback",
  "suv",
  "pickup",
  "coupe",
  "convertible",
  "wagon",
  "van",
  "minivan",
  "other",
] as const;

export type BodyType = (typeof BODY_TYPES)[number];

/** The structured profile the agent returns for one VIN. */
export const VehicleProfileSchema = z.object({
  make: z.string().nullable().describe("Brand, e.g. Volkswagen"),
  model: z.string().nullable().describe("Model, e.g. Golf"),
  trim: z.string().nullable().describe("Trim / version, e.g. 1.6 TDI Highline"),
  generation: z.string().nullable().describe("Generation or chassis code, e.g. Mk7 / 5G"),
  modelYear: z.number().int().nullable(),
  bodyType: z.enum(BODY_TYPES),
  doors: z.number().int().nullable(),
  seats: z.number().int().nullable(),
  engine: z.object({
    description: z.string().nullable().describe("e.g. 1.6 TDI 4 cylinders"),
    displacementL: z.number().nullable(),
    cylinders: z.number().int().nullable(),
    powerHp: z.number().int().nullable(),
    fuelType: z.string().nullable().describe("e.g. Diesel, Essence, Hybride, Électrique"),
  }),
  transmission: z.string().nullable(),
  drivetrain: z.string().nullable().describe("e.g. Traction, Propulsion, 4x4"),
  manufacturer: z.string().nullable(),
  plantCountry: z.string().nullable(),
  summary: z.string().describe("2 or 3 sentences in French describing the vehicle"),
  ownerDataCheck: z.object({
    status: z.enum(["match", "conflict", "not_provided", "unverifiable"]),
    explanation: z
      .string()
      .nullable()
      .describe("In French, for the owner: what the VIN says versus what they declared"),
  }),
  confidence: z.enum(["high", "medium", "low"]),
  sources: z.array(z.string()).describe("URLs used, NHTSA included when it was useful"),
});

export type VehicleProfile = z.infer<typeof VehicleProfileSchema>;
