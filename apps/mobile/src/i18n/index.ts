import { AR, FR, type TKey } from "./strings";

/**
 * Translations: French (default) and Arabic. The language is chosen by the
 * owner (Paramètres) and kept on the phone. Changing it remounts the app,
 * so every screen simply calls t() while rendering.
 *
 *   t("garage.title")                       -> "Mes voitures" / "سياراتي"
 *   t("vehicle.km", { km: "85 000" })       -> "{km}" placeholders
 *   tp("history.services", 3)               -> plural forms (_one, _two, _few, _many, _other)
 */

export type Lang = "fr" | "ar";
export type { TKey };

let current: Lang = "fr";

export const getLang = (): Lang => current;
export const isRTL = (): boolean => current === "ar";
/** Used by the language provider only. */
export const setCurrentLang = (lang: Lang) => {
  current = lang;
};

type Params = Record<string, string | number | null | undefined>;

function fill(s: string, params?: Params): string {
  if (!params) return s;
  return s.replace(/\{(\w+)\}/g, (all, k: string) => (params[k] === undefined || params[k] === null ? all : String(params[k])));
}

function lookup(key: string): string | undefined {
  const dict = (current === "ar" ? AR : FR) as Record<string, string>;
  return dict[key] ?? (FR as Record<string, string>)[key];
}

/** The text for this key in the current language (French if missing). */
export function t(key: TKey, params?: Params): string {
  return fill(lookup(key) ?? key, params);
}

const MIRROR: Record<string, string> = {
  "chevron-forward": "chevron-back",
  "chevron-back": "chevron-forward",
  "arrow-forward": "arrow-back",
  "arrow-back": "arrow-forward",
  "arrow-forward-circle-outline": "arrow-back-circle-outline",
  "chevron-forward-outline": "chevron-back-outline",
};

/**
 * Icons that point "forward" must point left in Arabic (right-to-left):
 * dirIcon("chevron-forward") -> "chevron-back" when the language is Arabic.
 */
export function dirIcon<T extends string>(name: T): T {
  return (current === "ar" ? (MIRROR[name] ?? name) : name) as T;
}

/** Plural category: French one/other; Arabic zero/one/two/few/many/other. */
function category(n: number): string {
  const abs = Math.abs(n);
  if (current === "fr") return abs < 2 ? "one" : "other";
  const m = abs % 100;
  if (abs === 0) return "zero";
  if (abs === 1) return "one";
  if (abs === 2) return "two";
  if (m >= 3 && m <= 10) return "few";
  if (m >= 11 && m <= 99) return "many";
  return "other";
}

/**
 * Text with a number: picks `${base}_one`, `_two`, `_few`, `_many`, `_zero`
 * or `_other` (falls back to `_other`). `{count}` is filled automatically.
 */
export function tp(base: string, count: number, params?: Params): string {
  const cat = category(count);
  const s = lookup(`${base}_${cat}`) ?? lookup(`${base}_other`) ?? lookup(base) ?? base;
  return fill(s, { count, ...params });
}
