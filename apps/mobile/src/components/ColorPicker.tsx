import { Pressable, View } from "react-native";
import { PAINT_COLORS, useTheme } from "@/lib/theme";

export function ColorPicker({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
      {PAINT_COLORS.map((c) => {
        const selected = c.hex.toLowerCase() === value.toLowerCase();
        return (
          <Pressable
            key={c.hex}
            accessibilityRole="radio"
            accessibilityLabel={c.name}
            accessibilityState={{ selected }}
            onPress={() => onChange(c.hex)}
            hitSlop={4}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: c.hex,
              borderWidth: selected ? 3 : 1,
              borderColor: selected ? t.primary : t.border,
            }}
          />
        );
      })}
    </View>
  );
}
