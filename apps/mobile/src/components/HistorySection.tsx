import { Ionicons } from "@expo/vector-icons";
import { useState, type ReactNode } from "react";
import { Alert, Pressable, View } from "react-native";
import { BarChart, LineChart, RankBars } from "@/components/charts";
import { CATEGORY_ICON, CATEGORY_LABEL } from "@/components/MaintenanceSection";
import { RobotGuide } from "@/components/Robot";
import { Card, SectionTitle, Skeleton, Txt, type IconName } from "@/components/ui";
import { km, tnd } from "@/lib/format";
import { font, radius, space, useTheme, PAINT_COLORS } from "@/lib/theme";
import type { Report, VehicleEvent } from "@/lib/types";
import { useHistory, useReport, useUndoMaintenance } from "@/lib/vehicles";

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

const two = (n: number) => String(n).padStart(2, "0");
const dayFr = (d: Date) => `${two(d.getDate())}/${two(d.getMonth() + 1)}/${d.getFullYear()}`;
const dateTimeFr = (iso: string) => {
  const d = new Date(iso);
  return `${dayFr(d)} à ${two(d.getHours())}:${two(d.getMinutes())}`;
};
const shortDay = (ms: number) => {
  const d = new Date(ms);
  return `${two(d.getDate())}/${two(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)}`;
};
const kmTick = (v: number) => (Math.abs(v) >= 10_000 ? `${Math.round(v / 1000)} k` : v.toLocaleString("fr-FR"));
const dtTick = (v: number) => v.toLocaleString("fr-FR", { maximumFractionDigits: 0 });
const colorName = (hex: unknown) => PAINT_COLORS.find((c) => c.hex === hex)?.name ?? "personnalisée";

/** Human sentence + icon for each kind of change. */
function describe(e: VehicleEvent): { icon: IconName; title: string; detail?: string } {
  const d = (e.data ?? {}) as Record<string, unknown>;
  const n = (v: unknown) => (typeof v === "number" ? v : null);
  switch (e.type) {
    case "vehicle_added":
      return { icon: "add-circle-outline", title: "Voiture ajoutée", detail: typeof d.vin === "string" ? `VIN ${d.vin}` : undefined };
    case "analysis_ready":
      return {
        icon: "sparkles-outline",
        title: "Analyse terminée",
        detail: [d.make, d.model].filter((x) => typeof x === "string").join(" ") || undefined,
      };
    case "mileage_updated": {
      const from = n(d.fromKm);
      const to = n(d.toKm);
      return {
        icon: "speedometer-outline",
        title: "Kilométrage mis à jour",
        detail: to === null ? undefined : from === null ? km(to) : `${km(from)} → ${km(to)}`,
      };
    }
    case "maintenance_done": {
      const cost = n(d.costTnd);
      const at = n(d.km);
      return {
        icon: CATEGORY_ICON[String(d.category)] ?? "checkmark-done-outline",
        title: `${typeof d.itemName === "string" ? d.itemName : "Entretien"} : fait`,
        detail: [at !== null ? `à ${km(at)}` : null, cost !== null ? tnd(cost) : null].filter(Boolean).join(" · ") || undefined,
      };
    }
    case "maintenance_undone":
      return {
        icon: "arrow-undo-outline",
        title: "Entretien annulé",
        detail: typeof d.itemName === "string" ? d.itemName : undefined,
      };
    case "color_changed":
      return { icon: "color-palette-outline", title: "Couleur changée", detail: `${colorName(d.from)} → ${colorName(d.to)}` };
    case "nickname_changed":
      return { icon: "pricetag-outline", title: "Surnom changé", detail: typeof d.to === "string" ? d.to : undefined };
    case "info_corrected":
      return { icon: "document-text-outline", title: "Infos de la carte grise corrigées", detail: "Nouvelle recherche lancée" };
    default:
      return { icon: "ellipse-outline", title: "Modification" };
  }
}

function Tile({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  const t = useTheme();
  return (
    <Card style={{ flexBasis: "47%", flexGrow: 1, gap: space.sm }}>
      <View accessible accessibilityLabel={`${label} : ${value}`} style={{ gap: space.sm }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Ionicons name={icon} size={16} color={t.muted} />
          <Txt variant="caption" tone="muted">
            {label}
          </Txt>
        </View>
        <Txt variant="title" style={{ fontVariant: ["tabular-nums"] }} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Txt>
      </View>
    </Card>
  );
}

function Totals({ r }: { r: Report }) {
  const x = r.totals;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.md }}>
      <Tile icon="wallet-outline" label="Dépensé" value={tnd(x.spentTnd)} />
      <Tile icon="checkmark-done-outline" label="Entretiens faits" value={String(x.servicesDone)} />
      <Tile icon="trending-up-outline" label="Moyenne par mois" value={x.avgKmPerMonth !== null ? km(x.avgKmPerMonth) : "—"} />
      <Tile icon="speedometer-outline" label="Dernier relevé" value={x.lastMileageKm !== null ? km(x.lastMileageKm) : "—"} />
    </View>
  );
}

