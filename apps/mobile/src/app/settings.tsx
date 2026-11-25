import { Ionicons } from "@expo/vector-icons";
import { Alert, Pressable, View } from "react-native";
import { RequireAuth } from "@/components/RequireAuth";
import { RobotGuide } from "@/components/Robot";
import { Button, Card, Screen, SectionTitle, Txt, type IconName } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { radius, space, useTheme, useThemePreference, type ThemePreference } from "@/lib/theme";

const OPTIONS: Array<{ value: ThemePreference; label: string; hint: string; icon: IconName }> = [
  { value: "light", label: "Clair", hint: "Fond clair, idéal en plein jour", icon: "sunny-outline" },
  { value: "dark", label: "Sombre", hint: "Fond sombre, reposant le soir", icon: "moon-outline" },
  { value: "system", label: "Automatique", hint: "Suit le réglage du téléphone", icon: "phone-portrait-outline" },
];

function SettingsScreen() {
  const t = useTheme();
  const { preference, setPreference } = useThemePreference();
  const { signOut } = useAuth();

  function confirmSignOut() {
    Alert.alert("Se déconnecter ?", "Vos voitures restent enregistrées dans votre compte.", [
      { text: "Annuler", style: "cancel" },
      { text: "Se déconnecter", style: "destructive", onPress: () => void signOut() },
    ]);
  }

  return (
    <Screen>
      <RobotGuide mood="happy" compact>
        Choisissez l'apparence qui vous convient. Vos données sont enregistrées en toute sécurité dans votre compte.
      </RobotGuide>

      <SectionTitle>Apparence</SectionTitle>
      <Card padded={false} style={{ overflow: "hidden" }}>
        {OPTIONS.map((o, i) => {
          const active = preference === o.value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${o.label}. ${o.hint}`}
              onPress={() => setPreference(o.value)}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: space.md,
                padding: space.lg,
                minHeight: 64,
                borderTopWidth: i === 0 ? 0 : 0.5,
                borderTopColor: t.border,
                backgroundColor: pressed ? t.surface2 : "transparent",
              })}
            >
              <View style={{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: active ? t.primarySoft : t.surface2, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name={o.icon} size={20} color={active ? t.primary : t.muted} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt variant="bodyStrong">{o.label}</Txt>
                <Txt variant="caption" tone="muted">
                  {o.hint}
                </Txt>
              </View>
              <Ionicons name={active ? "radio-button-on" : "radio-button-off"} size={22} color={active ? t.primary : t.muted} />
            </Pressable>
          );
        })}
      </Card>

      <SectionTitle>Compte</SectionTitle>
      <Button label="Se déconnecter" icon="log-out-outline" variant="danger" onPress={confirmSignOut} />
    </Screen>
  );
}

export default function Settings() {
  return (
    <RequireAuth>
      <SettingsScreen />
    </RequireAuth>
  );
}
