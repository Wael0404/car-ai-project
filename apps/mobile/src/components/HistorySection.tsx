import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { BarChart, LineChart, RankBars } from "@/components/charts";
import { CATEGORY_ICON, CATEGORY_LABEL } from "@/components/MaintenanceSection";
import { OilLogCard } from "@/components/OilLogCard";
import { RobotGuide } from "@/components/Robot";
import { Card, SectionTitle, Skeleton, Txt, type IconName } from "@/components/ui";
import { dateFr, dateLongFr, km, MONTHS_FR, tnd } from "@/lib/format";
import { font, radius, space, useTheme, PAINT_COLORS } from "@/lib/theme";
import type { Report, VehicleEvent } from "@/lib/types";
import { useHistory, useOilLog, useReport, useUndoMaintenance } from "@/lib/vehicles";

/**
 * Everything done on the car, in the order an owner looks for it:
 * the oil-change logbook, a short summary in plain words, every service,
 * then spending and mileage (only when there is something to show), and the
 * detailed log of changes folded at the bottom.
 */

const two = (n: number) => String(n).padStart(2, "0");
const timeFr = (iso: string) => {
  const d = new Date(iso);
  return `${two(d.getHours())}:${two(d.getMinutes())}`;
};
const localDay = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
};
/** "Aujourd'hui", "Hier" or "12 novembre 2026". */
function dayLabel(day: string): string {
  const now = new Date();
  const today = `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}`;
  const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const yesterday = `${y.getFullYear()}-${two(y.getMonth() + 1)}-${two(y.getDate())}`;
  return day === today ? "Aujourd'hui" : day === yesterday ? "Hier" : dateLongFr(day);
}
const monthLabel = (iso: string) => {
  const d = new Date(iso);
  const s = `${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const shortDay = (ms: number) => {
  const d = new Date(ms);
  return `${two(d.getDate())}/${two(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)}`;
};
const kmTick = (v: number) => (Math.abs(v) >= 10_000 ? `${Math.round(v / 1000)} k` : v.toLocaleString("fr-FR"));
const dtTick = (v: number) => v.toLocaleString("fr-FR", { maximumFractionDigits: 0 });
const colorName = (hex: unknown) => PAINT_COLORS.find((c) => c.hex === hex)?.name ?? "personnalisée";

/* ------------------------------ En bref ------------------------------ */

function SummaryRow({ icon, label, value, first }: { icon: IconName; label: string; value: string; first: boolean }) {
  const t = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${label} : ${value}`}
      style={{ flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.md, borderTopWidth: first ? 0 : 0.5, borderTopColor: t.border }}
    >
      <Ionicons name={icon} size={20} color={t.primary} />
      <Txt style={{ flex: 1 }}>{label}</Txt>
      <Txt variant="bodyStrong" style={{ fontVariant: ["tabular-nums"] }}>
        {value}
      </Txt>
    </View>
  );
}

/** Plain-word summary; rows with nothing to say are left out. */
function summaryRows(r: Report, mileageKm: number | null): Array<{ icon: IconName; label: string; value: string }> {
  const x = r.totals;
  const rows: Array<{ icon: IconName; label: string; value: string }> = [];
  if (mileageKm !== null) rows.push({ icon: "speedometer-outline", label: "Compteur actuel", value: km(mileageKm) });
  if (x.avgKmPerMonth !== null) rows.push({ icon: "trending-up-outline", label: "Vous roulez environ", value: `${km(x.avgKmPerMonth)} / mois` });
  if (x.servicesDone > 0) rows.push({ icon: "checkmark-done-outline", label: "Entretiens enregistrés (vidanges comprises)", value: String(x.servicesDone) });
  const oldest = r.records.at(-1);
  if (x.spentTnd > 0 && oldest) {
    rows.push({ icon: "wallet-outline", label: `Dépensé depuis le ${dateFr(localDay(oldest.date))}`, value: tnd(x.spentTnd) });
  }
  return rows;
}

function Summary({ rows }: { rows: Array<{ icon: IconName; label: string; value: string }> }) {
  return (
    <Card style={{ paddingVertical: space.xs }}>
      {rows.map((row, i) => (
        <SummaryRow key={row.label} {...row} first={i === 0} />
      ))}
    </Card>
  );
}

/* --------------------------- Tous les entretiens --------------------------- */

