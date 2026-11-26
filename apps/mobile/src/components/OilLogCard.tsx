import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { DoneSheet } from "@/components/DoneSheet";
import { Button, Card, Skeleton, Txt } from "@/components/ui";
import { dateFr, dateLongFr, everyMonthsFr, km, monthsFr, tnd } from "@/lib/format";
import { font, radius, space, useTheme } from "@/lib/theme";
import type { OilLog } from "@/lib/types";
import { useOilLog, useUndoMaintenance } from "@/lib/vehicles";

type Next = NonNullable<OilLog["next"]>;
type Item = NonNullable<OilLog["item"]>;
type Entry = OilLog["entries"][number];

const inDays = (days: number) =>
  days === 1 ? "demain" : days < 45 ? `dans ${days} jours` : `dans ${monthsFr(Math.round(days / 30.44))}`;

/**
 * The one sentence the owner needs: when is the next oil change. Whichever
 * limit (km or date) will come first leads, so a car that drives little is
 * told about the date.
 */
function nextText(n: Next, item: Item): { title: string; detail: string | null } {
  const dueKm = n.nextDueKm !== null ? km(n.nextDueKm) : null;
  const dueDate = n.nextDueDate ? dateFr(n.nextDueDate) : null;

  if (n.kmLeft !== null && n.kmLeft < 0) return { title: `Vidange en retard de ${km(Math.abs(n.kmLeft))}`, detail: "À faire dès que possible." };
  if (n.kmLeft === 0) return { title: "Vidange à faire maintenant", detail: `Vous êtes arrivé à ${dueKm}, le kilométrage prévu pour la vidange.` };
  if (n.daysLeft !== null && n.daysLeft < 0 && dueDate) {
    return { title: `Vidange en retard depuis le ${dueDate}`, detail: "L'huile vieillit même quand la voiture roule peu. À faire dès que possible." };
  }
  if (n.daysLeft === 0) return { title: "Vidange à faire aujourd'hui", detail: dueKm ? `Ou à ${dueKm}, selon ce qui arrive en premier.` : null };
  if (n.status === "overdue") return { title: "Vidange à faire maintenant", detail: null };

  // Share of the interval left on each side: the smaller one comes first.
  const kmShare = n.kmLeft !== null && item.intervalKm ? n.kmLeft / item.intervalKm : Infinity;
  const timeShare = n.daysLeft !== null && item.intervalMonths ? n.daysLeft / (item.intervalMonths * 30.44) : Infinity;
  if (n.daysLeft !== null && dueDate && timeShare < kmShare) {
    return {
      title: `Prochaine vidange ${inDays(n.daysLeft)}`,
      detail: `Avant le ${dueDate}${dueKm ? `, ou à ${dueKm} si vous roulez beaucoup d'ici là` : ""}.`,
    };
  }
  if (n.kmLeft !== null && dueKm) {
    return { title: `Prochaine vidange dans ${km(n.kmLeft)}`, detail: `À ${dueKm}${dueDate ? `, ou au plus tard le ${dueDate}` : ""}.` };
  }
  return { title: "Prochaine vidange selon contrôle", detail: null };
}

/** "8 000 km parcourus sur 10 000 km depuis la dernière vidange" (or the time, whichever is further). */
function usedText(n: Next, item: Item, last: Entry, mileageKm: number): string {
  const kmDone = Math.max(0, mileageKm - last.km);
  const monthsDone = Math.max(0, Math.round((Date.now() - new Date(`${last.date}T12:00:00`).getTime()) / (30.44 * 86_400_000)));
  const byKm = item.intervalKm ? kmDone / item.intervalKm : -1;
  const byTime = item.intervalMonths ? monthsDone / item.intervalMonths : -1;
  if (byKm >= byTime && item.intervalKm) {
    return kmDone > item.intervalKm
      ? `Intervalle dépassé de ${km(kmDone - item.intervalKm)}`
      : `${km(kmDone)} parcourus sur ${km(item.intervalKm)} depuis la dernière vidange`;
  }
  if (item.intervalMonths) {
    return monthsDone > item.intervalMonths
      ? `Intervalle dépassé de ${monthsFr(monthsDone - item.intervalMonths)}`
      : `${monthsFr(monthsDone)} sur ${monthsFr(item.intervalMonths)} depuis la dernière vidange`;
  }
  return "";
}

