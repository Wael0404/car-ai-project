import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { DoneSheet } from "@/components/DoneSheet";
import { RobotGuide } from "@/components/Robot";
import { Button, Card, Field, Pill, SectionTitle, Skeleton, Txt, type IconName } from "@/components/ui";
import { dateFr, km } from "@/lib/format";
import { font, radius, space, useTheme } from "@/lib/theme";
import type { Maintenance, MaintenanceItem } from "@/lib/types";
import { useUpdateVehicle } from "@/lib/vehicles";

const ACTION: Record<MaintenanceItem["action"], string> = {
  remplacer: "Remplacer",
  controler: "Contrôler",
  vidanger: "Vidanger",
  nettoyer: "Nettoyer",
};

export const CATEGORY_LABEL: Record<string, string> = {
  moteur: "Moteur",
  filtres: "Filtres",
  distribution: "Distribution",
  allumage: "Allumage",
  freinage: "Freinage",
  refroidissement: "Refroidissement",
  transmission: "Transmission",
  pneus: "Pneus",
  climatisation: "Climatisation",
  electricite: "Électricité",
  autre: "Autre",
};

export const CATEGORY_ICON: Record<string, IconName> = {
  moteur: "color-fill-outline",
  filtres: "funnel-outline",
  distribution: "cog-outline",
  allumage: "flash-outline",
  freinage: "disc-outline",
  refroidissement: "thermometer-outline",
  transmission: "settings-outline",
  pneus: "radio-button-on-outline",
  climatisation: "snow-outline",
  electricite: "battery-charging-outline",
  autre: "build-outline",
};

function dueText(item: MaintenanceItem): string {
  // Timing belt/chain never marked done: we cannot assume it was changed.
  if (item.unknownHistory && item.category === "distribution") return "Jamais indiqué comme fait : à vérifier maintenant";
  const parts: string[] = [];
  if (item.nextDueKm !== null) {
    parts.push(
      item.kmLeft !== null && item.kmLeft <= 0
        ? `Dépassé de ${km(-item.kmLeft)}`
        : `Dans ${km(item.kmLeft ?? 0)} (à ${km(item.nextDueKm)})`,
    );
  }
  if (item.nextDueDate) parts.push(`avant le ${dateFr(item.nextDueDate)}`);
  return parts.join(" ou ") || "Selon contrôle";
}

function interval(item: MaintenanceItem): string {
  const parts = [];
  if (item.intervalKm) parts.push(`tous les ${km(item.intervalKm)}`);
  if (item.intervalMonths) parts.push(`tous les ${item.intervalMonths} mois`);
  return parts.join(" ou ");
}

const openItem = (vehicleId: string, itemId: string) =>
  router.push({ pathname: "/maintenance/[vehicleId]/[itemId]", params: { vehicleId, itemId } });

