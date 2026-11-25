import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Robot } from "@/components/Robot";
import { useAuth } from "@/lib/auth";
import { hasSeenWelcome } from "@/lib/onboarding";
import { useTheme } from "@/lib/theme";

export default function Index() {
  const t = useTheme();
  const { status } = useAuth();
  const [seen, setSeen] = useState<boolean | null>(null);

  useEffect(() => {
    void hasSeenWelcome().then(setSeen);
  }, []);

  if (status === "loading" || seen === null) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: t.bg }}>
        <Robot size={96} mood="thinking" />
      </View>
    );
  }
  if (status === "signedIn") return <Redirect href="/garage" />;
  return <Redirect href={seen ? "/login" : "/welcome"} />;
}
