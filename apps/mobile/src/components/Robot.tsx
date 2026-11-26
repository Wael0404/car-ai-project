import * as Haptics from "expo-haptics";
import { useEffect, useState, type ReactNode } from "react";
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, View } from "react-native";
import Svg, { Circle, Ellipse, G, Path, Rect } from "react-native-svg";
import { Button, Txt } from "@/components/ui";
import { useReduceMotion } from "@/lib/motion";
import { radius, space, useTheme } from "@/lib/theme";

export type RobotMood = "happy" | "thinking" | "alert" | "wave" | "celebrate";

const FACE = "#0B1F2A";
const CYAN = "#7CF5E8";
const AMBER = "#FFB547";

/** Every layer shares the robot's 100x100 grid, so parts line up exactly. */
function Layer({ size, children, style }: { size: number; children: ReactNode; style?: object }) {
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {children}
      </Svg>
    </Animated.View>
  );
}

const loop = (anim: Animated.CompositeAnimation) => Animated.loop(anim);
const tween = (v: Animated.Value, toValue: number, duration: number, easing = Easing.inOut(Easing.sin)) =>
  Animated.timing(v, { toValue, duration, easing, useNativeDriver: true });

/**
 * Robi, the app's assistant, drawn in SVG and animated in layers on the
 * native thread: it floats, blinks, looks around while it thinks (antenna
 * pulsing), waves hello, jumps with joy, and moves its mouth while talking.
 * Still when the phone asks to reduce motion.
 */
