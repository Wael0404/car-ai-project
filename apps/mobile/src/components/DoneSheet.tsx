import * as Haptics from "expo-haptics";
import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Field, Segmented, Txt } from "@/components/ui";
import { checkDayFr, maskDayFr } from "@/lib/format";
import { font, radius, space, useTheme } from "@/lib/theme";
import { useRobi } from "@/components/RobiToast";
import { useMarkMaintenanceDone } from "@/lib/vehicles";

/**
 * Bottom sheet to record a service: today (default) or an earlier day taken
 * from the paper logbook or an invoice, the km, the price and a free note.
 * It feeds the "carnet de vidange", the history and the spending charts.
 */
export function DoneSheet({
  vehicleId,
  itemId,
  itemName,
  currentKm,
  intro,
  initialWhen = "today",
  successText,
  onClose,
}: {
  vehicleId: string;
  itemId: string;
  itemName: string;
  currentKm: number | null;
  /** One line under the title (default: about the history). */
  intro?: string;
  /** "other" to enter a service from the paper logbook or an invoice. */
  initialWhen?: "today" | "other";
  /** What Robi says once it is saved (default: noted in the history). */
  successText?: string;
  onClose: () => void;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const done = useMarkMaintenanceDone(vehicleId);
  const robi = useRobi();
  const [when, setWhen] = useState<"today" | "other">(initialWhen);
  const [dayInput, setDayInput] = useState("");
  const [kmInput, setKmInput] = useState(initialWhen === "today" && currentKm !== null ? String(currentKm) : "");
  const [costInput, setCostInput] = useState("");
  const [note, setNote] = useState("");

  const checked = when === "other" && dayInput.length === 10 ? checkDayFr(dayInput) : null;
  const day = checked && "day" in checked ? checked.day : null;
  const dayError = checked && "error" in checked ? checked.error : null;
  const kmValue = Number(kmInput);
  const kmValid = kmInput.length > 0 && Number.isFinite(kmValue);
  const cost = costInput.trim() === "" ? undefined : Number(costInput.replace(",", "."));
  const costValid = cost === undefined || (Number.isFinite(cost) && cost >= 0 && cost < 1_000_000);
  const ready = kmValid && costValid && (when === "today" || day !== null);

  function chooseWhen(v: "today" | "other") {
    if (v === when) return;
    setWhen(v);
    // Each mode has its own km: today's odometer, or the km of that past day.
    setKmInput(v === "today" && currentKm !== null ? String(currentKm) : "");
  }

  function save() {
    done.mutate(
      { itemId, km: kmValue, costTnd: cost, date: day ?? undefined, note: note.trim() || undefined },
      {
        onSuccess: () => {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          robi.say(successText ?? `« ${itemName} » est noté dans l'historique. J'ai recalculé la prochaine échéance.`, { title: "Bravo !", mood: "celebrate" });
          onClose();
        },
      },
    );
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fermer"
          onPress={onClose}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: t.overlay }}
        />
        <View
          accessibilityViewIsModal
          style={{ maxHeight: "94%", backgroundColor: t.card, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg }}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: space.lg, paddingBottom: space.lg + insets.bottom, gap: space.lg }}
          >
            <View style={{ alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: t.border }} />
            <View style={{ gap: 4 }}>
              <Txt variant="heading" accessibilityRole="header">
                {itemName}
              </Txt>
              <Txt tone="muted">{intro ?? "C'est noté dans l'historique de la voiture. Vous pourrez le supprimer si besoin."}</Txt>
            </View>

            <View style={{ gap: space.sm }}>
              <Txt variant="caption" style={{ fontFamily: font.semibold }}>
                Quand ?
              </Txt>
              <Segmented<"today" | "other">
                value={when}
                onChange={chooseWhen}
                options={[
                  { value: "today", label: "Aujourd'hui" },
                  { value: "other", label: "Une date passée" },
                ]}
              />
            </View>
            {when === "other" ? (
              <Field
                label="Date"
                icon="calendar-outline"
                value={dayInput}
                onChangeText={(v) => setDayInput(maskDayFr(v))}
                keyboardType="number-pad"
                placeholder="JJ/MM/AAAA"
                maxLength={10}
                error={dayError}
                helper="Celle du carnet d'entretien ou de la facture."
                accessibilityHint="Jour, mois et année, par exemple 14/03/2026"
              />
            ) : null}

            <Field
              label={when === "today" ? "Kilométrage aujourd'hui" : "Kilométrage ce jour-là"}
              icon="speedometer-outline"
              value={kmInput}
              onChangeText={(v) => setKmInput(v.replace(/\D/g, "").slice(0, 7))}
              keyboardType="number-pad"
              placeholder="Ex. 85000"
              accessibilityHint="Kilométrage du compteur le jour de l'entretien"
            />
            <Field
              label="Prix payé (facultatif)"
              icon="cash-outline"
              value={costInput}
              onChangeText={(v) => setCostInput(v.replace(/[^\d.,]/g, "").slice(0, 9))}
              keyboardType="decimal-pad"
              placeholder="Ex. 120"
              helper="En dinars (DT), pièces et main-d'œuvre. Sert à suivre vos dépenses."
              error={costValid ? null : "Montant invalide"}
              accessibilityHint="Montant total en dinars, laissez vide si vous ne savez pas"
            />
            <Field
              label="Note (facultatif)"
              icon="create-outline"
              value={note}
              onChangeText={(v) => setNote(v.slice(0, 300))}
              placeholder="Ex. huile Total 5W-30, garage Ben Salah"
              accessibilityHint="Huile utilisée, garage, remarque"
            />

            {done.error ? (
              <Txt tone="danger" accessibilityLiveRegion="polite">
                {done.error.message}
              </Txt>
            ) : null}
            <Button label="Enregistrer" icon="checkmark-done-outline" loading={done.isPending} disabled={!ready} onPress={save} />
            <Button label="Annuler" variant="ghost" size="md" onPress={onClose} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
