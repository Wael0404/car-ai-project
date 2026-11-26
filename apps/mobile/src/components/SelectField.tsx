import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Txt, type IconName } from "@/components/ui";
import { font, radius, space, type, useTheme } from "@/lib/theme";

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .trim();

/**
 * Drop-down list with search, for long lists (car makes, models). The owner
 * can also keep exactly what is written on the card when it is not listed.
 */
export function SelectField({
  label,
  icon,
  value,
  options,
  onChange,
  placeholder,
  helper,
  disabled,
  disabledHint,
  loading,
}: {
  label: string;
  icon: IconName;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  placeholder: string;
  helper?: string;
  disabled?: boolean;
  /** Shown instead of the helper while disabled (e.g. "Choisissez d'abord le constructeur"). */
  disabledHint?: string;
  loading?: boolean;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const q = fold(query);
  const filtered = useMemo(() => (q ? options.filter((o) => fold(o).includes(q)) : options), [options, q]);
  const exact = q !== "" && options.some((o) => fold(o) === q);

  function pick(v: string) {
    onChange(v);
    setOpen(false);
    setQuery("");
  }

  return (
    <View style={{ gap: 6 }}>
      <Txt variant="caption" style={{ fontFamily: font.semibold }}>
        {label}
      </Txt>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label} : ${value || "non choisi"}`}
        accessibilityHint="Ouvre la liste pour choisir"
        accessibilityState={{ disabled: !!disabled }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: space.sm,
          minHeight: 52,
          paddingHorizontal: 14,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: t.inputBorder,
          backgroundColor: pressed ? t.surface2 : t.card,
          opacity: disabled ? 0.5 : 1,
        })}
      >
        <Ionicons name={icon} size={20} color={t.muted} />
        <Txt style={{ flex: 1, fontSize: 16, color: value ? t.text : t.muted }} numberOfLines={1}>
          {value || placeholder}
        </Txt>
        <Ionicons name="chevron-down" size={20} color={t.muted} />
      </Pressable>
      {disabled && disabledHint ? (
        <Txt variant="caption" tone="muted">
          {disabledHint}
        </Txt>
      ) : helper ? (
        <Txt variant="caption" tone="muted">
          {helper}
        </Txt>
      ) : null}

      {open ? (
        <Modal visible transparent animationType="slide" onRequestClose={() => setOpen(false)} statusBarTranslucent>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, justifyContent: "flex-end" }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Fermer"
              onPress={() => setOpen(false)}
              style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: t.overlay }}
            />
            <View
              accessibilityViewIsModal
              style={{
                height: "80%",
                backgroundColor: t.card,
                borderTopLeftRadius: radius.lg,
                borderTopRightRadius: radius.lg,
                paddingTop: space.md,
                paddingBottom: insets.bottom,
              }}
            >
              <View style={{ alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: t.border }} />
              <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: space.lg, paddingTop: space.md, gap: space.md }}>
                <Txt variant="heading" accessibilityRole="header" style={{ flex: 1 }}>
                  {label}
                </Txt>
                <Pressable accessibilityRole="button" accessibilityLabel="Fermer" hitSlop={10} onPress={() => setOpen(false)}>
                  <Ionicons name="close" size={24} color={t.text} />
                </Pressable>
              </View>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: space.sm,
                  margin: space.lg,
                  paddingHorizontal: 14,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: t.inputBorder,
                  backgroundColor: t.bg,
                }}
              >
                <Ionicons name="search" size={18} color={t.muted} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Rechercher ou écrire"
                  placeholderTextColor={t.muted}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={() => query.trim() && pick(filtered.length === 1 ? filtered[0]! : query.trim().toUpperCase())}
                  accessibilityLabel={`Rechercher : ${label}`}
                  style={[type.body, { flex: 1, color: t.text, paddingVertical: 12, fontSize: 16 }]}
                />
                {query ? (
                  <Pressable accessibilityRole="button" accessibilityLabel="Effacer la recherche" hitSlop={10} onPress={() => setQuery("")}>
                    <Ionicons name="close-circle" size={18} color={t.muted} />
                  </Pressable>
                ) : null}
              </View>

              <FlatList
                data={filtered}
                keyExtractor={(o) => o}
                keyboardShouldPersistTaps="handled"
                initialNumToRender={20}
                ListHeaderComponent={
                  q && !exact ? (
                    <OptionRow label={`Utiliser « ${query.trim().toUpperCase()} »`} hint="Tel qu'écrit sur la carte grise" icon="create-outline" onPress={() => pick(query.trim().toUpperCase())} />
                  ) : undefined
                }
                ListEmptyComponent={
                  loading ? (
                    <Txt tone="muted" style={{ padding: space.lg }}>
                      Chargement de la liste…
                    </Txt>
                  ) : !q ? (
                    <Txt tone="muted" style={{ padding: space.lg }}>
                      Écrivez le nom tel qu'il figure sur la carte grise.
                    </Txt>
                  ) : undefined
                }
                renderItem={({ item }) => <OptionRow label={item} selected={fold(item) === fold(value)} onPress={() => pick(item)} />}
              />
            </View>
          </KeyboardAvoidingView>
        </Modal>
      ) : null}
    </View>
  );
}

function OptionRow({ label, hint, icon, selected, onPress }: { label: string; hint?: string; icon?: IconName; selected?: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
        minHeight: 52,
        paddingHorizontal: space.lg,
        backgroundColor: pressed ? t.surface2 : selected ? t.primarySoft : "transparent",
        borderBottomWidth: 0.5,
        borderBottomColor: t.border,
      })}
    >
      {icon ? <Ionicons name={icon} size={20} color={t.primary} /> : null}
      <View style={{ flex: 1 }}>
        <Txt style={{ fontSize: 16, fontFamily: selected ? font.semibold : font.regular }} tone={icon ? "primary" : "default"}>
          {label}
        </Txt>
        {hint ? (
          <Txt variant="caption" tone="muted">
            {hint}
          </Txt>
        ) : null}
      </View>
      {selected ? <Ionicons name="checkmark" size={20} color={t.primary} /> : null}
    </Pressable>
  );
}