function Progress({ used, color, label }: { used: number; color: string; label: string }) {
  const t = useTheme();
  const pct = Math.round(used * 100);
  return (
    <View
      style={{ gap: 6 }}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.min(pct, 100) }}
    >
      <View style={{ height: 10, borderRadius: 5, backgroundColor: t.card, overflow: "hidden" }}>
        <View style={{ height: 10, width: `${Math.min(100, Math.max(3, pct))}%`, backgroundColor: color, borderRadius: 5 }} />
      </View>
      {label ? <Txt variant="caption">{label}</Txt> : null}
    </View>
  );
}

export function OilLogCard({ vehicleId, mileageKm }: { vehicleId: string; mileageKm: number | null }) {
  const t = useTheme();
  const log = useOilLog(vehicleId);
  const undo = useUndoMaintenance(vehicleId);
  // "other": enter a past oil change (from the paper logbook or an invoice).
  const [adding, setAdding] = useState<null | "today" | "other">(null);

  if (log.isLoading) return <Skeleton height={180} />;
  if (!log.data) {
    return (
      <Card>
        <Txt tone="muted">Le carnet de vidange n'a pas pu être chargé. Vérifiez votre connexion.</Txt>
        <Button label="Réessayer" icon="refresh" variant="ghost" size="md" onPress={() => void log.refetch()} />
      </Card>
    );
  }
  const d = log.data;
  if (d.status !== "READY" || !d.item) {
    return (
      <Card>
        <Header />
        <Txt tone="muted">
          {d.status === "PENDING"
            ? "Le carnet sera prêt dès que le plan d'entretien de votre voiture sera établi."
            : "Pas de programme de vidange connu pour cette voiture."}
        </Txt>
      </Card>
    );
  }

  const item = d.item;
  const n = d.next;
  // No oil change recorded: neutral colors, the due point is only a guess.
  const tone = !n || n.estimated ? t.text : n.status === "overdue" ? t.danger : n.status === "soon" ? t.warning : t.success;
  const soft = !n || n.estimated ? t.surface2 : n.status === "overdue" ? t.dangerSoft : n.status === "soon" ? t.warningSoft : t.successSoft;
  const text = n && !n.estimated ? nextText(n, item) : null;
  const last = d.entries.reduce<Entry | undefined>((best, e) => (!best || e.km > best.km ? e : best), undefined);
  const interval = [item.intervalKm && `tous les ${km(item.intervalKm)}`, item.intervalMonths && everyMonthsFr(item.intervalMonths)]
    .filter(Boolean)
    .join(" ou ");

  function confirmDelete(recordId: string, date: string) {
    Alert.alert("Supprimer cette vidange ?", `La vidange du ${dateFr(date)} sera retirée du carnet.`, [
      { text: "Garder", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: () => undo.mutate(recordId, { onError: (err) => Alert.alert("Suppression impossible", err.message) }),
      },
    ]);
  }

  return (
    <Card style={{ gap: space.lg }}>
      <Header onAdd={() => setAdding(d.entries.length === 0 ? "other" : "today")} />

      {/* What is left before the next oil change */}
      {n && text ? (
        <View style={{ backgroundColor: soft, borderRadius: radius.md, padding: space.lg, gap: space.md }}>
          <View style={{ gap: 2 }} accessible accessibilityLabel={`${text.title}. ${text.detail ?? ""}`}>
            <Txt variant="heading" style={{ color: tone }}>
              {text.title}
            </Txt>
            {text.detail ? <Txt variant="caption">{text.detail}</Txt> : null}
          </View>
          {n.used !== null && last && mileageKm !== null ? (
            <Progress used={n.used} color={tone} label={usedText(n, item, last, mileageKm)} />
          ) : null}
        </View>
      ) : n?.estimated ? (
        <View style={{ backgroundColor: soft, borderRadius: radius.md, padding: space.lg, gap: space.md }}>
          <View style={{ gap: 2 }}>
            <Txt variant="heading">Dernière vidange inconnue</Txt>
            <Txt variant="caption">
              {n.nextDueKm !== null
                ? `Si les vidanges ont été faites à temps, la prochaine serait vers ${km(n.nextDueKm)}${n.nextDueDate ? ` ou le ${dateFr(n.nextDueDate)}` : ""}.`
                : "Ajoutez la dernière vidange pour savoir quand faire la prochaine."}
            </Txt>
          </View>
          <Button label="Ajouter ma dernière vidange" icon="add-circle-outline" variant="secondary" onPress={() => setAdding("other")} />
          <Txt variant="caption" tone="muted">
            Regardez votre carnet d'entretien ou votre dernière facture.
          </Txt>
        </View>
      ) : mileageKm === null ? (
        <Txt tone="muted">Indiquez le kilométrage de la voiture (onglet Entretien) pour savoir quand faire la prochaine vidange.</Txt>
      ) : null}

      {interval ? (
        <Txt variant="caption" tone="muted">
          Recommandé pour votre moteur : une vidange {interval}, selon ce qui arrive en premier.
        </Txt>
      ) : null}

      {/* Every oil change, newest first */}
      {d.entries.length === 0 ? (
        n?.estimated ? null : (
          <Button label="Ajouter ma dernière vidange" icon="add-circle-outline" variant="secondary" onPress={() => setAdding("other")} />
        )
      ) : (
        <View style={{ gap: space.sm }}>
          <Txt variant="label" tone="muted">
            {d.entries.length === 1 ? "Vidange enregistrée" : `Vidanges enregistrées (${d.entries.length})`}
          </Txt>
          {d.entries.map((e, i) => (
            <View
              key={e.recordId}
              style={{ flexDirection: "row", gap: space.md, paddingTop: i === 0 ? 0 : space.md, borderTopWidth: i === 0 ? 0 : 0.5, borderTopColor: t.border }}
            >
              {/* timeline dot + line */}
              <View style={{ alignItems: "center", width: 14, paddingTop: 5 }}>
                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: i === 0 ? t.primary : t.inputBorder }} />
              </View>
              <View
                style={{ flex: 1, gap: 2 }}
                accessible
                accessibilityLabel={`Vidange du ${dateLongFr(e.date)}, à ${km(e.km)}${e.costTnd !== null ? `, ${tnd(e.costTnd)}` : ""}`}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space.sm }}>
                  <Txt variant="bodyStrong">{dateLongFr(e.date)}</Txt>
                  {e.costTnd !== null ? (
                    <Txt variant="bodyStrong" style={{ fontVariant: ["tabular-nums"] }}>
                      {tnd(e.costTnd)}
                    </Txt>
                  ) : null}
                </View>
                <Txt variant="caption">
                  À {km(e.km)}
                  {e.kmSincePrevious !== null
                    ? ` · ${km(e.kmSincePrevious)} après la précédente${e.monthsSincePrevious !== null ? ` (${monthsFr(e.monthsSincePrevious)})` : ""}`
                    : ""}
                </Txt>
                {e.alsoDone.length > 0 ? (
                  <Txt variant="caption" tone="muted">
                    Fait en même temps : {e.alsoDone.join(", ")}
                  </Txt>
                ) : null}
                {e.note ? (
                  <Txt variant="caption" tone="muted" style={{ fontStyle: "italic" }}>
                    « {e.note} »
                  </Txt>
                ) : null}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Supprimer la vidange du ${dateLongFr(e.date)}`}
                hitSlop={10}
                onPress={() => confirmDelete(e.recordId, e.date)}
                style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}
              >
                <Ionicons name="trash-outline" size={18} color={t.muted} />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {adding ? (
        <DoneSheet
          vehicleId={vehicleId}
          itemId={item.id}
          itemName="Ajouter une vidange"
          intro="Indiquez la date et le kilométrage de la vidange, comme sur votre carnet ou votre facture."
          currentKm={mileageKm}
          initialWhen={adding}
          onClose={() => setAdding(null)}
        />
      ) : null}
    </Card>
  );
}

function Header({ onAdd }: { onAdd?: () => void }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
      <View style={{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: t.primarySoft, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="water-outline" size={22} color={t.primary} />
      </View>
      <Txt variant="heading" accessibilityRole="header" style={{ flex: 1 }}>
        Carnet de vidange
      </Txt>
      {onAdd ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ajouter une vidange"
          onPress={onAdd}
          hitSlop={8}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            minHeight: 44,
            paddingHorizontal: space.md,
            borderRadius: radius.pill,
            backgroundColor: pressed ? t.primarySoft : "transparent",
          })}
        >
          <Ionicons name="add" size={20} color={t.primary} />
          <Txt tone="primary" style={{ fontFamily: font.semibold }}>
            Ajouter
          </Txt>
        </Pressable>
      ) : null}
    </View>
  );
}