function Services({ vehicleId, records }: { vehicleId: string; records: Report["records"] }) {
  const t = useTheme();
  const undo = useUndoMaintenance(vehicleId);
  const [all, setAll] = useState(false);
  const shown = all ? records : records.slice(0, 8);

  if (records.length === 0) {
    return (
      <Card>
        <Txt tone="muted">
          Aucun autre entretien enregistré. Quand un entretien est fait (filtres, freins, courroie…), touchez « C'est fait »
          dans l'onglet Entretien : il apparaîtra ici avec sa date et son kilométrage.
        </Txt>
      </Card>
    );
  }

  function confirmDelete(id: string, name: string, date: string) {
    Alert.alert("Supprimer cet entretien ?", `« ${name} » du ${dateFr(localDay(date))} ne sera plus compté comme fait.`, [
      { text: "Garder", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: () => undo.mutate(id, { onError: (err) => Alert.alert("Suppression impossible", err.message) }),
      },
    ]);
  }

  // Group by month, newest first (records already come newest first).
  const groups: Array<{ month: string; rows: Report["records"] }> = [];
  for (const r of shown) {
    const m = monthLabel(r.date);
    const g = groups.at(-1);
    if (g && g.month === m) g.rows.push(r);
    else groups.push({ month: m, rows: [r] });
  }

  return (
    <Card padded={false} style={{ overflow: "hidden", gap: 0 }}>
      {groups.map((g) => (
        <View key={g.month}>
          <View style={{ backgroundColor: t.surface2, paddingHorizontal: space.lg, paddingVertical: 6 }}>
            <Txt variant="label" tone="muted">
              {g.month}
            </Txt>
          </View>
          {g.rows.map((r, i) => {
            const name = r.itemName ?? "Entretien";
            const detail = [dateLongFr(localDay(r.date)), `à ${km(r.km)}`, r.costTnd !== null ? tnd(r.costTnd) : null].filter(Boolean).join(" · ");
            return (
              <View
                key={r.id}
                style={{ flexDirection: "row", alignItems: "center", gap: space.md, paddingLeft: space.lg, paddingVertical: space.sm, borderTopWidth: i === 0 ? 0 : 0.5, borderTopColor: t.border }}
              >
                <View style={{ width: 36, height: 36, borderRadius: radius.sm, backgroundColor: t.successSoft, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name={CATEGORY_ICON[r.category ?? ""] ?? "checkmark-done-outline"} size={18} color={t.success} />
                </View>
                <View style={{ flex: 1, gap: 2 }} accessible accessibilityLabel={`${name}, ${detail}`}>
                  <Txt variant="bodyStrong">{name}</Txt>
                  <Txt variant="caption" tone="muted">
                    {detail}
                  </Txt>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Supprimer : ${name}`}
                  onPress={() => confirmDelete(r.id, name, r.date)}
                  style={{ minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" }}
                >
                  <Ionicons name="trash-outline" size={18} color={t.muted} />
                </Pressable>
              </View>
            );
          })}
        </View>
      ))}
      {records.length > 8 ? (
        <Pressable accessibilityRole="button" onPress={() => setAll(!all)} style={{ padding: space.lg, alignItems: "center", borderTopWidth: 0.5, borderTopColor: t.border }}>
          <Txt variant="caption" tone="primary" style={{ fontFamily: font.semibold }}>
            {all ? "Afficher moins" : `Voir les ${records.length} entretiens`}
          </Txt>
        </Pressable>
      ) : null}
    </Card>
  );
}

/* --------------------------- Dépenses, kilométrage --------------------------- */

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

function ListToggle({ list, onToggle }: { list: boolean; onToggle: () => void }) {
  return (
    <Pressable accessibilityRole="button" hitSlop={10} onPress={onToggle} style={{ minHeight: 32, justifyContent: "center" }}>
      <Txt variant="caption" tone="primary" style={{ fontFamily: font.semibold }}>
        {list ? "Voir le graphique" : "Voir en liste"}
      </Txt>
    </Pressable>
  );
}

function Spending({ r }: { r: Report }) {
  const [list, setList] = useState(false);
  const bars = r.spendByMonth.map((m) => {
    const [y, mo] = m.month.split("-").map(Number);
    const name = MONTHS_FR[(mo ?? 1) - 1]!;
    return { key: m.month, label: name.charAt(0).toUpperCase(), longLabel: `${name} ${y}`, value: m.totalTnd };
  });
  const yearTotal = r.spendByMonth.reduce((s, m) => s + m.totalTnd, 0);
  return (
    <Card style={{ gap: space.md }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space.md }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt variant="bodyStrong" accessibilityRole="header">
            {tnd(yearTotal)} sur les 12 derniers mois
          </Txt>
          <Txt variant="caption" tone="muted">
            Selon les prix indiqués. Touchez un mois pour voir le montant.
          </Txt>
        </View>
        <ListToggle list={list} onToggle={() => setList(!list)} />
      </View>
      {list ? (
        <DataList rows={[...bars].reverse().filter((b) => b.value > 0).map((b) => ({ key: b.key, label: b.longLabel, value: tnd(b.value) }))} />
      ) : (
        <BarChart bars={bars} formatValue={tnd} formatTick={dtTick} accessibilityLabel={`Dépenses par mois sur 12 mois, total ${tnd(yearTotal)}`} />
      )}
      {r.spendByCategory.some((c) => c.totalTnd > 0) ? (
        <View style={{ gap: space.md, marginTop: space.sm }}>
          <Txt variant="label" tone="muted">
            Par type d'entretien
          </Txt>
          <RankBars
            formatValue={tnd}
            rows={r.spendByCategory
              .filter((c) => c.totalTnd > 0)
              .map((c) => ({ key: c.category, label: CATEGORY_LABEL[c.category] ?? c.category, value: c.totalTnd, sub: `${c.count} fois` }))}
          />
        </View>
      ) : null}
    </Card>
  );
}

function Mileage({ r }: { r: Report }) {
  const [list, setList] = useState(false);
  const pts = r.mileage.map((p) => ({ x: new Date(p.date).getTime(), y: p.km }));
  return (
    <Card style={{ gap: space.md }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space.md }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt variant="bodyStrong" accessibilityRole="header">
            Évolution du compteur
          </Txt>
          <Txt variant="caption" tone="muted">
            Chaque relevé que vous avez indiqué. Touchez un point pour voir la valeur.
          </Txt>
        </View>
        <ListToggle list={list} onToggle={() => setList(!list)} />
      </View>
      {list ? (
        <DataList rows={[...r.mileage].reverse().map((p) => ({ key: p.date, label: dateFr(localDay(p.date)), value: km(p.km) }))} />
      ) : (
        <LineChart
          points={pts}
          formatY={km}
          formatTick={kmTick}
          formatX={shortDay}
          accessibilityLabel={`Compteur : de ${km(pts[0]!.y)} à ${km(pts.at(-1)!.y)}`}
        />
      )}
    </Card>
  );
}

/* --------------------------- Journal des modifications --------------------------- */

/** Plain sentence + icon for each change. */
function describe(e: VehicleEvent): { icon: IconName; title: string; detail?: string } {
  const d = (e.data ?? {}) as Record<string, unknown>;
  const n = (v: unknown) => (typeof v === "number" ? v : null);
  const s = (v: unknown) => (typeof v === "string" && v ? v : null);
  switch (e.type) {
    case "vehicle_added":
      return { icon: "add-circle-outline", title: "Voiture ajoutée à votre compte", detail: s(d.vin) ? `VIN ${d.vin}` : undefined };
    case "analysis_ready":
      return { icon: "sparkles-outline", title: "Robi a identifié votre voiture", detail: [s(d.make), s(d.model)].filter(Boolean).join(" ") || undefined };
    case "mileage_updated": {
      const from = n(d.fromKm);
      const to = n(d.toKm);
      return { icon: "speedometer-outline", title: "Compteur mis à jour", detail: to === null ? undefined : from === null ? km(to) : `${km(to)} (avant : ${km(from)})` };
    }
    case "maintenance_done": {
      const parts = [n(d.km) !== null ? `à ${km(n(d.km)!)}` : null, n(d.costTnd) !== null ? tnd(n(d.costTnd)!) : null, s(d.date) ? `fait le ${dateFr(s(d.date)!)}` : null];
      return {
        icon: CATEGORY_ICON[String(d.category)] ?? "checkmark-done-outline",
        title: `${s(d.itemName) ?? "Entretien"} : fait`,
        detail: parts.filter(Boolean).join(" · ") || undefined,
      };
    }
    case "maintenance_undone":
      return { icon: "trash-outline", title: "Entretien supprimé", detail: s(d.itemName) ?? undefined };
    case "color_changed":
      return { icon: "color-palette-outline", title: "Couleur changée", detail: `${colorName(d.from)} → ${colorName(d.to)}` };
    case "nickname_changed":
      return { icon: "pricetag-outline", title: "Surnom changé", detail: s(d.to) ?? undefined };
    case "info_corrected":
      return { icon: "document-text-outline", title: "Infos de la carte grise corrigées", detail: "Robi a relancé l'analyse" };
    default:
      return { icon: "ellipse-outline", title: "Modification" };
  }
}

function ChangeLog({ events }: { events: VehicleEvent[] }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const days: Array<{ day: string; events: VehicleEvent[] }> = [];
  for (const e of events) {
    const day = localDay(e.date);
    const g = days.at(-1);
    if (g && g.day === day) g.events.push(e);
    else days.push({ day, events: [e] });
  }
  return (
    <Card padded={false} style={{ overflow: "hidden", gap: 0 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={{ flexDirection: "row", alignItems: "center", gap: space.md, padding: space.lg, minHeight: 56 }}
      >
        <Ionicons name="list-outline" size={20} color={t.muted} />
        <View style={{ flex: 1 }}>
          <Txt variant="bodyStrong">Journal des modifications</Txt>
          <Txt variant="caption" tone="muted">
            Tout ce qui a changé sur la voiture, jour par jour ({events.length})
          </Txt>
        </View>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={20} color={t.muted} />
      </Pressable>
      {open
        ? days.map((g) => (
            <View key={g.day}>
              <View style={{ backgroundColor: t.surface2, paddingHorizontal: space.lg, paddingVertical: 6 }}>
                <Txt variant="label" tone="muted">
                  {dayLabel(g.day)}
                </Txt>
              </View>
              {g.events.map((e, i) => {
                const { icon, title, detail } = describe(e);
                return (
                  <View
                    key={e.id}
                    accessible
                    accessibilityLabel={`${title}. ${detail ?? ""}. ${timeFr(e.date)}`}
                    style={{ flexDirection: "row", gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, borderTopWidth: i === 0 ? 0 : 0.5, borderTopColor: t.border }}
                  >
                    <Ionicons name={icon} size={18} color={t.text} style={{ marginTop: 2 }} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Txt>{title}</Txt>
                      {detail ? (
                        <Txt variant="caption" tone="muted">
                          {detail}
                        </Txt>
                      ) : null}
                    </View>
                    <Txt variant="micro" tone="muted" style={{ fontVariant: ["tabular-nums"] }}>
                      {timeFr(e.date)}
                    </Txt>
                  </View>
                );
              })}
            </View>
          ))
        : null}
    </Card>
  );
}

/* ------------------------------ Screen ------------------------------ */

export function HistorySection({ vehicleId, mileageKm }: { vehicleId: string; mileageKm: number | null }) {
  const report = useReport(vehicleId);
  const history = useHistory(vehicleId);
  // Oil changes are in the carnet: not listed a second time below.
  const oilLog = useOilLog(vehicleId);
  const oilItemId = oilLog.data?.item?.id;

  return (
    <View style={{ gap: space.lg }}>
      <RobotGuide mood="happy" compact>
        Ici, tout ce qui a été fait sur votre voiture : vidanges, entretiens et dépenses.
      </RobotGuide>

      <OilLogCard vehicleId={vehicleId} mileageKm={mileageKm} />

      {report.isLoading || history.isLoading || oilLog.isLoading ? (
        <View style={{ gap: space.md }}>
          <Skeleton height={120} />
          <Skeleton height={160} />
        </View>
      ) : !report.data || !history.data ? (
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
      ) : (
        <>
          {summaryRows(report.data, mileageKm).length > 0 ? (
            <>
              <SectionTitle>En bref</SectionTitle>
              <Summary rows={summaryRows(report.data, mileageKm)} />
            </>
          ) : null}

          <SectionTitle>Autres entretiens</SectionTitle>
          <Services vehicleId={vehicleId} records={report.data.records.filter((r) => r.itemId !== oilItemId)} />

          {report.data.spendByMonth.some((m) => m.totalTnd > 0) ? (
            <>
              <SectionTitle>Dépenses</SectionTitle>
              <Spending r={report.data} />
            </>
          ) : null}

          {report.data.mileage.length >= 2 ? (
            <>
              <SectionTitle>Kilométrage</SectionTitle>
              <Mileage r={report.data} />
            </>
          ) : null}

          {history.data.events.length > 0 ? <ChangeLog events={history.data.events} /> : null}

          <Txt variant="micro" tone="muted">
            Chaque changement est enregistré dans votre compte, en sécurité.
          </Txt>
        </>
      )}
    </View>
  );
}
