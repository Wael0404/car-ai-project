import { Link, router, Stack } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { RequireAuth } from "@/components/RequireAuth";
import { Body, Button, Card, Screen } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import type { Vehicle } from "@/lib/types";
import { useVehicles } from "@/lib/vehicles";

function vehicleTitle(v: Vehicle): string {
  if (v.nickname) return v.nickname;
  const p = v.profile;
  if (p?.make) return [p.make, p.model].filter(Boolean).join(" ");
  return "Ma voiture";
}

function StatusLine({ v }: { v: Vehicle }) {
  const t = useTheme();
  if (v.status === "PENDING") {
    return (
      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        <ActivityIndicator size="small" />
        <Text style={{ color: t.warning }}>L'agent IA recherche votre voiture…</Text>
      </View>
    );
  }
  if (v.status === "FAILED") return <Text style={{ color: t.danger }}>Recherche échouée — touchez pour réessayer</Text>;
  const p = v.profile;
  return <Text style={{ color: t.muted }}>{[p?.modelYear, p?.trim, p?.engine.fuelType].filter(Boolean).join(" · ")}</Text>;
}

function GarageList() {
  const t = useTheme();
  const { signOut } = useAuth();
  const { data, isLoading, isRefetching, refetch, error } = useVehicles();

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={signOut} accessibilityRole="button" hitSlop={10}>
              <Text style={{ color: t.primary, fontSize: 16 }}>Déconnexion</Text>
            </Pressable>
          ),
        }}
      />
      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(v) => v.id}
          contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />}
          ListEmptyComponent={
            <Card style={{ alignItems: "center", paddingVertical: 32 }}>
              <Body style={{ fontWeight: "600", fontSize: 17 }}>Aucune voiture</Body>
              <Body muted style={{ textAlign: "center" }}>
                {error ? "Impossible de charger vos voitures." : "Ajoutez votre voiture avec son numéro VIN (carte grise, case E)."}
              </Body>
            </Card>
          }
          renderItem={({ item }) => (
            <Link href={{ pathname: "/vehicle/[id]", params: { id: item.id } }} asChild>
              <Pressable accessibilityRole="button">
                <Card style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                  <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: item.color, borderWidth: 1, borderColor: t.border }} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={{ color: t.text, fontSize: 17, fontWeight: "600" }}>{vehicleTitle(item)}</Text>
                    <StatusLine v={item} />
                    <Text style={{ color: t.muted, fontSize: 12, fontVariant: ["tabular-nums"] }}>{item.vin}</Text>
                  </View>
                  <Text style={{ color: t.muted, fontSize: 22 }}>›</Text>
                </Card>
              </Pressable>
            </Link>
          )}
        />
      )}
      <Button label="Ajouter une voiture" onPress={() => router.push("/add-vehicle")} />
    </Screen>
  );
}

export default function Garage() {
  return (
    <RequireAuth>
      <GarageList />
    </RequireAuth>
  );
}
