export type BodyType =
  | "sedan"
  | "hatchback"
  | "suv"
  | "pickup"
  | "coupe"
  | "convertible"
  | "wagon"
  | "van"
  | "minivan"
  | "other";

export interface VehicleProfile {
  make: string | null;
  model: string | null;
  trim: string | null;
  generation: string | null;
  modelYear: number | null;
  bodyType: BodyType;
  doors: number | null;
  seats: number | null;
  engine: {
    description: string | null;
    displacementL: number | null;
    cylinders: number | null;
    powerHp: number | null;
    fuelType: string | null;
  };
  transmission: string | null;
  drivetrain: string | null;
  manufacturer: string | null;
  plantCountry: string | null;
  summary: string;
  confidence: "high" | "medium" | "low";
  sources: string[];
}

export type Model3D = { kind: "glb"; url: string } | { kind: "procedural"; bodyType: BodyType };

export interface Vehicle {
  id: string;
  vin: string;
  nickname: string | null;
  color: string;
  createdAt: string;
  status: "PENDING" | "READY" | "FAILED";
  profile: VehicleProfile | null;
  model3d: Model3D | null;
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}