function ItemCard({ item, vehicleId, mileageKm }: { item: MaintenanceItem; vehicleId: string; mileageKm: number | null }) {
  const t = useTheme();
  const [asking, setAsking] = useState(false);
  const tone = item.status === "overdue" ? t.danger : item.status === "soon" ? t.warning : t.success;
  const soft = item.status === "overdue" ? t.dangerSoft : item.status === "soon" ? t.warningSoft : t.successSoft;

  return (
    <Card style={{ gap: space.md }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.name}. ${dueText(item)}. Voir les prix et les garages`}
        onPress={() => openItem(vehicleId, item.id)}
        style={{ flexDirection: "row", gap: space.md }}
      >
        <View style={{ width: 44, height: 44, borderRadius: radius.md, backgroundColor: soft, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name={CATEGORY_ICON[item.category] ?? "build-outline"} size={22} color={tone} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt variant="bodyStrong">{item.name}</Txt>
          <Txt variant="caption" style={{ color: tone }}>
            {ACTION[item.action] ?? ""} · {dueText(item)}
          </Txt>
          <Txt variant="micro" tone="muted">
            {interval(item)}
            {item.lastDoneKm !== null ? ` · fait à ${km(item.lastDoneKm)}` : ""}
          </Txt>
        </View>
        <Ionicons name="chevron-forward" size={20} color={t.muted} style={{ alignSelf: "center" }} />
      </Pressable>
      {item.note ? (
        <Txt variant="caption" tone="muted">
          {item.note}
        </Txt>
      ) : null}
      <View style={{ flexDirection: "row", gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <Button label="Prix et garages" icon="pricetags-outline" variant="secondary" size="md" onPress={() => openItem(vehicleId, item.id)} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label="C'est fait" icon="checkmark-done-outline" variant="ghost" size="md" onPress={() => setAsking(true)} />
        </View>
      </View>
      {asking ? (
        <DoneSheet vehicleId={vehicleId} itemId={item.id} itemName={item.name} currentKm={mileageKm} onClose={() => setAsking(false)} />
      ) : null}
    </Card>
  );
}

function MileageCard({ vehicleId, mileageKm }: { vehicleId: string; mileageKm: number | null }) {
  const t = useTheme();
  const update = useUpdateVehicle(vehicleId);
  const [editing, setEditing] = useState(mileageKm === null);
  const [input, setInput] = useState(mileageKm !== null ? String(mileageKm) : "");
  const value = Number(input);
  const valid = input.length > 0 && Number.isFinite(value);

  if (!editing && mileageKm !== null) {
    return (
      <Card style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
        <View style={{ width: 44, height: 44, borderRadius: radius.md, backgroundColor: t.primarySoft, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="speedometer-outline" size={22} color={t.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Txt variant="caption" tone="muted">
            Kilométrage
          </Txt>
          <Txt variant="title" style={{ fontVariant: ["tabular-nums"] }}>
            {km(mileageKm)}
          </Txt>
        </View>
        <View style={{ width: 120 }}>
          <Button label="Modifier" icon="create-outline" variant="ghost" size="md" onPress={() => setEditing(true)} />
        </View>
      </Card>
    );
  }
  return (
    <Card>
      <Field
        label="Kilométrage actuel du compteur"
        icon="speedometer-outline"
        value={input}
        onChangeText={(v) => setInput(v.replace(/\D/g, "").slice(0, 7))}
        keyboardType="number-pad"
        placeholder="Ex. 85000"
        helper="Mettez-le à jour de temps en temps pour garder un suivi juste."
      />
      <Button
        label="Enregistrer"
        icon="save-outline"
        loading={update.isPending}
        disabled={!valid}
        onPress={() =>
          update.mutate(
            { mileageKm: value },
            {
              onSuccess: () => {
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                setEditing(false);
              },
            },
          )
        }
      />
      {update.error ? (
        <Txt tone="danger" accessibilityLiveRegion="polite">
          Pas enregistré : {update.error.message}
        </Txt>
      ) : null}
      {mileageKm !== null ? <Button label="Annuler" variant="ghost" size="md" onPress={() => setEditing(false)} /> : null}
    </Card>
  );
}

const GROUPS: Array<{ status: MaintenanceItem["status"]; title: string }> = [
  { status: "overdue", title: "À faire maintenant" },
  { status: "soon", title: "Bientôt" },
  { status: "ok", title: "Plus tard" },
];

export function MaintenanceSection({
  vehicleId,
  mileageKm,
  data,
  loading,
  error,
  onRetry,
}: {
  vehicleId: string;
  mileageKm: number | null;
  data: Maintenance | undefined;
  loading: boolean;
  error?: Error | null;
  onRetry?: () => void;
}) {
  const [showLater, setShowLater] = useState(false);
  const items = data?.items ?? [];
  const count = (s: MaintenanceItem["status"]) => items.filter((i) => i.status === s).length;

  return (
    <View style={{ gap: space.lg }}>
      <MileageCard key={String(mileageKm)} vehicleId={vehicleId} mileageKm={mileageKm} />

      {error && !data ? (
        <RobotGuide mood="alert" title="Connexion impossible" action={onRetry ? { label: "Réessayer", onPress: onRetry } : undefined}>
          Je n'arrive pas à charger le plan d'entretien. Vérifiez votre connexion internet.
        </RobotGuide>
      ) : loading || data?.status === "PENDING" ? (
        <View style={{ gap: space.md }}>
          <Skeleton height={110} />
          <Skeleton height={110} />
        </View>
      ) : data?.status === "FAILED" ? (
        <RobotGuide mood="alert" title="Plan d'entretien indisponible">
          Je n'ai pas trouvé de programme d'entretien fiable pour cette version. Vérifiez les infos dans l'onglet Réglages,
          puis relancez la recherche.
        </RobotGuide>
      ) : mileageKm === null ? null : (
        <>
          <View style={{ flexDirection: "row", gap: space.sm, flexWrap: "wrap" }}>
            <Pill label={`${count("overdue")} à faire`} tone={count("overdue") ? "danger" : "neutral"} icon="alert-circle" />
            <Pill label={`${count("soon")} bientôt`} tone={count("soon") ? "warning" : "neutral"} icon="time" />
            <Pill label={`${count("ok")} plus tard`} tone="success" icon="checkmark-circle" />
          </View>

          {GROUPS.map((g) => {
            const list = items.filter((i) => i.status === g.status);
            if (list.length === 0) return null;
            const hidden = g.status === "ok" && !showLater;
            return (
              <View key={g.status} style={{ gap: space.md }}>
                <SectionTitle
                  action={
                    g.status === "ok" ? (
                      <Pressable onPress={() => setShowLater(!showLater)} accessibilityRole="button" hitSlop={10}>
                        <Txt variant="caption" tone="primary" style={{ fontFamily: font.semibold }}>
                          {showLater ? "Masquer" : "Afficher"}
                        </Txt>
                      </Pressable>
                    ) : undefined
                  }
                >
                  {g.title} ({list.length})
                </SectionTitle>
                {!hidden && list.map((i) => <ItemCard key={i.id} item={i} vehicleId={vehicleId} mileageKm={mileageKm} />)}
              </View>
            );
          })}

          <Txt variant="micro" tone="muted">
            Plan indicatif établi par IA d'après le programme constructeur
            {data?.confidence ? ` (fiabilité ${data.confidence === "high" ? "élevée" : data.confidence === "medium" ? "moyenne" : "faible"})` : ""}.
            Vérifiez avec le carnet d'entretien ou votre garagiste.
          </Txt>
        </>
      )}
    </View>
  );
}
