import * as Haptics from "expo-haptics";
import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Field, Txt } from "@/components/ui";
import { radius, space, useTheme } from "@/lib/theme";
import { useMarkMaintenanceDone } from "@/lib/vehicles";

/**
 * Bottom sheet shown by "C'est fait": asks at which km the job was done
 * (defaults to the current odometer) and, optionally, what it cost.
 * The cost feeds the spending charts of the History tab.
 */
export function DoneSheet({
  vehicleId,
  itemId,
  itemName,
  currentKm,
  onClose,
}: {
  vehicleId: string;
  itemId: string;
  itemName: string;
  currentKm: number | null;
  onClose: () => void;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const done = useMarkMaintenanceDone(vehicleId);
  const [kmInput, setKmInput] = useState(currentKm !== null ? String(currentKm) : "");
  const [costInput, setCostInput] = useState("");

  const kmValue = Number(kmInput);
  const kmValid = kmInput.length > 0 && Number.isFinite(kmValue);
  const cost = costInput.trim() === "" ? undefined : Number(costInput.replace(",", "."));
  const costValid = cost === undefined || (Number.isFinite(cost) && cost >= 0 && cost < 1_000_000);

  function save() {
    done.mutate(
      { itemId, km: kmValue, costTnd: cost },
      {
        onSuccess: () => {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
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
          style={{
            backgroundColor: t.card,
            borderTopLeftRadius: radius.lg,
            borderTopRightRadius: radius.lg,
            padding: space.lg,
            paddingBottom: space.lg + insets.bottom,
            gap: space.lg,
          }}
        >
          <View style={{ alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: t.border }} />
          <View style={{ gap: 4 }}>
            <Txt variant="heading" accessibilityRole="header">
              {itemName}
            </Txt>
            <Txt tone="muted">C'est noté dans l'historique de la voiture. Vous pourrez annuler si besoin.</Txt>
          </View>
          <Field
            label="Fait à quel kilométrage ?"
            icon="speedometer-outline"
            value={kmInput}
            onChangeText={(v) => setKmInput(v.replace(/\D/g, "").slice(0, 7))}
            keyboardType="number-pad"
            placeholder="Ex. 85000"
            accessibilityHint="Kilométrage du compteur le jour de l'entretien"
          />
          <Field
            label="Combien ça a coûté ? (facultatif)"
            icon="cash-outline"
            value={costInput}
            onChangeText={(v) => setCostInput(v.replace(/[^\d.,]/g, "").slice(0, 9))}
            keyboardType="decimal-pad"
            placeholder="Ex. 120"
            helper="En dinars (DT), pièces et main-d'œuvre. Sert à suivre vos dépenses."
            error={costValid ? null : "Montant invalide"}
            accessibilityHint="Montant total en dinars, laissez vide si vous ne savez pas"
          />
          {done.error ? (
            <Txt tone="danger" accessibilityLiveRegion="polite">
              {done.error.message}
            </Txt>
          ) : null}
          <Button label="Enregistrer" icon="checkmark-done-outline" loading={done.isPending} disabled={!kmValid || !costValid} onPress={save} />
          <Button label="Annuler" variant="ghost" size="md" onPress={onClose} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
