import * as Location from "expo-location";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from "react-native";
import { RequireAuth } from "@/components/RequireAuth";
import { Body, Button, Card } from "@/components/ui";
import { useTheme } from "@/lib/theme";
import type { Garage, PartPrices } from "@/lib/types";
import { useGarages, usePartPrices } from "@/lib/vehicles";

/** What to type in Google Maps to find a garage doing this job. */
const GARAGE_QUERY: Record<string, string> = {
  moteur: "vidange",
  filtres: "vidange",
  distribution: "distribution",
  allumage: "garage mécanique",
  freinage: "freins",
  refroidissement: "garage mécanique",
  transmission: "garage mécanique",
  pneus: "pneus",
  climatisation: "climatisation auto",
  electricite: "batterie auto",
};

const tnd = (n: number) => `${n.toLocaleString("fr-FR", { maximumFractionDigits: 3 })} DT`;

function mapsSearchUrl(query: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function Prices({ data }: { data: PartPrices }) {
  const t = useTheme();
  if (data.status === "PENDING") {
    return (
      <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
        <ActivityIndicator />
        <Body muted>L'agent compare les prix des boutiques en ligne tunisiennes…</Body>
      </View>
    );
  }
  if (data.status === "FAILED") return <Body muted>La recherche de prix n'a pas abouti. Réessayez plus tard.</Body>;
  return (
    <View style={{ gap: 4 }}>
      {data.offers.length === 0 ? (
        <Body muted>Aucun prix en ligne trouvé pour cette pièce.</Body>
      ) : (
        data.offers.map((o) => (
          <Pressable
            key={o.url}
            accessibilityRole="link"
            onPress={() => Linking.openURL(o.url)}
            style={{ flexDirection: "row", gap: 12, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: t.border }}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: t.text, fontSize: 14 }} numberOfLines={2}>
                {o.product}
              </Text>
              <Text style={{ color: t.muted, fontSize: 12 }}>{o.shop} ›</Text>
            </View>
            <Text style={{ color: t.text, fontSize: 15, fontWeight: "700", fontVariant: ["tabular-nums"] }}>
              {o.priceTnd !== null ? tnd(o.priceTnd) : "Prix sur le site"}
            </Text>
          </Pressable>
        ))
      )}
      {data.labor && (data.labor.minTnd !== null || data.labor.maxTnd !== null) && (
        <View style={{ marginTop: 8, gap: 2 }}>
          <Text style={{ color: t.text, fontWeight: "600" }}>
            Main-d'œuvre au garage :{" "}
            {data.labor.minTnd !== null && data.labor.maxTnd !== null
              ? `${tnd(data.labor.minTnd)} à ${tnd(data.labor.maxTnd)}`
              : tnd((data.labor.minTnd ?? data.labor.maxTnd)!)}
          </Text>
          {data.labor.note ? <Text style={{ color: t.muted, fontSize: 12 }}>{data.labor.note}</Text> : null}
        </View>
      )}
      {data.note ? <Text style={{ color: t.muted, fontSize: 12, marginTop: 6 }}>{data.note}</Text> : null}
      <Text style={{ color: t.muted, fontSize: 11, marginTop: 6 }}>
        Prix relevés en ligne le {new Date(data.updatedAt).toLocaleDateString("fr-FR")}, à confirmer auprès de la boutique.
        Vérifiez la compatibilité avec votre voiture avant d'acheter.
      </Text>
    </View>
  );
}

function GarageRow({ g }: { g: Garage }) {
  const t = useTheme();
  return (
    <View style={{ paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: t.border, gap: 4 }}>
      <Text style={{ color: t.text, fontSize: 15, fontWeight: "600" }}>{g.name}</Text>
      <Text style={{ color: t.muted, fontSize: 12 }}>
        {g.kind === "tyres" ? "Pneus" : g.kind === "car_parts" ? "Pièces auto" : "Garage"} · à {g.distanceKm} km
        {g.address ? ` · ${g.address}` : ""}
      </Text>
      <View style={{ flexDirection: "row", gap: 16 }}>
        <Text
          style={{ color: t.primary, fontWeight: "600" }}
          onPress={() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${g.lat},${g.lon}`)}
        >
          Itinéraire
        </Text>
        {g.phone ? (
          <Text style={{ color: t.primary, fontWeight: "600" }} onPress={() => Linking.openURL(`tel:${g.phone}`)}>
            Appeler {g.phone}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function ItemScreen({ vehicleId, itemId }: { vehicleId: string; itemId: string }) {
  const t = useTheme();
  const prices = usePartPrices(vehicleId, itemId);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const garages = useGarages(coords);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationDenied(true);
        return;
      }
      const pos = await Location.getLastKnownPositionAsync() ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      if (pos) setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
    })().catch(() => setLocationDenied(true));
  }, []);

  if (prices.isLoading || !prices.data) return <ActivityIndicator style={{ marginTop: 40 }} />;
  const { item, car } = prices.data;
  const make = car.split(" ")[0] ?? "";
  const query = `garage ${GARAGE_QUERY[item.category] ?? "mécanique"} ${make}`.trim();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
      <View style={{ gap: 4 }}>
        <Text style={{ color: t.text, fontSize: 22, fontWeight: "700" }}>{item.name}</Text>
        <Body muted>{car}</Body>
      </View>

      <Card style={{ gap: 8 }}>
        <Text style={{ color: t.text, fontSize: 17, fontWeight: "700" }}>Prix des pièces</Text>
        <Prices data={prices.data} />
      </Card>

      <Card style={{ gap: 10 }}>
        <Text style={{ color: t.text, fontSize: 17, fontWeight: "700" }}>Où faire ce changement</Text>
        <Button label="Voir les garages sur Google Maps" onPress={() => Linking.openURL(mapsSearchUrl(query))} />
        <Text style={{ color: t.muted, fontSize: 12 }}>
          Recherche « {query} » autour de vous, avec avis, horaires et téléphones.
        </Text>
        {locationDenied ? (
          <Body muted>Autorisez la localisation pour voir aussi les garages proches dans l'application.</Body>
        ) : !coords || garages.isLoading ? (
          <ActivityIndicator />
        ) : garages.data && garages.data.garages.length > 0 ? (
          <View>
            <Text style={{ color: t.muted, fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}>
              Près de vous (OpenStreetMap)
            </Text>
            {garages.data.garages.slice(0, 10).map((g) => (
              <GarageRow key={g.id} g={g} />
            ))}
          </View>
        ) : (
          <Body muted>Aucun garage référencé sur la carte libre près de vous : utilisez Google Maps ci-dessus.</Body>
        )}
      </Card>
    </ScrollView>
  );
}

export default function MaintenanceItemScreen() {
  const { vehicleId, itemId } = useLocalSearchParams<{ vehicleId: string; itemId: string }>();
  return <RequireAuth>{vehicleId && itemId ? <ItemScreen vehicleId={vehicleId} itemId={itemId} /> : null}</RequireAuth>;
}
