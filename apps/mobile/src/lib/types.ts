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
  bodyVariant?: string;
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
  ownerDataCheck?: {
    status: "match" | "conflict" | "not_provided" | "unverifiable";
    explanation: string | null;
  };
  confidence: "high" | "medium" | "low";
  sources: string[];
}

export interface ModelCredit {
  title: string;
  author: string;
  license: string;
  url: string;
}

export type Model3D =
  | { kind: "glb"; url: string; credit: ModelCredit | null; generated?: boolean }
  | {
      kind: "sketchfab";
      uid: string;
      credit: ModelCredit;
      bodyType: BodyType;
      thumbnailUrl: string | null;
      /** false: closest model of the same generation, another version. */
      exact: boolean;
    }
  | { kind: "photos"; bodyType: BodyType; photos: GalleryPhoto[] }
  | { kind: "procedural"; bodyType: BodyType; searching?: boolean };

/** Real photo of the exact version (shown when no artist 3D model exists). */
export interface GalleryPhoto {
  angle: string;
  url: string;
  pageUrl: string;
  author: string;
  license: string;
  title: string;
}

/** What the owner reads on the registration card (carte grise). */
export interface OwnerHints {
  make?: string | null; // Constructeur
  model?: string | null; // Type commercial
  variant?: string | null; // Type constructeur
  firstRegistration?: string | null; // Date de 1re mise en circulation
}

export interface Vehicle {
  id: string;
  vin: string;
  nickname: string | null;
  color: string;
  declared: OwnerHints;
  createdAt: string;
  status: "PENDING" | "READY" | "FAILED";
  profile: VehicleProfile | null;
  model3d: Model3D | null;
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}
