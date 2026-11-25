import * as SecureStore from "expo-secure-store";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ThemePreferenceContext, type ThemePreference } from "@/lib/theme";

const KEY = "carai.theme.v1";

/** Remembers the owner's choice: light, dark, or follow the phone. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("system");

  useEffect(() => {
    SecureStore.getItemAsync(KEY)
      .then((v) => {
        if (v === "light" || v === "dark" || v === "system") setPreferenceState(v);
      })
      .catch(() => {});
  }, []);

  const value = useMemo(
    () => ({
      preference,
      setPreference: (p: ThemePreference) => {
        setPreferenceState(p);
        void SecureStore.setItemAsync(KEY, p).catch(() => {});
      },
    }),
    [preference],
  );

  return <ThemePreferenceContext.Provider value={value}>{children}</ThemePreferenceContext.Provider>;
}