export function Robot({
  size = 72,
  mood = "happy",
  talking = false,
  onPress,
}: {
  size?: number;
  mood?: RobotMood;
  /** Mouth moves (while a message is being written). */
  talking?: boolean;
  /** Robi reacts to a tap (wiggle) then calls this. */
  onPress?: () => void;
}) {
  const t = useTheme();
  const reduceMotion = useReduceMotion();
  const [v] = useState(() => ({
    float: new Animated.Value(0),
    jump: new Animated.Value(0),
    tilt: new Animated.Value(0),
    blink: new Animated.Value(1),
    look: new Animated.Value(0),
    mouth: new Animated.Value(1),
    arm: new Animated.Value(0),
    halo: new Animated.Value(0),
    sparkle: new Animated.Value(0),
  }));

  // Idle life: float + blink + antenna halo (faster while thinking).
  useEffect(() => {
    if (reduceMotion) return;
    const thinking = mood === "thinking";
    const anims = [
      loop(Animated.sequence([tween(v.float, 1, thinking ? 900 : 1400), tween(v.float, 0, thinking ? 900 : 1400)])),
      loop(Animated.sequence([Animated.delay(2600), tween(v.blink, 0.1, 70, Easing.linear), tween(v.blink, 1, 90, Easing.linear)])),
      loop(
        Animated.sequence([
          Animated.timing(v.halo, { toValue: 1, duration: thinking ? 750 : 1600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(v.halo, { toValue: 0, duration: 0, useNativeDriver: true }),
          Animated.delay(thinking ? 100 : 900),
        ]),
      ),
    ];
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, [mood, reduceMotion, v]);

  // Mood-specific moves.
  useEffect(() => {
    if (reduceMotion) return;
    let anim: Animated.CompositeAnimation | null = null;
    if (mood === "thinking") {
      // Eyes scan left and right, head slightly tilted: "I'm looking for it".
      anim = Animated.parallel([
        loop(Animated.sequence([tween(v.look, -1, 500), Animated.delay(250), tween(v.look, 1, 700), Animated.delay(250), tween(v.look, 0, 400)])),
        tween(v.tilt, -0.6, 400),
      ]);
    } else if (mood === "wave") {
      anim = Animated.sequence([
        Animated.delay(200),
        Animated.loop(Animated.sequence([tween(v.arm, 1, 220), tween(v.arm, 0.2, 220)]), { iterations: 3 }),
        tween(v.arm, 0, 250),
      ]);
    } else if (mood === "celebrate") {
      anim = Animated.parallel([
        Animated.sequence([
          Animated.spring(v.jump, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 10 }),
          Animated.spring(v.jump, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 12 }),
          Animated.spring(v.jump, { toValue: 0.6, useNativeDriver: true, speed: 18, bounciness: 8 }),
          Animated.spring(v.jump, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 10 }),
        ]),
        Animated.sequence([Animated.timing(v.sparkle, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true })]),
        Animated.loop(Animated.sequence([tween(v.arm, 1, 200), tween(v.arm, 0.4, 200)]), { iterations: 3 }),
      ]);
      v.sparkle.setValue(0);
    } else if (mood === "alert") {
      // A short shake to catch the eye, once.
      anim = Animated.sequence([tween(v.tilt, 1, 70), tween(v.tilt, -1, 90), tween(v.tilt, 0.6, 80), tween(v.tilt, 0, 80)]);
    } else {
      // Happy: glance around now and then.
      anim = loop(Animated.sequence([Animated.delay(3800), tween(v.look, 0.6, 300), Animated.delay(500), tween(v.look, 0, 300)]));
    }
    anim.start();
    return () => {
      anim?.stop();
      v.look.setValue(0);
      v.tilt.setValue(0);
      v.arm.setValue(0);
      v.jump.setValue(0);
    };
  }, [mood, reduceMotion, v]);

  // Mouth moves while talking.
  useEffect(() => {
    if (reduceMotion || !talking) return;
    const a = loop(Animated.sequence([tween(v.mouth, 0.25, 110, Easing.linear), tween(v.mouth, 1, 130, Easing.linear)]));
    a.start();
    return () => {
      a.stop();
      v.mouth.setValue(1);
    };
  }, [talking, reduceMotion, v]);

  function poke() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (!reduceMotion) {
      Animated.sequence([tween(v.tilt, 1, 80), tween(v.tilt, -1, 120), tween(v.tilt, 0, 100)]).start();
    }
    onPress?.();
  }

  const body = t.primary;
  const eye = mood === "alert" ? AMBER : CYAN;
  const u = size / 100; // one grid unit in px

  const bodyMotion = {
    transform: [
      { translateY: Animated.add(v.float.interpolate({ inputRange: [0, 1], outputRange: [0, -6 * u] }), v.jump.interpolate({ inputRange: [0, 1], outputRange: [0, -22 * u] })) },
      { rotate: v.tilt.interpolate({ inputRange: [-1, 1], outputRange: ["-8deg", "8deg"] }) },
    ],
  };

  const smile = mood === "happy" || mood === "wave" || mood === "celebrate";
  const robot = (
    <Animated.View style={[{ width: size, height: size }, bodyMotion]}>
      {/* antenna halo */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 50 * u - 6 * u,
          top: 6 * u - 6 * u,
          width: 12 * u,
          height: 12 * u,
          borderRadius: 6 * u,
          backgroundColor: eye,
          opacity: v.halo.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
          transform: [{ scale: v.halo.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] }) }],
        }}
      />
      {/* body, head, visor */}
      <Layer size={size}>
        <Rect x={48} y={6} width={4} height={12} rx={2} fill={body} />
        <Circle cx={50} cy={6} r={5} fill={eye} />
        <Rect x={10} y={36} width={8} height={18} rx={4} fill={body} />
        <Rect x={82} y={36} width={8} height={18} rx={4} fill={body} />
        <Rect x={16} y={18} width={68} height={54} rx={20} fill={body} />
        <Rect x={24} y={28} width={52} height={34} rx={14} fill={FACE} />
        <Rect x={30} y={74} width={40} height={20} rx={9} fill={body} opacity={0.9} />
        <Circle cx={50} cy={84} r={4} fill={FACE} />
        {/* left arm, mirror of the waving one */}
        <Rect x={14} y={78} width={14} height={6} rx={3} fill={body} />
        <Circle cx={13} cy={81} r={3.6} fill={body} />
      </Layer>
      {/* eyes: look around + blink */}
      <Layer
        size={size}
        style={{
          transformOrigin: "50% 41.5%",
          transform: [
            { translateX: v.look.interpolate({ inputRange: [-1, 1], outputRange: [-4 * u, 4 * u] }) },
            { translateY: mood === "thinking" ? -2 * u : 0 },
            { scaleY: v.blink },
          ],
        }}
      >
        <Rect x={35} y={38} width={8} height={7} rx={3} fill={eye} />
        <Rect x={57} y={38} width={8} height={7} rx={3} fill={eye} />
      </Layer>
      {/* mouth: talks */}
      <Layer size={size} style={{ transformOrigin: "50% 54%", transform: [{ scaleY: v.mouth }] }}>
        {talking ? (
          <Ellipse cx={50} cy={54} rx={6} ry={3.6} fill={eye} />
        ) : smile ? (
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
      </Layer>
      {/* right arm: waves from the shoulder */}
      <Layer
        size={size}
        style={{
          transformOrigin: "73% 81%",
          transform: [{ rotate: v.arm.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "-70deg"] }) }],
        }}
      >
        <Rect x={72} y={78} width={14} height={6} rx={3} fill={body} />
        <Circle cx={87} cy={81} r={3.6} fill={body} />
      </Layer>
      {/* sparkles when celebrating */}
      {mood === "celebrate"
        ? [0, 1, 2, 3, 4, 5].map((i) => {
            const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
            const dist = 46 * u;
            return (
              <Animated.View
                key={i}
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: 50 * u - 4 * u,
                  top: 40 * u - 4 * u,
                  width: 8 * u,
                  height: 8 * u,
                  borderRadius: 4 * u,
                  backgroundColor: i % 2 ? AMBER : CYAN,
                  opacity: v.sparkle.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 0] }),
                  transform: [
                    { translateX: v.sparkle.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(angle) * dist] }) },
                    { translateY: v.sparkle.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(angle) * dist] }) },
                    { scale: v.sparkle.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.4, 1.2, 0.6] }) },
                  ],
                }}
              />
            );
          })
        : null}
    </Animated.View>
  );

  if (!onPress) {
    return (
      <View accessible accessibilityLabel="Robi, votre assistant" style={{ width: size, height: size }}>
        {robot}
      </View>
    );
  }
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Robi, votre assistant" onPress={poke} hitSlop={8} style={{ width: size, height: size }}>
      {robot}
    </Pressable>
  );
}

