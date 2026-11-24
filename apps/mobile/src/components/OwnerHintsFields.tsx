import { View } from "react-native";
import { Body, Field } from "@/components/ui";
import type { OwnerHints } from "@/lib/types";

/** Make / model / type as written on the registration card (carte grise). */
export function OwnerHintsFields({ value, onChange }: { value: OwnerHints; onChange: (v: OwnerHints) => void }) {
  return (
    <View style={{ gap: 14 }}>
      <Body muted style={{ fontSize: 13 }}>
        Recopiez ces informations de votre carte grise pour aider l'agent à trouver la version exacte (facultatif).
      </Body>
      <Field
        label="Constructeur"
        value={value.make ?? ""}
        onChangeText={(make) => onChange({ ...value, make })}
        placeholder="FIAT"
        autoCapitalize="characters"
        maxLength={40}
      />
      <Field
        label="Type commercial"
        value={value.model ?? ""}
        onChangeText={(model) => onChange({ ...value, model })}
        placeholder="PANDA"
        autoCapitalize="characters"
        maxLength={60}
      />
      <Field
        label="Type constructeur"
        value={value.variant ?? ""}
        onChangeText={(variant) => onChange({ ...value, variant })}
        placeholder="312PXG110 P2F"
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={80}
      />
      <Field
        label="1re mise en circulation"
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
