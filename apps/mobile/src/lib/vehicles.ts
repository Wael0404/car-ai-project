import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
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
    mutationFn: ({ itemId, km, costTnd }: { itemId: string; km?: number; costTnd?: number }) =>
      api.markMaintenanceDone(id, itemId, { km, costTnd }),
    onSuccess: () => invalidateCar(qc, id),
  });
}

/** Shop prices for one maintenance item; polls while the agent is searching. */
export function usePartPrices(vehicleId: string, itemId: string) {
  return useQuery({
    queryKey: ["prices", vehicleId, itemId],
    queryFn: () => api.getPartPrices(vehicleId, itemId),
    refetchInterval: (q) => ((q.state.data as PartPrices | undefined)?.status === "PENDING" ? POLL_MS : false),
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
    qc.invalidateQueries({ queryKey: ["vehicles", id] }),
  ]);
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
