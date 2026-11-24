import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type { Vehicle } from "./types";

const POLL_MS = 4000;

/** Re-fetch every few seconds while the AI agent is still researching. */
const pollWhilePending = (vehicles: Vehicle[] | Vehicle | undefined) => {
  const list = Array.isArray(vehicles) ? vehicles : vehicles ? [vehicles] : [];
  return list.some((v) => v.status === "PENDING") ? POLL_MS : false;
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
    mutationFn: (input: { nickname?: string; color?: string }) => api.updateVehicle(id, input),
    onSuccess: (vehicle) => {
      qc.setQueryData(["vehicles", id], vehicle);
      void qc.invalidateQueries({ queryKey: ["vehicles"], exact: true });
    },
  });
}

export function useRetryVehicle(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.retryVehicle(id),
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
