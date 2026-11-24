import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { ColorPicker } from "@/components/ColorPicker";
import { RequireAuth } from "@/components/RequireAuth";
import { Body, Button, Field } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { PAINT_COLORS, useTheme } from "@/lib/theme";
import { useAddVehicle } from "@/lib/vehicles";
import { normalizeVin, vinError } from "@/lib/vin";

function AddVehicleForm() {
  const t = useTheme();
  const [vin, setVin] = useState("");
  const [nickname, setNickname] = useState("");
  const [color, setColor] = useState(PAINT_COLORS[2]!.hex);
  const add = useAddVehicle();

  const localError = vinError(vin);
  const ready = normalizeVin(vin).length === 17 && !localError;
  const serverError = add.error instanceof ApiError ? add.error.message : add.error ? "Impossible de joindre le serveur." : null;

  function submit() {
    add.mutate(
      { vin: normalizeVin(vin), nickname: nickname.trim() || undefined, color },
      { onSuccess: (vehicle) => router.replace({ pathname: "/vehicle/[id]", params: { id: vehicle.id } }) },
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ padding: 16, gap: 20 }} keyboardShouldPersistTaps="handled">
      <Body muted>
        Le VIN (17 caractères) se trouve sur la carte grise (case E), en bas du pare-brise côté conducteur ou sur le
        montant de la portière. Notre agent IA retrouve ensuite toutes les caractéristiques de votre voiture.
      </Body>
      <Field
        label="Numéro VIN"
        value={vin}
        onChangeText={(v) => setVin(v.toUpperCase())}
        placeholder="WVWZZZAUZFW123456"
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={21}
        error={localError ?? serverError}
        style={{ fontVariant: ["tabular-nums"], letterSpacing: 1.5 }}
      />
      <Field label="Surnom (facultatif)" value={nickname} onChangeText={setNickname} placeholder="Ma Golf" maxLength={60} />
      <View style={{ gap: 10 }}>
        <Body muted style={{ fontSize: 13, fontWeight: "600" }}>
          Couleur (le VIN n'indique pas la couleur)
        </Body>
        <ColorPicker value={color} onChange={setColor} />
      </View>
      <Button label="Ajouter" onPress={submit} loading={add.isPending} disabled={!ready} />
    </ScrollView>
  );
}

export default function AddVehicle() {
  return (
    <RequireAuth>
      <AddVehicleForm />
    </RequireAuth>
  );
}
