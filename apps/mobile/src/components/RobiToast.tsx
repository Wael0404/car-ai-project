import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AccessibilityInfo, Animated, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Robot, type RobotMood } from "@/components/Robot";
import { Txt } from "@/components/ui";
import { useReduceMotion } from "@/lib/motion";
import { radius, space, useTheme } from "@/lib/theme";

/**
 * Robi reacts to what the owner just did ("Bravo, c'est noté !"): a small
 * robot pops up at the bottom with a message, then leaves by itself.
 */

interface Message {
  id: number;
  text: string;
  title?: string;
  mood: RobotMood;
}

interface RobiApi {
  say: (text: string, opts?: { title?: string; mood?: RobotMood }) => void;
  /** Space a screen keeps free at the bottom (e.g. a floating button). */
  setBottomInset: (px: number) => void;
}

const RobiContext = createContext<RobiApi>({ say: () => {}, setBottomInset: () => {} });

/** robi.say("Vidange enregistrée", { mood: "celebrate" }) */
export function useRobi() {
  return useContext(RobiContext);
}

/** While this screen is shown, Robi's messages stay above its bottom button. */
export function useRobiBottomInset(px: number) {
  const { setBottomInset } = useRobi();
  useEffect(() => {
    setBottomInset(px);
    return () => setBottomInset(0);
  }, [px, setBottomInset]);
}

export function RobiProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<Message | null>(null);
  const [bottomInset, setBottomInset] = useState(0);
  const next = useRef(1);
  const say = useCallback((text: string, opts?: { title?: string; mood?: RobotMood }) => {
    setMessage({ id: next.current++, text, title: opts?.title, mood: opts?.mood ?? "happy" });
    AccessibilityInfo.announceForAccessibility([opts?.title, text].filter(Boolean).join(". "));
  }, []);
  // Only removes this message: a newer one that replaced it stays.
  const clear = useCallback((id: number) => setMessage((m) => (m?.id === id ? null : m)), []);
  const value = useMemo(() => ({ say, setBottomInset }), [say]);
  return (
    <RobiContext.Provider value={value}>
      {children}
      {message ? <RobiBubble key={message.id} message={message} bottomInset={bottomInset} onDone={clear} /> : null}
    </RobiContext.Provider>
  );
}

function RobiBubble({ message, bottomInset, onDone }: { message: Message; bottomInset: number; onDone: (id: number) => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const [show] = useState(() => new Animated.Value(0));

  // Leave, then remove this message (not a newer one that replaced it).
  const leave = useCallback(
    (duration: number) =>
      Animated.timing(show, { toValue: 0, duration: reduceMotion ? 0 : duration, useNativeDriver: true }).start(({ finished }) => {
        if (finished) onDone(message.id);
      }),
    [show, reduceMotion, onDone, message.id],
  );

  useEffect(() => {
    const enter = reduceMotion
      ? Animated.timing(show, { toValue: 1, duration: 0, useNativeDriver: true })
      : Animated.spring(show, { toValue: 1, useNativeDriver: true, speed: 13, bounciness: 9 });
    enter.start();
    // Longer for long messages, and as long as the owner's accessibility
    // setting asks (Android "Time to take action").
    const wanted = Math.min(6500, 2600 + message.text.length * 35);
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    AccessibilityInfo.getRecommendedTimeoutMillis(wanted)
      .catch(() => wanted)
      .then((ms) => {
        if (alive) timer = setTimeout(() => leave(220), ms);
      });
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [message, reduceMotion, show, leave]);

  return (
    <View
      pointerEvents="box-none"
      style={{ position: "absolute", left: 0, right: 0, bottom: insets.bottom + space.lg + bottomInset, paddingHorizontal: space.lg }}
    >
      <Animated.View
        accessibilityLiveRegion="polite"
        style={{
          opacity: show,
          transform: [
            { translateY: show.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) },
            { scale: show.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
          ],
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${[message.title, message.text].filter(Boolean).join(". ")}. Toucher pour fermer`}
          onPress={() => leave(160)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: space.md,
            padding: space.md,
            paddingRight: space.lg,
            borderRadius: radius.lg,
            backgroundColor: t.card,
            borderWidth: 1,
            borderColor: t.primarySoft,
            shadowColor: t.shadow,
            shadowOpacity: 0.18,
            shadowRadius: 18,
            shadowOffset: { width: 0, height: 8 },
            elevation: 8,
          }}
        >
          <Robot size={52} mood={message.mood} />
          <View style={{ flex: 1, gap: 2 }}>
            {message.title ? <Txt variant="bodyStrong">{message.title}</Txt> : null}
            <Txt variant="caption" tone={message.title ? "muted" : "default"}>
              {message.text}
            </Txt>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}
