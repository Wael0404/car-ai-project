import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Pressable, View } from "react-native";
import { Txt } from "@/components/ui";
import { PAINT_COLORS, space, useTheme } from "@/lib/theme";

/** Light paints need a dark check mark to stay visible. */
const isLight = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114 > 170;
};

export function ColorPicker({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const t = useTheme();
  const selected = PAINT_COLORS.find((c) => c.hex.toLowerCase() === value.toLowerCase());
  return (
    <View style={{ gap: space.sm }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.md }} accessibilityRole="radiogroup">
        {PAINT_COLORS.map((c) => {
          const active = c.hex.toLowerCase() === value.toLowerCase();
          return (
            <Pressable
              key={c.hex}
              accessibilityRole="radio"
              accessibilityLabel={c.name}
              accessibilityState={{ selected: active }}
              onPress={() => {
                void Haptics.selectionAsync().catch(() => {});
                onChange(c.hex);
              }}
              hitSlop={4}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: c.hex,
                borderWidth: active ? 3 : 1,
                borderColor: active ? t.primary : t.border,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {active ? <Ionicons name="checkmark" size={20} color={isLight(c.hex) ? "#111" : "#fff"} /> : null}
            </Pressable>
          );
        })}
      </View>
      {selected ? (
        <Txt variant="caption" tone="muted">
          {selected.name}
        </Txt>
      ) : null}
    </View>
  );
}
