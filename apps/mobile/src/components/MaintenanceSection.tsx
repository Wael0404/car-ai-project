import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Body, Button, Card, Field } from "@/components/ui";
import { useTheme } from "@/lib/theme";
import type { MaintenanceItem } from "@/lib/types";
import { useMaintenance, useMarkMaintenanceDone, useUpdateVehicle } from "@/lib/vehicles";

const ACTION: Record<MaintenanceItem["action"], string> = {
  remplacer: "Remplacer",
  controler: "Contrôler",
  vidanger: "Vidanger",
  nettoyer: "Nettoyer",
};

const km = (n: number) => `${n.toLocaleString("fr-FR")} km`;
const date = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

function dueText(item: MaintenanceItem): string {
  // Timing belt/chain never marked done: we cannot assume it was changed.
  if (item.unknownHistory && item.category === "distribution") {
    return "Jamais indiqué comme fait : à vérifier dès maintenant";
  }
  const parts: string[] = [];
  if (item.nextDueKm !== null) {
    parts.push(
      item.kmLeft !== null && item.kmLeft <= 0
        ? `dépassé de ${km(-item.kmLeft)} (prévu à ${km(item.nextDueKm)})`
        : `à ${km(item.nextDueKm)} (dans ${km(item.kmLeft ?? 0)})`,
    );
  }
  if (item.nextDueDate) parts.push(`avant le ${date(item.nextDueDate)}`);
  return parts.join(" ou ") || "Selon contrôle";
}

function interval(item: MaintenanceItem): string {
  const parts = [];
  if (item.intervalKm) parts.push(`tous les ${km(item.intervalKm)}`);
  if (item.intervalMonths) parts.push(`tous les ${item.intervalMonths} mois`);
  return parts.join(" ou ");
}

function ItemRow({ item, vehicleId }: { item: MaintenanceItem; vehicleId: string }) {
  const t = useTheme();
  const done = useMarkMaintenanceDone(vehicleId);
  const color = item.status === "overdue" ? t.danger : item.status === "soon" ? t.warning : t.success;
  return (
    <View style={{ flexDirection: "row", gap: 12, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: t.border }}>
      <View style={{ width: 4, borderRadius: 2, backgroundColor: color }} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ color: t.text, fontSize: 15, fontWeight: "600" }}>
          {ACTION[item.action] ?? ""} · {item.name}
        </Text>
        <Text style={{ color, fontSize: 13 }}>{dueText(item)}</Text>
        <Text style={{ color: t.muted, fontSize: 12 }}>
          {interval(item)}
          {item.lastDoneKm !== null ? ` · fait à ${km(item.lastDoneKm)}` : ""}
        </Text>
        {item.note ? <Text style={{ color: t.muted, fontSize: 12 }}>{item.note}</Text> : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Marquer ${item.name} comme fait`}
        onPress={() => done.mutate({ itemId: item.id })}
        disabled={done.isPending}
        style={{ alignSelf: "center", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: t.border }}
      >
        {done.isPending ? <ActivityIndicator /> : <Text style={{ color: t.primary, fontWeight: "600" }}>Fait</Text>}
      </Pressable>
    </View>
  );
}

const GROUPS: Array<{ status: MaintenanceItem["status"]; title: string }> = [
  { status: "overdue", title: "À faire maintenant" },
  { status: "soon", title: "Bientôt" },
  { status: "ok", title: "Plus tard" },
];

export function MaintenanceSection({ vehicleId, mileageKm }: { vehicleId: string; mileageKm: number | null }) {
  const t = useTheme();
  const { data, isLoading } = useMaintenance(vehicleId, true);
  const update = useUpdateVehicle(vehicleId);
  const [input, setInput] = useState(mileageKm !== null ? String(mileageKm) : "");
  const [showLater, setShowLater] = useState(false);

  const value = Number(input.replace(/\D/g, ""));
  const canSave = input.length > 0 && Number.isFinite(value) && value !== mileageKm;

  return (
    <Card style={{ gap: 12 }}>
      <Text style={{ color: t.text, fontSize: 18, fontWeight: "700" }}>Entretien</Text>

      <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-end" }}>
        <View style={{ flex: 1 }}>
          <Field
            label="Kilométrage actuel"
            value={input}
            onChangeText={(v) => setInput(v.replace(/\D/g, "").slice(0, 7))}
            keyboardType="number-pad"
            placeholder="Ex. 85000"
          />
        </View>
        <View style={{ width: 120 }}>
          <Button
            label="Enregistrer"
            onPress={() => update.mutate({ mileageKm: value })}
            loading={update.isPending}
            disabled={!canSave}
          />
        </View>
      </View>

      {isLoading || data?.status === "PENDING" ? (
        <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
          <ActivityIndicator />
          <Body muted>L'agent prépare le plan d'entretien de votre voiture…</Body>
        </View>
      ) : data?.status === "FAILED" ? (
        <Body muted>Le plan d'entretien n'a pas pu être établi pour cette voiture.</Body>
      ) : mileageKm === null ? (
        <Body muted>Indiquez le kilométrage pour savoir ce qu'il faut changer et quand.</Body>
      ) : (
        <>
          {GROUPS.map((g) => {
            const items = (data?.items ?? []).filter((i) => i.status === g.status);
            if (items.length === 0) return null;
            if (g.status === "ok" && !showLater) {
              return (
                <Pressable key={g.status} onPress={() => setShowLater(true)} accessibilityRole="button">
                  <Text style={{ color: t.primary, fontWeight: "600" }}>Voir les {items.length} entretiens à venir</Text>
                </Pressable>
              );
            }
            return (
              <View key={g.status}>
                <Text style={{ color: t.muted, fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}>
                  {g.title} ({items.length})
                </Text>
                {items.map((i) => (
                  <ItemRow key={i.id} item={i} vehicleId={vehicleId} />
                ))}
              </View>
            );
          })}
          <Text style={{ color: t.muted, fontSize: 11 }}>
            Plan indicatif établi par IA d'après le programme constructeur
            {data?.confidence ? ` (fiabilité : ${data.confidence === "high" ? "élevée" : data.confidence === "medium" ? "moyenne" : "faible"})` : ""}.
            Vérifiez avec le carnet d'entretien ou votre garagiste. {data?.notes ?? ""}
          </Text>
        </>
      )}
    </Card>
  );
}
