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

const RobiContext = createContext<{ say: (text: string, opts?: { title?: string; mood?: RobotMood }) => void }>({
  say: () => {},
});

/** robi.say("Vidange enregistrée", { mood: "celebrate" }) */
export function useRobi() {
  return useContext(RobiContext);
}

export function RobiProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<Message | null>(null);
  const next = useRef(1);
  const say = useCallback((text: string, opts?: { title?: string; mood?: RobotMood }) => {
    setMessage({ id: next.current++, text, title: opts?.title, mood: opts?.mood ?? "happy" });
    AccessibilityInfo.announceForAccessibility([opts?.title, text].filter(Boolean).join(". "));
  }, []);
  const value = useMemo(() => ({ say }), [say]);
  const clear = useCallback(() => setMessage(null), []);
  return (
    <RobiContext.Provider value={value}>
      {children}
      {message ? <RobiBubble key={message.id} message={message} onDone={clear} /> : null}
    </RobiContext.Provider>
  );
}

function RobiBubble({ message, onDone }: { message: Message; onDone: () => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const [show] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const visibleMs = Math.min(6500, 2600 + message.text.length * 35);
    const enter = reduceMotion
      ? Animated.timing(show, { toValue: 1, duration: 0, useNativeDriver: true })
      : Animated.spring(show, { toValue: 1, useNativeDriver: true, speed: 13, bounciness: 9 });
    enter.start();
    const timer = setTimeout(() => {
      Animated.timing(show, { toValue: 0, duration: reduceMotion ? 0 : 220, useNativeDriver: true }).start(() => onDone());
    }, visibleMs);
    return () => clearTimeout(timer);
  }, [message, onDone, reduceMotion, show]);

  return (
    <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, bottom: insets.bottom + space.lg, paddingHorizontal: space.lg }}>
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
          onPress={() => Animated.timing(show, { toValue: 0, duration: 160, useNativeDriver: true }).start(() => onDone())}
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
