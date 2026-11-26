import { Ionicons } from "@expo/vector-icons";
import { Link, router } from "expo-router";
import { useEffect, useState } from "react";
import { Animated, Easing, FlatList, Image, Pressable, RefreshControl, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { RequireAuth } from "@/components/RequireAuth";
import { useRobi } from "@/components/RobiToast";
import { Robot, RobotGuide } from "@/components/Robot";
import { Appear, Button, Card, IconButton, Pill, Skeleton, Txt } from "@/components/ui";
import { useReduceMotion } from "@/lib/motion";
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
            <View style={{ height: 150, backgroundColor: t.surface2, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              {thumb ? (
                <Image source={{ uri: thumb }} style={{ width: "100%", height: "100%" }} resizeMode="cover" accessibilityIgnoresInvertColors />
              ) : (
                <View style={{ alignItems: "center", gap: space.sm }}>
                  <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: v.color, borderWidth: 2, borderColor: t.border }} />
                  <Ionicons name="car-sport" size={28} color={t.muted} />
                </View>
              )}
              {v.status === "PENDING" ? <ScanSweep /> : null}
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

/** A beam of light sweeping across the card while Robi analyses the car. */
function ScanSweep() {
  const t = useTheme();
  const reduceMotion = useReduceMotion();
  const [x] = useState(() => new Animated.Value(0));
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (reduceMotion || width === 0) return;
    const a = Animated.loop(
      Animated.sequence([
        Animated.timing(x, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.delay(300),
        Animated.timing(x, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    a.start();
    return () => a.stop();
  }, [x, width, reduceMotion]);
  if (reduceMotion) return null;
  return (
    <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <Animated.View
        style={{
          position: "absolute",
          top: -20,
          bottom: -20,
          width: 70,
          backgroundColor: t.primary,
          opacity: 0.22,
          transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [-90, width + 20] }) }, { rotate: "14deg" }],
        }}
      />
      <Animated.View
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          width: 2,
          backgroundColor: t.primary,
          opacity: 0.7,
          transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [-20, width + 60] }) }],
        }}
      />
    </View>
  );
}

const TIPS = [
  "Mettez à jour le kilométrage de temps en temps : je recalcule tout pour vous.",
  "Dans l'onglet Entretien, touchez une pièce pour voir les prix et les garages proches.",
  "Le Carnet de vidange vous dit combien de kilomètres il reste avant la prochaine vidange.",
  "Quand un entretien est fait, touchez « C'est fait » : je le note dans l'historique.",
];

/** "Bonjour" / "Bonsoir" by the time of day. */
const greeting = () => {
  const h = new Date().getHours();
  return h >= 18 || h < 5 ? "Bonsoir !" : "Bonjour !";
};

function GarageList() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const robi = useRobi();
  const [tip, setTip] = useState(0);
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
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.lg, paddingTop: space.sm, gap: space.md }}>
        <Robot
          size={48}
          mood="wave"
          onPress={() => {
            robi.say(TIPS[tip % TIPS.length]!, { title: "Astuce de Robi" });
            setTip(tip + 1);
          }}
        />
        <View style={{ flex: 1 }}>
          <Txt variant="caption" tone="muted">
            {greeting()}
          </Txt>
          <Txt variant="display">Mes voitures</Txt>
        </View>
        <IconButton icon="settings-outline" label="Paramètres : apparence et compte" onPress={() => router.push("/settings")} />
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
          renderItem={({ item, index }) => (
            <Appear index={index + 1}>
              <VehicleCard v={item} />
            </Appear>
          )}
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
