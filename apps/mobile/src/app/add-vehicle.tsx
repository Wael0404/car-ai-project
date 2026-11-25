import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ColorPicker } from "@/components/ColorPicker";
import { cleanHints, OwnerHintsFields } from "@/components/OwnerHintsFields";
import { RequireAuth } from "@/components/RequireAuth";
import { RobotGuide } from "@/components/Robot";
import { Button, Field, Txt } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { PAINT_COLORS, space, useTheme } from "@/lib/theme";
import type { OwnerHints } from "@/lib/types";
import { useAddVehicle } from "@/lib/vehicles";
import { normalizeVin, vinError } from "@/lib/vin";

const STEPS = ["Numéro VIN", "Carte grise", "Couleur"];

function Progress({ step }: { step: number }) {
  const t = useTheme();
  return (
    <View style={{ gap: space.sm }} accessibilityLabel={`Étape ${step + 1} sur ${STEPS.length} : ${STEPS[step]}`}>
      <View style={{ flexDirection: "row", gap: 6 }}>
        {STEPS.map((s, i) => (
          <View key={s} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i <= step ? t.primary : t.border }} />
        ))}
      </View>
      <Txt variant="caption" tone="muted">
        Étape {step + 1} sur {STEPS.length} · {STEPS[step]}
      </Txt>
    </View>
  );
}

function AddVehicleForm() {
  const t = useTheme();
  const [step, setStep] = useState(0);
  const [vin, setVin] = useState("");
  const [hints, setHints] = useState<OwnerHints>({});
  const [nickname, setNickname] = useState("");
  const [color, setColor] = useState(PAINT_COLORS[2]!.hex);
  const add = useAddVehicle();

  const normalized = normalizeVin(vin);
  const localError = vinError(vin);
  const vinReady = normalized.length === 17 && !localError;
  const serverError =
    add.error instanceof ApiError ? add.error.message : add.error ? "Impossible de joindre le serveur. Vérifiez votre connexion." : null;

  function submit() {
    add.mutate(
      { vin: normalized, nickname: nickname.trim() || undefined, color, ...cleanHints(hints) },
      {
        onSuccess: (vehicle) => {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          router.replace({ pathname: "/vehicle/[id]", params: { id: vehicle.id } });
        },
        // A VIN problem is shown on the first step, where it can be fixed.
        onError: () => setStep(0),
      },
    );
  }

  return (
    <SafeAreaView edges={["bottom"]} style={{ flex: 1, backgroundColor: t.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.xl }} keyboardShouldPersistTaps="handled">
          <Progress step={step} />

          {step === 0 && (
            <>
              <RobotGuide mood="happy" title="Où trouver le VIN ?">
                Sur la carte grise, case E (« N° de série du type »). Il fait 17 caractères et se trouve aussi en bas du
                pare-brise, côté conducteur.
              </RobotGuide>
              <Field
                label="Numéro VIN"
                icon="finger-print-outline"
                value={vin}
                onChangeText={(v) => setVin(v.toUpperCase())}
                placeholder="ZFA31200003E60330"
                autoCapitalize="characters"
                autoCorrect={false}
                autoFocus
                maxLength={21}
                error={localError && normalized.length >= 17 ? localError : serverError}
                helper={localError && normalized.length < 17 ? localError : vinReady ? "Format correct" : undefined}
                style={{ letterSpacing: 1.5, fontVariant: ["tabular-nums"] }}
              />
            </>
          )}

          {step === 1 && (
            <>
              <RobotGuide mood="thinking" title="Pour être encore plus précis">
                Ces informations de la carte grise m'aident à trouver la version exacte et le moteur. Vous pouvez passer
                cette étape.
              </RobotGuide>
              <OwnerHintsFields value={hints} onChange={setHints} />
            </>
          )}

          {step === 2 && (
            <>
              <RobotGuide mood="happy" title="Dernière étape">
                Le VIN n'indique pas la couleur : choisissez-la, et donnez un surnom à votre voiture si vous voulez.
              </RobotGuide>
              <View style={{ gap: space.md }}>
                <Txt variant="bodyStrong">Couleur</Txt>
                <ColorPicker value={color} onChange={setColor} />
              </View>
              <Field label="Surnom (facultatif)" icon="pricetag-outline" value={nickname} onChangeText={setNickname} placeholder="Ma Panda" maxLength={60} />
            </>
          )}
        </ScrollView>

        <View style={{ padding: space.lg, gap: space.sm, borderTopWidth: 0.5, borderTopColor: t.border, backgroundColor: t.bg }}>
          {step === 0 && <Button label="Continuer" icon="arrow-forward" onPress={() => setStep(1)} disabled={!vinReady} />}
          {step === 1 && (
            <>
              <Button label="Continuer" icon="arrow-forward" onPress={() => setStep(2)} />
              <Button label="Passer cette étape" variant="ghost" onPress={() => setStep(2)} />
            </>
          )}
          {step === 2 && <Button label="Ajouter ma voiture" icon="checkmark-circle-outline" onPress={submit} loading={add.isPending} />}
          {step > 0 && <Button label="Retour" variant="ghost" size="md" onPress={() => setStep(step - 1)} />}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export default function AddVehicle() {
  return (
    <RequireAuth>
      <AddVehicleForm />
    </RequireAuth>
  );
}
