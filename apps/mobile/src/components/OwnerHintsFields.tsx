import { View } from "react-native";
import { Field } from "@/components/ui";
import { space } from "@/lib/theme";
import type { OwnerHints } from "@/lib/types";

/** Make / model / type as written on the registration card (carte grise). */
export function OwnerHintsFields({ value, onChange }: { value: OwnerHints; onChange: (v: OwnerHints) => void }) {
  return (
    <View style={{ gap: space.lg }}>
      <Field
        label="Constructeur"
        icon="business-outline"
        value={value.make ?? ""}
        onChangeText={(make) => onChange({ ...value, make })}
        placeholder="FIAT"
        autoCapitalize="characters"
        maxLength={40}
      />
      <Field
        label="Type commercial"
        icon="car-outline"
        value={value.model ?? ""}
        onChangeText={(model) => onChange({ ...value, model })}
        placeholder="PANDA"
        autoCapitalize="characters"
        maxLength={60}
      />
      <Field
        label="Type constructeur"
        icon="barcode-outline"
        helper="Le code juste sous le constructeur sur la carte grise."
        value={value.variant ?? ""}
        onChangeText={(variant) => onChange({ ...value, variant })}
        placeholder="312PXG110 P2F"
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={80}
      />
      <Field
        label="1re mise en circulation"
        icon="calendar-outline"
        value={value.firstRegistration ?? ""}
        onChangeText={(firstRegistration) => onChange({ ...value, firstRegistration })}
        placeholder="AAAA/MM/JJ"
        keyboardType="numbers-and-punctuation"
        maxLength={10}
      />
    </View>
  );
}

/** Drops empty strings so the API gets only what the owner filled in. */
export function cleanHints(h: OwnerHints): OwnerHints {
  const t = (s?: string | null) => (s && s.trim() ? s.trim() : undefined);
  return { make: t(h.make), model: t(h.model), variant: t(h.variant), firstRegistration: t(h.firstRegistration) };
}
