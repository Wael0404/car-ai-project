import * as SecureStore from "expo-secure-store";
import type { CatalogMake, Garage, Maintenance, OilLog, OwnerHints, PartPrices, Report, Tokens, Vehicle, VehicleEvent } from "./types";

/** A service marked done: km and day it was done (default: now), price, note. */
export interface DoneInput {
  km?: number;
  costTnd?: number;
  /** YYYY-MM-DD, for a service entered afterwards (from the paper logbook...). */
  date?: string;
  note?: string;
}

/** Set EXPO_PUBLIC_API_URL in apps/mobile/.env (use your PC's LAN IP on a real phone). */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3100/v1";

const REFRESH_KEY = "carai.refreshToken";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// The access token lives in memory only; the refresh token in the secure
// keychain/keystore of the phone.
let accessToken: string | null = null;
let refreshInFlight: Promise<boolean> | null = null;
let onSignedOut: () => void = () => {};

export function setSignedOutHandler(handler: () => void) {
  onSignedOut = handler;
}

export async function hasStoredSession(): Promise<boolean> {
  return (await SecureStore.getItemAsync(REFRESH_KEY)) !== null;
}

async function saveTokens(tokens: Tokens) {
  accessToken = tokens.accessToken;
  await SecureStore.setItemAsync(REFRESH_KEY, tokens.refreshToken);
}

async function clearTokens() {
  accessToken = null;
  await SecureStore.deleteItemAsync(REFRESH_KEY);
}

async function rawRequest(path: string, init: RequestInit = {}): Promise<Response> {
  // Only announce JSON when there is a body: the API rejects an empty JSON body
  // (DELETE requests would fail with 400).
  const headers: Record<string, string> = init.body !== undefined ? { "content-type": "application/json" } : {};
  if (accessToken) headers.authorization = `Bearer ${accessToken}`;
  return fetch(`${API_URL}${path}`, { ...init, headers: { ...headers, ...(init.headers as object) } });
}

async function parse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new ApiError(res.status, body.error ?? "Erreur réseau.");
  return body as T;
}

/** Refreshes the session once, even if many requests fail at the same time. */
async function refreshSession(): Promise<boolean> {
  refreshInFlight ??= (async () => {
    const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
    if (!refreshToken) return false;
    const res = await rawRequest("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      await clearTokens();
      return false;
    }
    await saveTokens((await res.json()) as Tokens);
    return true;
  })().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

/** Authenticated request: refreshes the access token on 401 and retries once. */
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!accessToken) await refreshSession();
  let res = await rawRequest(path, init);
  if (res.status === 401 && (await refreshSession())) {
    res = await rawRequest(path, init);
  }
  if (res.status === 401) {
    await clearTokens();
    onSignedOut();
  }
  return parse<T>(res);
}

export const api = {
  async requestCode(email: string) {
    await parse(await rawRequest("/auth/code", { method: "POST", body: JSON.stringify({ email }) }));
  },
  async verifyCode(email: string, code: string) {
    const tokens = await parse<Tokens>(
      await rawRequest("/auth/verify", { method: "POST", body: JSON.stringify({ email, code }) }),
    );
    await saveTokens(tokens);
  },
  async restoreSession() {
    return refreshSession();
  },
  async logout() {
    const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
    if (refreshToken) {
      await rawRequest("/auth/logout", { method: "POST", body: JSON.stringify({ refreshToken }) }).catch(() => {});
    }
    await clearTokens();
  },

  listVehicles: () => request<Vehicle[]>("/vehicles"),
  getVehicle: (id: string) => request<Vehicle>(`/vehicles/${id}`),
  addVehicle: (input: { vin: string; nickname?: string; color?: string } & OwnerHints) =>
    request<Vehicle>("/vehicles", { method: "POST", body: JSON.stringify(input) }),
  getMaintenance: (id: string) => request<Maintenance>(`/vehicles/${id}/maintenance`),
  getPartPrices: (id: string, itemId: string) =>
    request<PartPrices>(`/vehicles/${id}/maintenance/${encodeURIComponent(itemId)}/prices`),
  getGarages: (lat: number, lon: number) =>
    request<{ garages: Garage[] }>(`/garages?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`),
  getOilLog: (id: string) => request<OilLog>(`/vehicles/${id}/oil-log`),
  setFuel: (id: string, fuel: string) => request<Vehicle>(`/vehicles/${id}/fuel`, { method: "POST", body: JSON.stringify({ fuel }) }),
  getCatalog: () => request<{ makes: CatalogMake[] }>("/catalog/makes"),
  markMaintenanceDone: (id: string, itemId: string, input: DoneInput) =>
    request<{ ok: true; recordId: string }>(`/vehicles/${id}/maintenance/${encodeURIComponent(itemId)}/done`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  undoMaintenance: (id: string, recordId: string) =>
    request<void>(`/vehicles/${id}/maintenance/records/${recordId}`, { method: "DELETE" }),
  getHistory: (id: string) => request<{ events: VehicleEvent[] }>(`/vehicles/${id}/history`),
  getReport: (id: string) => request<Report>(`/vehicles/${id}/report`),
  updateVehicle: (id: string, input: { nickname?: string; color?: string; mileageKm?: number }) =>
    request<Vehicle>(`/vehicles/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  researchAgain: (id: string, hints: OwnerHints) =>
    request<void>(`/vehicles/${id}/research`, { method: "POST", body: JSON.stringify(hints) }),
  deleteVehicle: (id: string) => request<void>(`/vehicles/${id}`, { method: "DELETE" }),
};
