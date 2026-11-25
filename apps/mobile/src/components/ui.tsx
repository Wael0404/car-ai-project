import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useEffect, useState, type ComponentProps, type ReactNode } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { useReduceMotion } from "@/lib/motion";
import { radius, space, type, useTheme } from "@/lib/theme";

export type IconName = ComponentProps<typeof Ionicons>["name"];

/* ----------------------------- Typography ----------------------------- */

type Variant = keyof typeof type;
type Tone = "default" | "muted" | "primary" | "danger" | "warning" | "success" | "inverse";

export function Txt({
  variant = "body",
  tone = "default",
  style,
  ...props
}: TextProps & { variant?: Variant; tone?: Tone; style?: StyleProp<TextStyle> }) {
  const t = useTheme();
  const color = {
    default: t.text,
    muted: t.muted,
    primary: t.primary,
    danger: t.danger,
    warning: t.warning,
    success: t.success,
    inverse: t.primaryText,
  }[tone];
  return <Text {...props} style={[type[variant], { color }, style]} />;
}

/** Kept for older components. */
export function Title({ children }: { children: ReactNode }) {
  return <Txt variant="title">{children}</Txt>;
}
export function Body({ children, muted, style }: { children: ReactNode; muted?: boolean; style?: StyleProp<TextStyle> }) {
  return (
    <Txt tone={muted ? "muted" : "default"} style={style}>
      {children}
    </Txt>
  );
}

/* ------------------------------- Layout ------------------------------- */

export function Screen({
  children,
  scroll = true,
  style,
}: {
  children: ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  if (!scroll) return <View style={[{ flex: 1, backgroundColor: t.bg, padding: space.lg }, style]}>{children}</View>;
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.bg }}
      contentContainerStyle={[{ padding: space.lg, gap: space.lg, paddingBottom: space.xxl * 2 }, style]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

export function Card({ children, style, padded = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  const t = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: t.card, borderColor: t.border, shadowColor: t.shadow, padding: padded ? space.lg : 0 },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: space.sm }}>
      <Txt variant="label" tone="muted">
        {children}
      </Txt>
      {action}
    </View>
  );
}

/* ------------------------------- Actions ------------------------------ */