/** Three dots bouncing: "Robi is writing…". */
function TypingDots() {
  const t = useTheme();
  const [dots] = useState(() => [0, 1, 2].map(() => new Animated.Value(0)));
  useEffect(() => {
    const a = Animated.loop(
      Animated.stagger(
        140,
        dots.map((d) => Animated.sequence([tween(d, 1, 220), tween(d, 0, 220)])),
      ),
    );
    a.start();
    return () => a.stop();
  }, [dots]);
  return (
    <View style={{ flexDirection: "row", gap: 5, paddingVertical: 6 }} accessibilityLabel="Robi écrit">
      {dots.map((d, i) => (
        <Animated.View
          key={i}
          style={{
            width: 7,
            height: 7,
            borderRadius: 4,
            backgroundColor: t.muted,
            transform: [{ translateY: d.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) }],
            opacity: d.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
          }}
        />
      ))}
    </View>
  );
}

/**
 * Text written as if Robi were typing it (fast). Screen readers get the
 * whole sentence at once. Restarts only when the text changes.
 */
function useTypewriter(text: string | null, enabled: boolean) {
  const animate = enabled && !!text;
  const [st, setSt] = useState({ text, shown: 0, done: !animate });
  // New message: start again (adjusting state while rendering, as React recommends).
  if (st.text !== text) setSt({ text, shown: 0, done: !animate });

  // Only timers here; safe when React runs effects twice in development.
  useEffect(() => {
    if (!animate || !text) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const pause = setTimeout(() => {
      // About 90 characters per second, in ~45 steps at most.
      const step = Math.max(2, Math.ceil(text.length / 45));
      timer = setInterval(() => {
        setSt((s) => {
          const shown = Math.min(text.length, s.shown + step);
          if (shown >= text.length && timer) clearInterval(timer);
          return { ...s, shown, done: shown >= text.length };
        });
      }, 22);
    }, 450);
    return () => {
      clearTimeout(pause);
      if (timer) clearInterval(timer);
    };
  }, [text, animate]);

  if (!animate) return { shown: text?.length ?? 0, typing: false, waiting: false };
  return { shown: st.shown, typing: !st.done, waiting: !st.done && st.shown === 0 };
}

/**
 * Robi + a speech bubble: one short, useful message about the current
 * screen, with an optional action. The bubble pops in, Robi "writes" the
 * message (dots, then the text appears) and moves its mouth meanwhile.
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
  const reduceMotion = useReduceMotion();
  const text = typeof children === "string" ? children : null;
  const { shown, typing, waiting } = useTypewriter(text, !reduceMotion);
  const [pop] = useState(() => new Animated.Value(reduceMotion ? 1 : 0));

  useEffect(() => {
    if (reduceMotion) {
      pop.setValue(1);
      return;
    }
    pop.setValue(0);
    Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 7 }).start();
  }, [pop, reduceMotion, title, text]);

  useEffect(() => {
    // Screen readers hear the message even while it is being "typed".
    if (text && mood === "alert") AccessibilityInfo.announceForAccessibility([title, text].filter(Boolean).join(". "));
  }, [text, title, mood]);

  return (
    <View style={styles.wrap} accessibilityRole="summary">
      <Robot size={compact ? 52 : 64} mood={mood} talking={typing && !waiting} />
      <Animated.View
        style={[
          styles.bubble,
          { backgroundColor: t.card, borderColor: t.border, shadowColor: t.shadow },
          {
            opacity: pop,
            transform: [
              { translateX: pop.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) },
              { scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
            ],
          },
        ]}
      >
        <View style={[styles.tail, { backgroundColor: t.card, borderColor: t.border }]} />
        {title ? <Txt variant="bodyStrong">{title}</Txt> : null}
        {text !== null ? (
          waiting ? (
            <TypingDots />
          ) : (
            <Txt variant={compact ? "caption" : "body"} tone="muted" accessibilityLabel={text}>
              {text.slice(0, shown)}
              {/* keep the bubble's final height while typing: the rest is invisible */}
              <Txt variant={compact ? "caption" : "body"} style={{ color: "transparent" }}>
                {text.slice(shown)}
              </Txt>
            </Txt>
          )
        ) : (
          children
        )}
        {action ? (
          <View style={{ marginTop: space.sm }}>
            <Button label={action.label} onPress={action.onPress} variant="secondary" size="md" />
          </View>
        ) : null}
      </Animated.View>
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
