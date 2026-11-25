import * as SecureStore from "expo-secure-store";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Appearance } from "react-native";
import { ThemePreferenceContext, type ThemePreference } from "@/lib/theme";

// v2: the default became "light" (white). Earlier saved choices are reset once.
const KEY = "carai.theme.v2";
const DEFAULT: ThemePreference = "light";

/** Native parts (alerts, keyboard, date pickers) follow the same choice. */
function applyNative(p: ThemePreference) {
  try {
    Appearance.setColorScheme(p === "system" ? "unspecified" : p);
  } catch {
    // Not supported on this platform: the app's own screens still follow the choice.
  }
}

/** Saved choice, read synchronously so the first frame already has the right colors. */
function savedPreference(): ThemePreference {
  try {
    const v = SecureStore.getItem(KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    // Storage unavailable: use the default.
  }
  return DEFAULT;
}

/** Remembers the owner's choice: light (default), dark, or follow the phone. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(savedPreference);

  // Once at start: native parts follow the saved choice (no flash, one switch).
  const [initial] = useState(preference);
  useEffect(() => applyNative(initial), [initial]);

  const value = useMemo(
    () => ({
      preference,
      setPreference: (p: ThemePreference) => {
        setPreferenceState(p);
        applyNative(p);
        void SecureStore.setItemAsync(KEY, p).catch(() => {});
      },
    }),
    [preference],
  );

  return <ThemePreferenceContext.Provider value={value}>{children}</ThemePreferenceContext.Provider>;
}
