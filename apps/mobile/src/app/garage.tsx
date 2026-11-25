import { Ionicons } from "@expo/vector-icons";
import { Link, router } from "expo-router";
import { FlatList, Image, Pressable, RefreshControl, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { RequireAuth } from "@/components/RequireAuth";
import { RobotGuide } from "@/components/Robot";
import { Button, Card, IconButton, Pill, Skeleton, Txt } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { vehicleTitle } from "@/lib/format";
import { radius, space, useTheme } from "@/lib/theme";
import type { Vehicle } from "@/lib/types";
import { useVehicles } from "@/lib/vehicles";

/** A real picture of the car when we have one, else its colour. */
function thumbnail(v: Vehicle): string | null {
  const m = v.model3d;
  if (m?.kind === "photos") return m.photos[0]?.url ?? null;
  if (m?.kind === "sketchfab") return m.thumbnailUrl;
  return null;
}

function VehicleCard({ v }: { v: Vehicle }) {
  const t = useTheme();
  const thumb = thumbnail(v);
  const p = v.profile;
  const subtitle = [p?.modelYear, p?.engine.description ?? p?.engine.fuelType].filter(Boolean).join(" · ");

  return (
    <Link href={{ pathname: "/vehicle/[id]", params: { id: v.id } }} asChild>
      <Pressable accessibilityRole="button" accessibilityLabel={`Ouvrir ${vehicleTitle(v)}`}>
        {({ pressed }) => (
          <Card padded={false} style={{ overflow: "hidden", opacity: pressed ? 0.9 : 1 }}>
            <View style={{ height: 150, backgroundColor: t.surface2, alignItems: "center", justifyContent: "center" }}>
              {thumb ? (
                <Image source={{ uri: thumb }} style={{ width: "100%", height: "100%" }} resizeMode="cover" accessibilityIgnoresInvertColors />
              ) : (
                <View style={{ alignItems: "center", gap: space.sm }}>
                  <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: v.color, borderWidth: 2, borderColor: t.border }} />
                  <Ionicons name="car-sport" size={28} color={t.muted} />
                </View>
              )}
            </View>
            <View style={{ padding: space.lg, gap: 6 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm }}>
                <Txt variant="heading" numberOfLines={1} style={{ flex: 1 }}>
                  {vehicleTitle(v)}
                </Txt>
                <Ionicons name="chevron-forward" size={20} color={t.muted} />
              </View>
              {v.status === "PENDING" ? (
                <Pill label="Robi analyse votre voiture…" tone="primary" icon="sparkles" />
              ) : v.status === "FAILED" ? (
                <Pill label="Informations à compléter" tone="danger" icon="alert-circle" />
              ) : (
                <Txt variant="caption" tone="muted" numberOfLines={1}>
                  {subtitle || "Fiche prête"}
                  {v.mileageKm !== null ? ` · ${v.mileageKm.toLocaleString("fr-FR")} km` : ""}
                </Txt>
              )}
            </View>
          </Card>
        )}
      </Pressable>
    </Link>
  );
}

function GarageList() {
  const t = useTheme();
  const { signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const { data, isLoading, isRefetching, refetch, error } = useVehicles();
  const cars = data ?? [];
  const pending = cars.find((c) => c.status === "PENDING");
  const noMileage = cars.find((c) => c.status === "READY" && c.mileageKm === null);

  const guide = error ? (
    <RobotGuide mood="alert" title="Connexion impossible" action={{ label: "Réessayer", onPress: () => void refetch() }}>
      Je n'arrive pas à charger vos voitures. Vérifiez votre connexion Internet.
    </RobotGuide>
  ) : cars.length === 0 ? (
    <RobotGuide mood="wave" title="Ajoutons votre voiture">
      Il me faut seulement le numéro VIN de votre carte grise (case E). Je m'occupe du reste.
    </RobotGuide>
  ) : pending ? (
    <RobotGuide mood="thinking" title="Je travaille pour vous" compact>
      {`J'analyse ${vehicleTitle(pending)} : fiche technique, photos et plan d'entretien. Cela prend environ une minute.`}
    </RobotGuide>
  ) : noMileage ? (
    <RobotGuide mood="happy" compact>
      {`Ouvrez ${vehicleTitle(noMileage)} et indiquez son kilométrage : je vous dirai quoi changer et quand.`}
    </RobotGuide>
  ) : (
    <RobotGuide mood="happy" compact>
      Touchez une voiture pour voir son entretien, ses pièces et les garages proches.
    </RobotGuide>
  );

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.lg, paddingTop: space.sm }}>
        <View>
          <Txt variant="caption" tone="muted">
            Car AI
          </Txt>
          <Txt variant="display">Mes voitures</Txt>
        </View>
        <IconButton icon="log-out-outline" label="Se déconnecter" onPress={signOut} />
      </View>

      {isLoading ? (
        <View style={{ padding: space.lg, gap: space.lg }}>
          <Skeleton height={80} />
          <Skeleton height={210} style={{ borderRadius: radius.lg }} />
        </View>
      ) : (
        <FlatList
          data={cars}
          keyExtractor={(v) => v.id}
          contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={t.primary} />}
          ListHeaderComponent={guide}
          renderItem={({ item }) => <VehicleCard v={item} />}
        />
      )}

      <View style={{ position: "absolute", left: space.lg, right: space.lg, bottom: Math.max(insets.bottom, space.lg) }}>
        <Button label="Ajouter une voiture" icon="add-circle-outline" onPress={() => router.push("/add-vehicle")} />
      </View>
    </SafeAreaView>
  );
}

export default function Garage() {
  return (
    <RequireAuth>
      <GarageList />
    </RequireAuth>
  );
}