/** Figures behind a chart, for screen readers and anyone who prefers a list. */
function DataList({ rows }: { rows: Array<{ key: string; label: string; value: string }> }) {
  const t = useTheme();
  return (
    <View>
      {rows.map((row) => (
        <View
          key={row.key}
          accessible
          style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: t.border }}
        >
          <Txt variant="caption" tone="muted">
            {row.label}
          </Txt>
          <Txt variant="caption" style={{ fontFamily: font.semibold, fontVariant: ["tabular-nums"] }}>
            {row.value}
          </Txt>
        </View>
      ))}
    </View>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
  rows,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  rows: Array<{ key: string; label: string; value: string }>;
}) {
  const [showList, setShowList] = useState(false);
  return (
    <Card style={{ gap: space.md }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space.md }}>
        <View style={{ flex: 1 }}>
          <Txt variant="bodyStrong" accessibilityRole="header">
            {title}
          </Txt>
          <Txt variant="caption" tone="muted">
            {subtitle}
          </Txt>
        </View>
        <Pressable accessibilityRole="button" hitSlop={10} onPress={() => setShowList(!showList)} style={{ minHeight: 32, justifyContent: "center" }}>
          <Txt variant="caption" tone="primary" style={{ fontFamily: font.semibold }}>
            {showList ? "Graphique" : "Chiffres"}
          </Txt>
        </Pressable>
      </View>
      {showList ? <DataList rows={rows} /> : children}
    </Card>
  );
}

function Charts({ r }: { r: Report }) {
  const mileagePts = r.mileage.map((p) => ({ x: new Date(p.date).getTime(), y: p.km }));
  const hasSpend = r.spendByMonth.some((m) => m.totalTnd > 0);
  const bars = r.spendByMonth.map((m) => {
    const [y, mo] = m.month.split("-").map(Number);
    const name = MONTHS[(mo ?? 1) - 1]!;
    return { key: m.month, label: name.charAt(0).toUpperCase(), longLabel: `${name} ${y}`, value: m.totalTnd };
  });

  return (
    <View style={{ gap: space.lg }}>
      {mileagePts.length >= 2 ? (
        <ChartCard
          title="Kilométrage"
          subtitle="Chaque relevé du compteur. Touchez un point pour voir la valeur."
          rows={[...r.mileage].reverse().map((p) => ({ key: p.date, label: dayFr(new Date(p.date)), value: km(p.km) }))}
        >
          <LineChart
            points={mileagePts}
            formatY={km}
            formatTick={kmTick}
            formatX={shortDay}
            accessibilityLabel={`Courbe du kilométrage : de ${km(mileagePts[0]!.y)} à ${km(mileagePts.at(-1)!.y)}`}
          />
        </ChartCard>
      ) : (
        <RobotGuide mood="happy" compact>
          Mettez à jour le kilométrage de temps en temps : je dessinerai ici son évolution et votre moyenne par mois.
        </RobotGuide>
      )}

      {hasSpend ? (
        <ChartCard
          title="Dépenses d'entretien"
          subtitle="Les 12 derniers mois, en dinars. Touchez un mois pour voir le montant."
          rows={[...bars].reverse().filter((b) => b.value > 0).map((b) => ({ key: b.key, label: b.longLabel, value: tnd(b.value) }))}
        >
          <BarChart
            bars={bars}
            formatValue={tnd}
            formatTick={dtTick}
            accessibilityLabel={`Dépenses par mois sur 12 mois, total ${tnd(r.totals.spentTnd)}`}
          />
        </ChartCard>
      ) : (
        <RobotGuide mood="happy" compact>
          Quand vous touchez « C'est fait », indiquez le prix payé : je vous montrerai vos dépenses mois par mois.
        </RobotGuide>
      )}

      {r.spendByCategory.length > 0 && (
        <Card style={{ gap: space.md }}>
          <View>
            <Txt variant="bodyStrong" accessibilityRole="header">
              Par type d'entretien
            </Txt>
            <Txt variant="caption" tone="muted">
              Montant total et nombre d'interventions
            </Txt>
          </View>
          <RankBars
            formatValue={tnd}
            rows={r.spendByCategory.map((c) => ({
              key: c.category,
              label: CATEGORY_LABEL[c.category] ?? c.category,
              value: c.totalTnd,
              sub: `${c.count} fois`,
            }))}
          />
        </Card>
      )}
    </View>
  );
}

