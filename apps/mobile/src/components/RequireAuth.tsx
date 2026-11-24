import { Redirect } from "expo-router";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth";

/** Sends signed-out users back to the login screen. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  if (status === "signedOut") return <Redirect href="/login" />;
  if (status === "loading") return null;
  return <>{children}</>;
}