export function Button({
  label,
  onPress,
  loading,
  disabled,
  icon,
  variant = "primary",
  size = "lg",
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "lg" | "md";
}) {
  const t = useTheme();
  const inactive = disabled || loading;
  const palette = {
    primary: { bg: t.primary, fg: t.primaryText, border: t.primary },
    secondary: { bg: t.primarySoft, fg: t.primary, border: t.primarySoft },
    ghost: { bg: "transparent", fg: t.primary, border: t.border },
    danger: { bg: "transparent", fg: t.danger, border: t.border },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={() => {
        void Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      style={({ pressed }) => [
        styles.button,
        {
          minHeight: size === "lg" ? 54 : 44,
          backgroundColor: palette.bg,
          borderColor: palette.border,
          opacity: inactive ? 0.45 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
          {icon ? <Ionicons name={icon} size={size === "lg" ? 20 : 18} color={palette.fg} /> : null}
          <Text style={[type.bodyStrong, { color: palette.fg, fontSize: size === "lg" ? 16 : 15 }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function IconButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, { backgroundColor: t.surface2, opacity: pressed ? 0.7 : 1 }]}
    >
      <Ionicons name={icon} size={20} color={t.text} />
    </Pressable>
  );
}

/* -------------------------------- Inputs ------------------------------ */

export function Field({
  label,
  error,
  helper,
  icon,
  ...props
}: TextInputProps & { label: string; error?: string | null; helper?: string; icon?: IconName }) {
  const t = useTheme();
  const [focused, setFocused] = useState(false);
  const borderColor = error ? t.danger : focused ? t.primary : t.inputBorder;
  return (
    <View style={{ gap: 6 }}>
      <Txt variant="caption" style={{ fontFamily: type.bodyStrong.fontFamily }}>
        {label}
      </Txt>
      <View style={[styles.input, { borderColor, backgroundColor: t.card, borderWidth: focused || error ? 2 : 1 }]}>
        {icon ? <Ionicons name={icon} size={20} color={focused ? t.primary : t.muted} /> : null}
        <TextInput
          placeholderTextColor={t.muted}
          accessibilityLabel={label}
          {...props}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          style={[type.body, { flex: 1, color: t.text, paddingVertical: 14, fontSize: 16 }, props.style]}
        />
      </View>
      {error ? (
        <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
          <Ionicons name="alert-circle" size={16} color={t.danger} />
          <Txt variant="caption" tone="danger" style={{ flex: 1 }}>
            {error}
          </Txt>
        </View>
      ) : helper ? (
        <Txt variant="caption" tone="muted">
          {helper}
        </Txt>
      ) : null}
    </View>
  );
}

/* ------------------------------- Display ------------------------------ */

export function Pill({ label, tone = "neutral", icon }: { label: string; tone?: "neutral" | "primary" | "success" | "warning" | "danger"; icon?: IconName }) {
  const t = useTheme();
  const c = {
    neutral: { bg: t.surface2, fg: t.muted },
    primary: { bg: t.primarySoft, fg: t.primary },
    success: { bg: t.successSoft, fg: t.success },
    warning: { bg: t.warningSoft, fg: t.warning },
    danger: { bg: t.dangerSoft, fg: t.danger },
  }[tone];
  return (
    <View style={[styles.pill, { backgroundColor: c.bg }]}>
      {icon ? <Ionicons name={icon} size={13} color={c.fg} /> : null}
      <Text style={[type.caption, { color: c.fg, fontFamily: type.bodyStrong.fontFamily, fontSize: 12 }]}>{label}</Text>
    </View>
  );
}

export function Row({ label, value }: { label: string; value: string | number | null | undefined }) {
  const t = useTheme();
  if (value === null || value === undefined || value === "") return null;
  return (
    <View style={[styles.row, { borderBottomColor: t.border }]}>
      <Txt variant="caption" tone="muted" style={{ flex: 1 }}>
        {label}
      </Txt>
      <Txt variant="caption" style={{ flex: 1.4, textAlign: "right", fontFamily: type.bodyStrong.fontFamily }}>
        {String(value)}
      </Txt>
    </View>
  );
}

/** Two to four tabs; keeps long screens short and focused. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string; icon?: IconName }>;
  onChange: (v: T) => void;
}) {
  const t = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: t.surface2 }]} accessibilityRole="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => {
              void Haptics.selectionAsync().catch(() => {});
              onChange(o.value);
            }}
            style={[styles.segment, active && { backgroundColor: t.card, shadowColor: t.shadow, ...styles.segmentActive }]}
          >
            {o.icon ? <Ionicons name={o.icon} size={16} color={active ? t.primary : t.muted} /> : null}
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              style={[type.caption, { color: active ? t.text : t.muted, fontFamily: type.bodyStrong.fontFamily }]}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Placeholder block while content loads (better than a lone spinner). */
export function Skeleton({ height = 16, width = "100%", style }: { height?: number; width?: ViewStyle["width"]; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  const reduceMotion = useReduceMotion();
  const [opacity] = useState(() => new Animated.Value(0.7));
  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, reduceMotion]);
  return <Animated.View style={[{ height, width, borderRadius: radius.sm, backgroundColor: t.surface2, opacity }, style]} />;
}

/** Steps of a background job, e.g. the AI analysis of a new car. */
export function Steps({ steps }: { steps: Array<{ label: string; state: "done" | "active" | "todo" }> }) {
  const t = useTheme();
  return (
    <View style={{ gap: space.md }}>
      {steps.map((s) => (
        <View key={s.label} style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
          <View
            style={[
              styles.stepDot,
              {
                backgroundColor: s.state === "done" ? t.success : s.state === "active" ? t.primarySoft : t.surface2,
                borderColor: s.state === "active" ? t.primary : "transparent",
              },
            ]}
          >
            {s.state === "done" ? (
              <Ionicons name="checkmark" size={14} color="#fff" />
            ) : s.state === "active" ? (
              <ActivityIndicator size="small" color={t.primary} />
            ) : null}
          </View>
          <Txt tone={s.state === "todo" ? "muted" : "default"} style={s.state === "active" ? { fontFamily: type.bodyStrong.fontFamily } : undefined}>
            {s.label}
          </Txt>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: space.md,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  button: {
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.lg,
  },
  iconButton: { width: 44, height: 44, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  input: { flexDirection: "row", alignItems: "center", gap: space.sm, borderRadius: radius.md, paddingHorizontal: 14 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  row: { flexDirection: "row", paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: space.md },
  segmented: { flexDirection: "row", borderRadius: radius.md, padding: 4, gap: 4 },
  segment: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 2,
    borderRadius: radius.sm,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentActive: { shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  stepDot: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: "center", justifyContent: "center" },
});