function Timeline({ vehicleId, events, undoable }: { vehicleId: string; events: VehicleEvent[]; undoable: Set<string> }) {
  const t = useTheme();
  const undo = useUndoMaintenance(vehicleId);
  const [all, setAll] = useState(false);
  const shown = all ? events : events.slice(0, 15);

  function confirmUndo(recordId: string, name: string) {
    Alert.alert("Annuler cet entretien ?", `« ${name} » ne sera plus compté comme fait. L'annulation reste visible dans l'historique.`, [
      { text: "Garder", style: "cancel" },
      {
        text: "Annuler l'entretien",
        style: "destructive",
        onPress: () =>
          undo.mutate(recordId, {
            onError: (err) => Alert.alert("Impossible d'annuler", err.message),
          }),
      },
    ]);
  }

  return (
    <Card padded={false} style={{ overflow: "hidden" }}>
      {shown.map((e, i) => {
        const { icon, title, detail } = describe(e);
        const recordId = e.type === "maintenance_done" ? (e.data as { recordId?: string } | null)?.recordId : undefined;
        const canUndo = recordId !== undefined && undoable.has(recordId);
        return (
          <View
            key={e.id}
            style={{ flexDirection: "row", gap: space.md, padding: space.lg, borderTopWidth: i === 0 ? 0 : 0.5, borderTopColor: t.border }}
          >
            <View style={{ width: 36, height: 36, borderRadius: radius.sm, backgroundColor: t.surface2, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name={icon} size={18} color={t.text} />
            </View>
            <View style={{ flex: 1, gap: 2 }} accessible accessibilityLabel={`${title}. ${detail ?? ""}. ${dateTimeFr(e.date)}`}>
              <Txt variant="bodyStrong">{title}</Txt>
              {detail ? <Txt variant="caption">{detail}</Txt> : null}
              <Txt variant="micro" tone="muted">
                {dateTimeFr(e.date)}
              </Txt>
            </View>
            {canUndo ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Annuler : ${title}`}
                hitSlop={8}
                disabled={undo.isPending}
                onPress={() => confirmUndo(recordId, title.replace(/ : fait$/, ""))}
                style={{ alignSelf: "center", minHeight: 44, justifyContent: "center", paddingHorizontal: space.sm }}
              >
                <Txt variant="caption" tone="primary" style={{ fontFamily: font.semibold }}>
                  Annuler
                </Txt>
              </Pressable>
            ) : null}
          </View>
        );
      })}
      {events.length > 15 ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setAll(!all)}
          style={{ padding: space.lg, alignItems: "center", borderTopWidth: 0.5, borderTopColor: t.border }}
        >
          <Txt variant="caption" tone="primary" style={{ fontFamily: font.semibold }}>
            {all ? "Afficher moins" : `Tout afficher (${events.length})`}
          </Txt>
        </Pressable>
      ) : null}
    </Card>
  );
}

export function HistorySection({ vehicleId }: { vehicleId: string }) {
  const report = useReport(vehicleId);
  const history = useHistory(vehicleId);

  if (report.isLoading || history.isLoading) {
    return (
      <View style={{ gap: space.md }}>
        <Skeleton height={90} />
        <Skeleton height={220} />
        <Skeleton height={160} />
      </View>
    );
  }
  if (!report.data || !history.data) {
    return (
      <RobotGuide
        mood="alert"
        title="Connexion impossible"
        action={{
          label: "Réessayer",
          onPress: () => {
            void report.refetch();
            void history.refetch();
          },
        }}
      >
        Je n'arrive pas à charger l'historique. Vérifiez votre connexion internet.
      </RobotGuide>
    );
  }

  const undoable = new Set(report.data.records.map((r) => r.id));
  return (
    <View style={{ gap: space.lg }}>
      <Totals r={report.data} />
      <SectionTitle>Rapports</SectionTitle>
      <Charts r={report.data} />
      <SectionTitle>Historique des modifications</SectionTitle>
      {history.data.events.length === 0 ? (
        <Card>
          <Txt tone="muted">Aucune modification pour l'instant.</Txt>
        </Card>
      ) : (
        <Timeline vehicleId={vehicleId} events={history.data.events} undoable={undoable} />
      )}
      <Txt variant="micro" tone="muted">
        Chaque changement (kilométrage, entretien, couleur, infos) est enregistré dans votre compte, en sécurité.
      </Txt>
    </View>
  );
}
