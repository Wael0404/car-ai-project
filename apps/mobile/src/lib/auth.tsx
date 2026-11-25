import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, hasStoredSession, setSignedOutHandler } from "./api";

type Status = "loading" | "signedIn" | "signedOut";

interface AuthContextValue {
  status: Status;
  signIn: (email: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const queryClient = useQueryClient();

  useEffect(() => {
    setSignedOutHandler(() => {
      queryClient.clear();
      setStatus("signedOut");
    });
    (async () => {
      const ok = (await hasStoredSession()) && (await api.restoreSession().catch(() => false));
      setStatus(ok ? "signedIn" : "signedOut");
    })();
  }, [queryClient]);

  const signIn = useCallback(async (email: string, code: string) => {
    await api.verifyCode(email, code);
    setStatus("signedIn");
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api.logout(); // best effort: works offline too
    } finally {
      queryClient.clear(); // never show the previous user's cars
      setStatus("signedOut");
    }
  }, [queryClient]);

  const value = useMemo(() => ({ status, signIn, signOut }), [status, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
