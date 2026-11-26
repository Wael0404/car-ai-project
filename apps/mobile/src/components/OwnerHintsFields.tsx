import { View } from "react-native";
import { DateField } from "@/components/DateField";
import { SelectField } from "@/components/SelectField";
import { Field } from "@/components/ui";
import { space } from "@/lib/theme";
import type { OwnerHints, Vehicle } from "@/lib/types";
import { useCarCatalog } from "@/lib/vehicles";

const fold = (s: string | null | undefined) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .trim();

/** Make / model / type / first registration, as on the registration card (carte grise). */
export function OwnerHintsFields({ value, onChange }: { value: OwnerHints; onChange: (v: OwnerHints) => void }) {
  const catalog = useCarCatalog();
  const makes = catalog.data?.makes ?? [];
  const make = makes.find((m) => fold(m.name) === fold(value.make));
  const models = make?.models ?? [];

  return (
    <View style={{ gap: space.lg }}>
      <SelectField
        label="Constructeur (D.1)"
        icon="business-outline"
        value={value.make ?? ""}
        options={makes.map((m) => m.name)}
        loading={catalog.isLoading}
        placeholder="Choisir la marque"
        onChange={(newMake) => {
          const list = makes.find((m) => fold(m.name) === fold(newMake))?.models ?? [];
          // Another make: the model chosen before no longer applies.
          const keepModel = fold(newMake) === fold(value.make) || list.some((m) => fold(m) === fold(value.model));
          onChange({ ...value, make: newMake, model: keepModel ? value.model : null });
        }}
      />
      <SelectField
        label="Type commercial (D.3)"
        icon="car-outline"
        value={value.model ?? ""}
        options={models}
        placeholder="Choisir le modèle"
        disabled={!value.make}
        disabledHint="Choisissez d'abord le constructeur."
        helper={value.make && models.length === 0 ? "Écrivez le modèle tel qu'il figure sur la carte grise." : undefined}
        onChange={(model) => onChange({ ...value, model })}
      />
      <Field
        label="Type constructeur (D.2)"
        icon="barcode-outline"
        helper="Le code juste sous le constructeur sur la carte grise, par ex. 312PXG110 P2F."
        value={value.variant ?? ""}
        onChangeText={(variant) => onChange({ ...value, variant })}
        placeholder="312PXG110 P2F"
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={80}
        accessibilityHint="Code du type constructeur, sur la carte grise"
      />
      <SelectField
        label="Énergie (P.3)"
        icon="water-outline"
        value={value.fuel ?? ""}
        options={["Essence", "Diesel", "Hybride", "Électrique", "GPL"]}
        placeholder="Essence ou diesel ?"
        helper="Sur la carte grise : ES = essence, GO = diesel (gazole). Je n'affiche que les pièces de ce moteur."
        onChange={(fuel) => onChange({ ...value, fuel })}
      />
      <DateField
        label="1re mise en circulation (B)"
        value={value.firstRegistration}
        onChange={(firstRegistration) => onChange({ ...value, firstRegistration })}
        helper="Case B de la carte grise. Sert aussi à calculer les entretiens au temps."
      />
    </View>
  );
}

/**
 * Form values to start from: what the owner already typed, otherwise what
 * Robi found (written in capitals, like the card).
 */
export function prefillHints(v: Vehicle): OwnerHints {
  const up = (s: string | null | undefined) => (s && s.trim() ? s.trim().toUpperCase() : null);
  return {
    make: up(v.declared?.make) ?? up(v.profile?.make),
    model: up(v.declared?.model) ?? up(v.profile?.model),
    variant: up(v.declared?.variant),
    firstRegistration: v.declared?.firstRegistration ?? null,
    fuel: v.declared?.fuel ?? v.fuel ?? null,
  };
}

/** Drops empty strings so the API gets only what the owner filled in. */
export function cleanHints(h: OwnerHints): OwnerHints {
  const t = (s?: string | null) => (s && s.trim() ? s.trim() : undefined);
  return { make: t(h.make), model: t(h.model), variant: t(h.variant), firstRegistration: t(h.firstRegistration), fuel: t(h.fuel) };
}
