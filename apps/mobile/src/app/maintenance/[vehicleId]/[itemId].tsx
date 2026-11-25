import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Linking, Pressable, View } from "react-native";
import { CATEGORY_ICON } from "@/components/MaintenanceSection";
import { RequireAuth } from "@/components/RequireAuth";
import { RobotGuide } from "@/components/Robot";
import { Button, Card, Pill, Screen, SectionTitle, Skeleton, Txt } from "@/components/ui";
import { tnd } from "@/lib/format";
import { radius, space, useTheme } from "@/lib/theme";
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

const mapsSearchUrl = (query: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

function Offers({ data }: { data: PartPrices }) {
  const t = useTheme();
  if (data.status === "PENDING") {
    return (
      <View style={{ gap: space.md }}>
        <Skeleton height={64} />
        <Skeleton height={64} />
        <Skeleton height={64} />
      </View>
    );
  }
  if (data.status === "FAILED") {
    return (
      <Card>
        <Txt tone="muted">La recherche de prix n'a pas abouti. Réessayez un peu plus tard.</Txt>
      </Card>
    );
  }
  const cheapest = data.offers.find((o) => o.priceTnd !== null)?.priceTnd ?? null;
  return (
    <View style={{ gap: space.md }}>
      {data.offers.length === 0 ? (
        <Card>
          <Txt tone="muted">Aucun prix en ligne trouvé pour cette pièce. Demandez un devis à un garage.</Txt>
        </Card>
      ) : (
        <Card padded={false}>
          {data.offers.map((o, i) => (
            <Pressable
              key={o.url}
              accessibilityRole="link"
              accessibilityLabel={`${o.product}, ${o.priceTnd !== null ? tnd(o.priceTnd) : "prix sur le site"}, chez ${o.shop}`}
              onPress={() => Linking.openURL(o.url)}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: space.md,
                padding: space.lg,
                borderTopWidth: i === 0 ? 0 : 0.5,
                borderTopColor: t.border,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <View style={{ flex: 1, gap: 4 }}>
                <Txt variant="bodyStrong" numberOfLines={2}>
                  {o.product}
                </Txt>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Ionicons name="storefront-outline" size={14} color={t.muted} />
                  <Txt variant="caption" tone="muted">
                    {o.shop}
                  </Txt>
                  {o.priceTnd !== null && o.priceTnd === cheapest ? <Pill label="Le moins cher" tone="success" /> : null}
                </View>
              </View>
              <View style={{ alignItems: "flex-end", gap: 2 }}>
                <Txt variant="heading" style={{ fontVariant: ["tabular-nums"] }}>
                  {o.priceTnd !== null ? tnd(o.priceTnd) : "—"}
                </Txt>
                <Ionicons name="open-outline" size={16} color={t.primary} />
              </View>
            </Pressable>
          ))}
        </Card>
      )}

      {data.labor && (data.labor.minTnd !== null || data.labor.maxTnd !== null) && (
        <Card style={{ flexDirection: "row", gap: space.md, alignItems: "flex-start" }}>
          <View style={{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: t.primarySoft, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="hand-left-outline" size={20} color={t.primary} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Txt variant="caption" tone="muted">
              Main-d'œuvre au garage (estimation)
            </Txt>
            <Txt variant="heading">
              {data.labor.minTnd !== null && data.labor.maxTnd !== null
                ? `${tnd(data.labor.minTnd)} à ${tnd(data.labor.maxTnd)}`
                : tnd((data.labor.minTnd ?? data.labor.maxTnd)!)}
            </Txt>
            {data.labor.note ? (
              <Txt variant="caption" tone="muted">
                {data.labor.note}
              </Txt>
            ) : null}
          </View>
        </Card>
      )}

      {data.note ? (
        <Txt variant="caption" tone="muted">
          {data.note}
        </Txt>
      ) : null}
      <Txt variant="micro" tone="muted">
        Prix relevés en ligne le {new Date(data.updatedAt).toLocaleDateString("fr-FR")}. Confirmez le prix et la compatibilité
        avec la boutique avant d'acheter.
      </Txt>
    </View>
  );
}

function GarageRow({ g, first }: { g: Garage; first: boolean }) {
  const t = useTheme();
  return (
    <View style={{ padding: space.lg, gap: space.sm, borderTopWidth: first ? 0 : 0.5, borderTopColor: t.border }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <Ionicons
          name={g.kind === "tyres" ? "radio-button-on-outline" : g.kind === "car_parts" ? "cube-outline" : "construct-outline"}
          size={18}
          color={t.primary}
        />
        <Txt variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
          {g.name}
        </Txt>
        <Pill label={`${g.distanceKm} km`} />
      </View>
      {g.address ? (
        <Txt variant="caption" tone="muted">
          {g.address}
        </Txt>
      ) : null}
      <View style={{ flexDirection: "row", gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <Button
            label="Itinéraire"
            icon="navigate-outline"
            variant="secondary"
            size="md"
            onPress={() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${g.lat},${g.lon}`)}
          />
        </View>
        {g.phone ? (
          <View style={{ flex: 1 }}>
            <Button label="Appeler" icon="call-outline" variant="ghost" size="md" onPress={() => Linking.openURL(`tel:${g.phone}`)} />
          </View>
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
      const pos = (await Location.getLastKnownPositionAsync()) ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      if (pos) setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
    })().catch(() => setLocationDenied(true));
  }, []);

  if (prices.isLoading || !prices.data) {
    return (
      <Screen>
        <Skeleton height={90} />
        <Skeleton height={200} />
      </Screen>
    );
  }
  const { item, car } = prices.data;
  const make = car.split(" ")[0] ?? "";
  const query = `garage ${GARAGE_QUERY[item.category] ?? "mécanique"} ${make}`.trim();

  return (
    <Screen>
      <Stack.Screen options={{ title: item.name }} />

      <View style={{ flexDirection: "row", gap: space.md, alignItems: "center" }}>
        <View style={{ width: 52, height: 52, borderRadius: radius.md, backgroundColor: t.primarySoft, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name={CATEGORY_ICON[item.category] ?? "build-outline"} size={26} color={t.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Txt variant="title">{item.name}</Txt>
          <Txt tone="muted">{car}</Txt>
        </View>
      </View>

      {prices.data.status === "PENDING" ? (
        <RobotGuide mood="thinking" title="Je compare les prix" compact>
          Je cherche les pièces compatibles dans les boutiques en ligne tunisiennes. Cela prend environ 30 secondes.
        </RobotGuide>
      ) : (
        <RobotGuide mood="happy" compact>
          Touchez une offre pour l'ouvrir sur le site de la boutique, puis choisissez un garage ci-dessous.
        </RobotGuide>
      )}

      <SectionTitle>Prix des pièces</SectionTitle>
      <Offers data={prices.data} />

      <SectionTitle>Où faire ce changement</SectionTitle>
      <Button label="Voir les garages sur Google Maps" icon="map-outline" onPress={() => Linking.openURL(mapsSearchUrl(query))} />
      <Txt variant="caption" tone="muted">
        Recherche « {query} » autour de vous, avec avis, horaires et téléphones.
      </Txt>

      {locationDenied ? (
        <Card>
          <Txt tone="muted">Autorisez la localisation dans les réglages du téléphone pour voir aussi les garages proches ici.</Txt>
        </Card>
      ) : !coords || garages.isLoading ? (
        <Skeleton height={120} />
      ) : garages.data && garages.data.garages.length > 0 ? (
        <>
          <SectionTitle>Près de vous</SectionTitle>
          <Card padded={false}>
            {garages.data.garages.slice(0, 8).map((g, i) => (
              <GarageRow key={g.id} g={g} first={i === 0} />
            ))}
          </Card>
          <Txt variant="micro" tone="muted">
            Données OpenStreetMap. Pour plus de choix, utilisez Google Maps ci-dessus.
          </Txt>
        </>
      ) : (
        <Card>
          <Txt tone="muted">Aucun garage référencé sur la carte libre près de vous. Utilisez Google Maps ci-dessus.</Txt>
        </Card>
      )}
    </Screen>
  );
}

export default function MaintenanceItemScreen() {
  const { vehicleId, itemId } = useLocalSearchParams<{ vehicleId: string; itemId: string }>();
  return <RequireAuth>{vehicleId && itemId ? <ItemScreen vehicleId={vehicleId} itemId={itemId} /> : null}</RequireAuth>;
}
