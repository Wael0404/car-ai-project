import { useEffect, useState, type ReactNode } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { useReduceMotion } from "@/lib/motion";
import Svg, { Circle, G, Path, Rect } from "react-native-svg";
import { Button, Txt } from "@/components/ui";
import { radius, space, useTheme } from "@/lib/theme";

export type RobotMood = "happy" | "thinking" | "alert" | "wave";

/**
 * Robi, the app's guide: a small friendly robot drawn in SVG. It floats
 * gently, blinks, and changes its face with the situation.
 */
export function Robot({ size = 72, mood = "happy" }: { size?: number; mood?: RobotMood }) {
  const t = useTheme();
  const [float] = useState(() => new Animated.Value(0));
  const [blink, setBlink] = useState(false);
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    if (reduceMotion) return; // decorative only: stay still when asked
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    const timer = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 140);
    }, 3200);
    return () => {
      loop.stop();
      clearInterval(timer);
    };
  }, [float, reduceMotion]);

  const translateY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.06] });
  const body = t.primary;
  const face = "#0B1F2A";
  const eye = mood === "alert" ? "#FFB547" : "#7CF5E8";

  // Eyes: thinking looks up-right, blink squashes them.
  const eyeDy = mood === "thinking" ? -2 : 0;
  const eyeDx = mood === "thinking" ? 3 : 0;
  const eyeH = blink ? 1.5 : 7;

  return (
    <Animated.View style={{ transform: [{ translateY }] }} accessible accessibilityLabel="Robi, votre assistant">
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {/* antenna */}
        <Rect x={48} y={6} width={4} height={12} rx={2} fill={body} />
        <Circle cx={50} cy={6} r={5} fill={mood === "alert" ? "#FFB547" : "#7CF5E8"} />
        {/* ears */}
        <Rect x={10} y={36} width={8} height={18} rx={4} fill={body} />
        <Rect x={82} y={36} width={8} height={18} rx={4} fill={body} />
        {/* head */}
        <Rect x={16} y={18} width={68} height={54} rx={20} fill={body} />
        {/* visor */}
        <Rect x={24} y={28} width={52} height={34} rx={14} fill={face} />
        <G>
          <Rect x={35 + eyeDx} y={38 + eyeDy + (7 - eyeH) / 2} width={8} height={eyeH} rx={3} fill={eye} />
          <Rect x={57 + eyeDx} y={38 + eyeDy + (7 - eyeH) / 2} width={8} height={eyeH} rx={3} fill={eye} />
        </G>
        {mood === "happy" || mood === "wave" ? (
          <Path d="M40 52 Q50 59 60 52" stroke={eye} strokeWidth={3} fill="none" strokeLinecap="round" />
        ) : mood === "thinking" ? (
          <G>
            <Circle cx={44} cy={54} r={1.8} fill={eye} />
            <Circle cx={50} cy={54} r={1.8} fill={eye} />
            <Circle cx={56} cy={54} r={1.8} fill={eye} />
          </G>
        ) : (
          <Rect x={44} y={52} width={12} height={3} rx={1.5} fill={eye} />
        )}
        {/* body */}
        <Rect x={30} y={74} width={40} height={20} rx={9} fill={body} opacity={0.9} />
        <Circle cx={50} cy={84} r={4} fill={face} />
        {/* waving arm */}
        {mood === "wave" ? (
          <Path d="M72 80 Q86 72 88 60" stroke={body} strokeWidth={6} fill="none" strokeLinecap="round" />
        ) : (
          <Rect x={72} y={78} width={10} height={6} rx={3} fill={body} />
        )}
        <Rect x={18} y={78} width={10} height={6} rx={3} fill={body} />
      </Svg>
    </Animated.View>
  );
}

/**
 * Robi + a speech bubble: one short, useful message about the current
 * screen, with an optional action.
 */
export function RobotGuide({
  mood = "happy",
  title,
  children,
  action,
  compact,
}: {
  mood?: RobotMood;
  title?: string;
  children: ReactNode;
  action?: { label: string; onPress: () => void };
  compact?: boolean;
}) {
  const t = useTheme();
  return (
    <View style={styles.wrap} accessibilityRole="summary">
      <Robot size={compact ? 52 : 64} mood={mood} />
      <View style={[styles.bubble, { backgroundColor: t.card, borderColor: t.border, shadowColor: t.shadow }]}>
        <View style={[styles.tail, { backgroundColor: t.card, borderColor: t.border }]} />
        {title ? <Txt variant="bodyStrong">{title}</Txt> : null}
        {typeof children === "string" ? (
          <Txt variant={compact ? "caption" : "body"} tone="muted">
            {children}
          </Txt>
        ) : (
          children
        )}
        {action ? (
          <View style={{ marginTop: space.sm }}>
            <Button label={action.label} onPress={action.onPress} variant="secondary" size="md" />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  bubble: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.md,
    gap: 4,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  tail: {
    position: "absolute",
    left: -6,
    top: 22,
    width: 12,
    height: 12,
    transform: [{ rotate: "45deg" }],
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
