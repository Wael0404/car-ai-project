import { useColorScheme } from "react-native";

const light = {
  bg: "#f5f6f8",
  card: "#ffffff",
  text: "#111418",
  muted: "#5f6b7a",
  border: "#e2e5ea",
  primary: "#1a5cff",
  primaryText: "#ffffff",
  danger: "#d62c2c",
  warning: "#b26a00",
  success: "#1e8e3e",
};

const dark: typeof light = {
  bg: "#0d1014",
  card: "#171b21",
  text: "#eef1f5",
  muted: "#97a3b3",
  border: "#262c35",
  primary: "#5b8cff",
  primaryText: "#ffffff",
  danger: "#ff6b6b",
  warning: "#f0a742",
  success: "#4cc26e",
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === "dark" ? dark : light;
}

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
