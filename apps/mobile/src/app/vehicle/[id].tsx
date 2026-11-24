import { router, Stack, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Alert, Linking, ScrollView, Text, View } from "react-native";
import { Car3D } from "@/components/Car3D";
import { ColorPicker } from "@/components/ColorPicker";
import { RequireAuth } from "@/components/RequireAuth";
import { Body, Button, Card, Row } from "@/components/ui";
import { useTheme } from "@/lib/theme";
import type { Vehicle } from "@/lib/types";
import { useDeleteVehicle, useRetryVehicle, useUpdateVehicle, useVehicle } from "@/lib/vehicles";

const CONFIDENCE = { high: "Élevée", medium: "Moyenne", low: "Faible" } as const;

function Specs({ v }: { v: Vehicle }) {
  const t = useTheme();
  const p = v.profile!;
  const e = p.engine;
  return (
    <>
      <Card>
        <Body>{p.summary}</Body>
        <Text style={{ color: p.confidence === "high" ? t.success : t.warning, fontSize: 13 }}>
          Fiabilité des informations : {CONFIDENCE[p.confidence]}
        </Text>
      </Card>
      <Card style={{ gap: 0 }}>
        <Row label="Marque" value={p.make} />
        <Row label="Modèle" value={p.model} />
        <Row label="Version" value={p.trim} />
        <Row label="Génération" value={p.generation} />
        <Row label="Année modèle" value={p.modelYear} />
        <Row label="Carrosserie" value={p.bodyType} />
        <Row label="Portes" value={p.doors} />
        <Row label="Places" value={p.seats} />
      </Card>
      <Card style={{ gap: 0 }}>
        <Row label="Moteur" value={e.description} />
        <Row label="Cylindrée" value={e.displacementL ? `${e.displacementL.toFixed(1)} L` : null} />
        <Row label="Cylindres" value={e.cylinders} />
        <Row label="Puissance" value={e.powerHp ? `${e.powerHp} ch` : null} />
        <Row label="Carburant" value={e.fuelType} />
        <Row label="Boîte" value={p.transmission} />
        <Row label="Transmission" value={p.drivetrain} />
        <Row label="Constructeur" value={p.manufacturer} />
        <Row label="Pays d'assemblage" value={p.plantCountry} />
        <Row label="VIN" value={v.vin} />
      </Card>
      {p.sources.length > 0 && (
        <Card>
          <Body muted style={{ fontSize: 13, fontWeight: "600" }}>Sources</Body>
          {p.sources.slice(0, 6).map((url) => (
            <Text key={url} style={{ color: t.primary, fontSize: 13 }} numberOfLines={1} onPress={() => Linking.openURL(url)}>
              {url}
            </Text>
          ))}
        </Card>
      )}
    </>
  );
}

function Dashboard({ id }: { id: string }) {
  const t = useTheme();
  const { data: v, isLoading } = useVehicle(id);
  const update = useUpdateVehicle(id);
  const retry = useRetryVehicle(id);
  const remove = useDeleteVehicle();

  if (isLoading || !v) {
    return <ActivityIndicator style={{ marginTop: 40 }} />;
  }

  const title = v.nickname ?? ([v.profile?.make, v.profile?.model].filter(Boolean).join(" ") || "Ma voiture");

  function confirmDelete() {
    Alert.alert("Supprimer cette voiture ?", "Elle sera retirée de votre compte.", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: () => remove.mutate(id, { onSuccess: () => router.back() }),
      },
    ]);
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
      <Stack.Screen options={{ title }} />

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <Car3D model3d={v.model3d} color={v.color} />
      </Card>
      <ColorPicker value={v.color} onChange={(color) => update.mutate({ color })} />
      {v.model3d?.kind === "procedural" && (
        <Body muted style={{ fontSize: 12 }}>
          Modèle 3D générique de type « {v.model3d.bodyType} ». Le modèle exact de votre voiture sera affiché dès qu'il
          sera disponible dans notre catalogue.
        </Body>
      )}

      {v.status === "PENDING" && (
        <Card style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <ActivityIndicator />
          <Body style={{ flex: 1 }}>L'agent IA recherche les caractéristiques de votre voiture. Cela prend en général moins d'une minute.</Body>
        </Card>
      )}
      {v.status === "FAILED" && (
        <Card>
          <Body>La recherche n'a pas abouti. Vérifiez le VIN ou réessayez.</Body>
          <Button label="Réessayer" onPress={() => retry.mutate()} loading={retry.isPending} />
        </Card>
      )}
      {v.status === "READY" && v.profile && <Specs v={v} />}

      <View style={{ marginTop: 8 }}>
        <Button label="Supprimer cette voiture" variant="danger" onPress={confirmDelete} loading={remove.isPending} />
      </View>
    </ScrollView>
  );
}

export default function VehicleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <RequireAuth>{id ? <Dashboard id={id} /> : null}</RequireAuth>;
}
