import * as SecureStore from "expo-secure-store";

const KEY = "carai.onboarded.v1";

/** Whether the welcome tour was already shown on this phone. */
export async function hasSeenWelcome(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(KEY)) === "1";
  } catch {
    return true; // never block the app on storage errors
  }
}

export async function markWelcomeSeen(): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, "1");
  } catch {
    // ignore: the tour would simply show again
  }
}
