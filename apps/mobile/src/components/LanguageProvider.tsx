import * as SecureStore from "expo-secure-store";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { setCurrentLang, type Lang } from "@/i18n";
import { applyFonts } from "@/lib/theme";

const KEY = "carai.lang.v1";

function savedLang(): Lang {
  try {
    const v = SecureStore.getItem(KEY);
    if (v === "fr" || v === "ar") return v;
  } catch {
    // Storage unavailable: French.
  }
  return "fr";
}

// Set before the first render, so the very first frame is in the right language.
const initial = savedLang();
setCurrentLang(initial);
applyFonts(initial);

const LanguageContext = createContext<{ lang: Lang; isRTL: boolean; setLang: (l: Lang) => void }>({
  lang: initial,
  isRTL: initial === "ar",
  setLang: () => {},
});

/** Current language, right-to-left flag, and the setter (Paramètres). */
export function useLanguage() {
  return useContext(LanguageContext);
}

/**
 * Remembers the owner's language. Changing it switches texts, fonts and
 * direction; the app tree is remounted (key) so every screen follows.
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initial);
  const value = useMemo(
    () => ({
      lang,
      isRTL: lang === "ar",
      setLang: (l: Lang) => {
        setCurrentLang(l);
        applyFonts(l);
        setLangState(l);
        try {
          SecureStore.setItem(KEY, l);
        } catch {
          // Not saved: it still applies until the app is closed.
        }
      },
    }),
    [lang],
  );
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
