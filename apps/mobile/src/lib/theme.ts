import { createContext, useContext } from "react";
import { useColorScheme } from "react-native";

/**
 * Design tokens. One accent (signal teal) for actions and the robot guide;
 * green / amber / red are kept for status only, so meaning stays obvious.
 */
const light = {
  bg: "#F3F6F9",
  card: "#FFFFFF",
  surface2: "#EAF0F5",
  text: "#0E1726",
  muted: "#5A6778",
  border: "#DFE6EE",
  /** Unfocused input outline: must be visible (>= 3:1). */
  inputBorder: "#7D8A9B",
  primary: "#06756E",
  primarySoft: "#DDF4F1",
  primaryText: "#FFFFFF",
  danger: "#C42F2F",
  dangerSoft: "#FDE8E8",
  warning: "#8F5400",
  warningSoft: "#FFF1DB",
  success: "#16733F",
  successSoft: "#E1F5EA",
  shadow: "#0E1726",
  overlay: "rgba(14,23,38,0.55)",
  /** Single-series chart marks (validated: lightness band, chroma, 3:1). */
  chart: "#0d9488",
  grid: "#E6EBF1",
};

const dark: typeof light = {
  bg: "#0A0F16",
  card: "#121923",
  surface2: "#1A2330",
  text: "#EBF0F6",
  muted: "#93A0B1",
  border: "#232E3C",
  inputBorder: "#5C6B80",
  primary: "#2CC8B9",
  primarySoft: "#0F302E",
  primaryText: "#04211F",
  danger: "#FF6B6B",
  dangerSoft: "#3A1616",
  warning: "#F5B04A",
  warningSoft: "#3A2A10",
  success: "#4CCB86",
  successSoft: "#113221",
  shadow: "#000000",
  overlay: "rgba(0,0,0,0.6)",
  chart: "#1aa89a",
  grid: "#1F2936",
};

export type Theme = typeof light;

/** Light (white) by default; the owner can choose dark, or follow the phone ("system"). */
export type ThemePreference = "system" | "light" | "dark";

export const ThemePreferenceContext = createContext<{
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
}>({ preference: "light", setPreference: () => {} });

export function useThemePreference() {
  return useContext(ThemePreferenceContext);
}

export function useColorMode(): "light" | "dark" {
  const system = useColorScheme();
  const { preference } = useContext(ThemePreferenceContext);
  if (preference === "system") return system === "dark" ? "dark" : "light";
  return preference;
}

export function useTheme(): Theme {
  return useColorMode() === "dark" ? dark : light;
}

/** Inter, loaded in the root layout. */
export const font = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  extrabold: "Inter_800ExtraBold",
} as const;

/** Type scale: [fontSize, lineHeight, font]. */
export const type = {
  display: { fontSize: 30, lineHeight: 36, fontFamily: font.extrabold, letterSpacing: -0.6 },
  title: { fontSize: 22, lineHeight: 28, fontFamily: font.bold, letterSpacing: -0.3 },
  heading: { fontSize: 17, lineHeight: 22, fontFamily: font.semibold },
  body: { fontSize: 15, lineHeight: 22, fontFamily: font.regular },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontFamily: font.semibold },
  caption: { fontSize: 13, lineHeight: 18, fontFamily: font.regular },
  label: { fontSize: 12, lineHeight: 16, fontFamily: font.semibold, letterSpacing: 0.6, textTransform: "uppercase" as const },
  micro: { fontSize: 11, lineHeight: 15, fontFamily: font.regular },
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 10, md: 14, lg: 20, pill: 999 } as const;

/** Paint colors offered when adding a car (a VIN does not encode the color). */
export const PAINT_COLORS = [
  { name: "Blanc", hex: "#f2f2f2" },
  { name: "Noir", hex: "#1b1b1d" },
  { name: "Gris", hex: "#8a9099" },
  { name: "Argent", hex: "#c4c8cc" },
  { name: "Bleu", hex: "#1f4e9c" },
  { name: "Rouge", hex: "#b3202a" },
  { name: "Vert", hex: "#2f6b3f" },
  { name: "Beige", hex: "#cdb994" },
  { name: "Marron", hex: "#5a3d2b" },
  { name: "Jaune", hex: "#e7b923" },
  { name: "Orange", hex: "#d9661f" },
];
