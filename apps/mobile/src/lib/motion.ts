import { useSyncExternalStore } from "react";
import { AccessibilityInfo } from "react-native";

// Known value, shared by every component: read once at start, then kept up
// to date, so screens opened later never start an animation by mistake.
let current = false;
const listeners = new Set<() => void>();
const set = (v: boolean) => {
  if (v === current) return;
  current = v;
  listeners.forEach((l) => l());
};
AccessibilityInfo.isReduceMotionEnabled()
  .then(set)
  .catch(() => {});
AccessibilityInfo.addEventListener("reduceMotionChanged", set);

const subscribe = (onChange: () => void) => {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
};

/** True when the owner asked the phone to reduce motion: skip decorative animations. */
export function useReduceMotion(): boolean {
  return useSyncExternalStore(subscribe, () => current);
}
