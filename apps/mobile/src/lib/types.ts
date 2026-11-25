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
  mileageKm: number | null;
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

export interface MaintenanceItem {
  id: string;
  name: string;
  category: string;
  action: "remplacer" | "controler" | "vidanger" | "nettoyer";
  intervalKm: number | null;
  intervalMonths: number | null;
  note: string;
  status: "overdue" | "soon" | "ok";
  nextDueKm: number | null;
  nextDueDate: string | null;
  kmLeft: number | null;
  lastDoneKm: number | null;
  lastDoneAt: string | null;
  unknownHistory: boolean;
}

export interface Maintenance {
  status: "PENDING" | "READY" | "FAILED";
  mileageKm: number | null;
  notes?: string | null;
  confidence?: string | null;
  items: MaintenanceItem[];
}

export interface PartOffer {
  shop: string;
  product: string;
  priceTnd: number | null;
  url: string;
}

export interface PartPrices {
  status: "PENDING" | "READY" | "FAILED";
  offers: PartOffer[];
  labor: { minTnd: number | null; maxTnd: number | null; note: string } | null;
  note: string | null;
  updatedAt: string;
  item: Pick<MaintenanceItem, "id" | "name" | "category" | "action" | "note">;
  car: string;
}

export interface Garage {
  id: string;
  name: string;
  kind: "car_repair" | "car_parts" | "tyres";
  lat: number;
  lon: number;
  distanceKm: number;
  phone: string | null;
  address: string | null;
  openingHours: string | null;
}

export interface VehicleEvent {
  id: string;
  type:
    | "vehicle_added"
    | "analysis_ready"
    | "mileage_updated"
    | "maintenance_done"
    | "maintenance_undone"
    | "color_changed"
    | "nickname_changed"
    | "info_corrected";
  data: Record<string, unknown> | null;
  date: string;
}

export interface Report {
  totals: { spentTnd: number; servicesDone: number; avgKmPerMonth: number | null; lastMileageKm: number | null };
  mileage: Array<{ date: string; km: number }>;
  spendByMonth: Array<{ month: string; totalTnd: number }>;
  spendByCategory: Array<{ category: string; totalTnd: number; count: number }>;
  records: Array<{ id: string; itemId: string; itemName: string | null; category: string | null; km: number; costTnd: number | null; date: string }>;
}
