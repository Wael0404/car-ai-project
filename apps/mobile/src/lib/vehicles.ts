import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, type DoneInput } from "./api";
import type { Maintenance, OwnerHints, PartPrices, Vehicle } from "./types";

const POLL_MS = 4000;

/** Re-fetch every few seconds while the AI agent is still researching. */
const pollWhilePending = (vehicles: Vehicle[] | Vehicle | undefined) => {
  const list = Array.isArray(vehicles) ? vehicles : vehicles ? [vehicles] : [];
  const busy = (v: Vehicle) =>
    v.status === "PENDING" || (v.model3d?.kind === "procedural" && v.model3d.searching === true);
  return list.some(busy) ? POLL_MS : false;
};

export function useVehicles() {
  return useQuery({
    queryKey: ["vehicles"],
    queryFn: api.listVehicles,
    refetchInterval: (q) => pollWhilePending(q.state.data),
  });
}

export function useVehicle(id: string) {
  return useQuery({
    queryKey: ["vehicles", id],
    queryFn: () => api.getVehicle(id),
    refetchInterval: (q) => pollWhilePending(q.state.data),
  });
}

export function useAddVehicle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.addVehicle,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vehicles"] }),
  });
}

export function useUpdateVehicle(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { nickname?: string; color?: string; mileageKm?: number }) => api.updateVehicle(id, input),
    onSuccess: (vehicle) => {
      qc.setQueryData(["vehicles", id], vehicle);
      void qc.invalidateQueries({ queryKey: ["vehicles"], exact: true });
      void invalidateCar(qc, id);
    },
  });
}

export function useResearchAgain(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (hints: OwnerHints) => api.researchAgain(id, hints),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vehicles"] }),
  });
}

export function useDeleteVehicle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteVehicle,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vehicles"] }),
  });
}

/** Maintenance plan of a car; polls while the agent is still building it. */
export function useMaintenance(id: string, enabled: boolean) {
  return useQuery({
    queryKey: ["maintenance", id],
    queryFn: () => api.getMaintenance(id),
    enabled,
    refetchInterval: (q) => ((q.state.data as Maintenance | undefined)?.status === "PENDING" ? POLL_MS : false),
  });
}

export function useMarkMaintenanceDone(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, ...input }: { itemId: string } & DoneInput) => api.markMaintenanceDone(id, itemId, input),
    onSuccess: () => invalidateCar(qc, id),
  });
}

/** Shop prices for one maintenance item; polls while the agent is searching. */
/** Photos/references normally arrive in a few seconds; never poll for them longer than this. */
const ENRICH_POLL_LIMIT_MS = 90_000;

export function usePartPrices(vehicleId: string, itemId: string) {
  const [openedAt] = useState(() => Date.now());
  const enrichTimedOut = () => Date.now() - openedAt > ENRICH_POLL_LIMIT_MS;
  return useQuery({
    queryKey: ["prices", vehicleId, itemId],
    queryFn: () => api.getPartPrices(vehicleId, itemId),
    // Poll while the agent searches, and while photos/references are being added.
    refetchInterval: (q) => {
      const p = q.state.data as PartPrices | undefined;
      if (p?.status === "PENDING") return POLL_MS;
      return p?.enriching && !enrichTimedOut() ? 2500 : false;
    },
    // Past the limit, stop showing placeholders as "loading".
    select: (p) => (p.enriching && enrichTimedOut() ? { ...p, enriching: false } : p),
  });
}

export function useGarages(coords: { lat: number; lon: number } | null) {
  return useQuery({
    queryKey: ["garages", coords?.lat.toFixed(2), coords?.lon.toFixed(2)],
    queryFn: () => api.getGarages(coords!.lat, coords!.lon),
    enabled: coords !== null,
    staleTime: 3600_000,
  });
}

/** Everything derived from a car's history must refresh after a change. */
function invalidateCar(qc: ReturnType<typeof useQueryClient>, id: string) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: ["maintenance", id] }),
    qc.invalidateQueries({ queryKey: ["history", id] }),
    qc.invalidateQueries({ queryKey: ["report", id] }),
    qc.invalidateQueries({ queryKey: ["oil-log", id] }),
    qc.invalidateQueries({ queryKey: ["vehicles", id] }),
  ]);
}

export function useOilLog(id: string) {
  return useQuery({ queryKey: ["oil-log", id], queryFn: () => api.getOilLog(id) });
}

export function useHistory(id: string) {
  return useQuery({ queryKey: ["history", id], queryFn: () => api.getHistory(id) });
}

export function useReport(id: string) {
  return useQuery({ queryKey: ["report", id], queryFn: () => api.getReport(id) });
}

export function useUndoMaintenance(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (recordId: string) => api.undoMaintenance(id, recordId),
    onSuccess: () => invalidateCar(qc, id),
  });
}
