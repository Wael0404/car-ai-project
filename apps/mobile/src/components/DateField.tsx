import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Modal, Platform, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Txt, type IconName } from "@/components/ui";
import { dateLongFr } from "@/lib/format";
import { font, radius, space, useColorMode, useTheme } from "@/lib/theme";

const two = (n: number) => String(n).padStart(2, "0");
const toIso = (d: Date) => `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;

/** "2020-11-30", "2020/11/30" or "30/11/2020" -> local date at noon, else null. */
export function parseAnyDate(value: string | null | undefined): Date | null {
  const v = value?.trim();
  if (!v) return null;
  let m = v.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
  m = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), 12);
  return null;
}

/**
 * Date chosen with the phone's own calendar (no typing). Value as
 * "YYYY-MM-DD"; past dates only by default.
 */
export function DateField({
  label,
  icon = "calendar-outline",
  value,
  onChange,
  helper,
  minimumDate = new Date(1950, 0, 1),
  maximumDate = new Date(),
}: {
  label: string;
  icon?: IconName;
  value: string | null | undefined;
  onChange: (iso: string | null) => void;
  helper?: string;
  minimumDate?: Date;
  maximumDate?: Date;
}) {
  const t = useTheme();
  const mode = useColorMode();
  const insets = useSafeAreaInsets();
  const current = parseAnyDate(value);
  const [iosOpen, setIosOpen] = useState(false);
  const [iosDraft, setIosDraft] = useState<Date>(current ?? maximumDate);

  function open() {
    const start = current ?? maximumDate;
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: start,
        mode: "date",
        minimumDate,
        maximumDate,
        positiveButton: { label: "OK" },
        negativeButton: { label: "Annuler" },
        onValueChange: (_e, date) => onChange(toIso(date)),
      });
    } else {
      setIosDraft(start);
      setIosOpen(true);
    }
  }

  return (
    <View style={{ gap: 6 }}>
      <Txt variant="caption" style={{ fontFamily: font.semibold }}>
        {label}
      </Txt>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label} : ${current ? dateLongFr(toIso(current)) : "non choisie"}`}
          accessibilityHint="Ouvre le calendrier"
          onPress={open}
          style={({ pressed }) => ({
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            gap: space.sm,
            minHeight: 52,
            paddingHorizontal: 14,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: t.inputBorder,
            backgroundColor: pressed ? t.surface2 : t.card,
          })}
        >
          <Ionicons name={icon} size={20} color={t.muted} />
          <Txt style={{ flex: 1, fontSize: 16, color: current ? t.text : t.muted }}>
            {current ? dateLongFr(toIso(current)) : "Choisir une date"}
          </Txt>
          <Ionicons name="chevron-down" size={20} color={t.muted} />
        </Pressable>
        {current ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Effacer : ${label}`}
            onPress={() => onChange(null)}
            style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
          >
            <Ionicons name="close-circle" size={22} color={t.muted} />
          </Pressable>
        ) : null}
      </View>
      {helper ? (
        <Txt variant="caption" tone="muted">
          {helper}
        </Txt>
      ) : null}

      {Platform.OS === "ios" && iosOpen ? (
        <Modal visible transparent animationType="slide" onRequestClose={() => setIosOpen(false)}>
          <View style={{ flex: 1, justifyContent: "flex-end" }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Fermer"
              onPress={() => setIosOpen(false)}
              style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: t.overlay }}
            />
            <View style={{ backgroundColor: t.card, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: space.lg, paddingBottom: space.lg + insets.bottom, gap: space.md }}>
              <Txt variant="heading">{label}</Txt>
              <DateTimePicker
                value={iosDraft}
                mode="date"
                display="spinner"
                locale="fr-FR"
                themeVariant={mode}
                minimumDate={minimumDate}
                maximumDate={maximumDate}
                onValueChange={(_e, date) => setIosDraft(date)}
              />
              <Button
                label="Valider"
                onPress={() => {
                  onChange(toIso(iosDraft));
                  setIosOpen(false);
                }}
              />
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}
