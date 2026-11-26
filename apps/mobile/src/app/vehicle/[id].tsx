import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, Linking, View } from "react-native";
import { Car3D } from "@/components/Car3D";
import { HistorySection } from "@/components/HistorySection";
import { OilLogCard } from "@/components/OilLogCard";
import { MaintenanceSection } from "@/components/MaintenanceSection";
import { cleanHints, OwnerHintsFields, prefillHints } from "@/components/OwnerHintsFields";
import { RequireAuth } from "@/components/RequireAuth";
import { RobotGuide } from "@/components/Robot";
import { useRobi } from "@/components/RobiToast";
import { Appear, Button, Card, Pill, Row, Screen, ScrollTabs, SectionTitle, Skeleton, Steps, Txt } from "@/components/ui";
import { vehicleTitle } from "@/lib/format";
import { space, useTheme } from "@/lib/theme";
import type { Maintenance, OwnerHints, Vehicle } from "@/lib/types";
import { useDeleteVehicle, useMaintenance, useResearchAgain, useVehicle } from "@/lib/vehicles";

type Tab = "entretien" | "carnet" | "historique" | "fiche" | "reglages";
const CONFIDENCE = { high: "élevée", medium: "moyenne", low: "faible" } as const;

/** What Robi says on this car, depending on where the analysis stands. */
function Guide({ v, m, onFix }: { v: Vehicle; m: Maintenance | undefined; onFix: () => void }) {
  const searching3d = v.model3d?.kind === "procedural" && v.model3d.searching === true;
  const planPending = !m || m.status === "PENDING";
  const overdue = m?.items.filter((i) => i.status === "overdue").length ?? 0;
  const soon = m?.items.filter((i) => i.status === "soon").length ?? 0;

  if (v.status === "FAILED") {
    return (
      <RobotGuide mood="alert" title="J'ai besoin d'un coup de main" action={{ label: "Compléter avec la carte grise", onPress: onFix }}>
        Je n'ai pas réussi à identifier cette voiture avec le VIN seul. Recopiez quelques infos de la carte grise.
      </RobotGuide>
    );
  }
  if (v.status === "PENDING" || searching3d || (v.status === "READY" && planPending)) {
    return (
      <RobotGuide mood="thinking" title="J'analyse votre voiture">
        <View style={{ marginTop: space.sm }}>
          <Steps
            steps={[
              { label: "Identification (VIN)", state: v.status === "READY" ? "done" : "active" },
              { label: "Photos ou modèle 3D", state: v.status !== "READY" ? "todo" : searching3d ? "active" : "done" },
              { label: "Plan d'entretien", state: v.status !== "READY" ? "todo" : planPending ? "active" : "done" },
            ]}
          />
        </View>
      </RobotGuide>
    );
  }
  if (v.mileageKm === null) {
    return (
      <RobotGuide mood="happy" title="Votre voiture est prête">
        Indiquez son kilométrage ci-dessous : je vous dirai exactement quoi changer et quand.
      </RobotGuide>
    );
  }
  if (overdue > 0) {
    return (
      <RobotGuide mood="alert" title={`${overdue} entretien${overdue > 1 ? "s" : ""} à faire maintenant`} compact>
        Touchez un élément pour voir le prix des pièces et les garages près de chez vous.
      </RobotGuide>
    );
  }
  return (
    <RobotGuide mood="happy" compact>
      {soon > 0
        ? `Tout va bien. ${soon} entretien${soon > 1 ? "s" : ""} à prévoir bientôt.`
        : "Tout est à jour. Pensez à mettre à jour le kilométrage de temps en temps."}
    </RobotGuide>
  );
}

function Specs({ v }: { v: Vehicle }) {
  const t = useTheme();
  const p = v.profile!;
  const e = p.engine;
  const check = p.ownerDataCheck;
  return (
    <View style={{ gap: space.lg }}>
      {check?.status === "conflict" && (
        <Card style={{ borderColor: t.danger, borderWidth: 1 }}>
          <Txt variant="bodyStrong" tone="danger">
            Le VIN ne correspond pas à votre carte grise
          </Txt>
          <Txt tone="muted">{check.explanation || "Vérifiez le VIN saisi (case E de la carte grise)."}</Txt>
        </Card>
      )}
      <Card>
        <Txt>{p.summary}</Txt>
        <Pill label={`Fiabilité ${CONFIDENCE[p.confidence]}`} tone={p.confidence === "high" ? "success" : "warning"} icon="shield-checkmark" />
      </Card>
      <SectionTitle>Identité</SectionTitle>
      <Card style={{ gap: 0 }}>
        <Row label="Marque" value={p.make} />
        <Row label="Modèle" value={p.model} />
        <Row label="Génération" value={p.generation} />
        <Row label="Version" value={p.bodyVariant && p.bodyVariant !== "standard" ? p.bodyVariant : "Standard"} />
        <Row label="Finition" value={p.trim} />
        <Row label="Année modèle" value={p.modelYear} />
        <Row label="Carrosserie" value={p.bodyType} />
        <Row label="Portes" value={p.doors} />
        <Row label="Places" value={p.seats} />
        <Row label="VIN" value={v.vin} />
      </Card>
      <SectionTitle>Mécanique</SectionTitle>
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
      </Card>
      {p.sources.length > 0 && (
        <>
          <SectionTitle>Sources</SectionTitle>
          <Card>
            {p.sources.slice(0, 6).map((url) => (
              <Txt key={url} variant="caption" tone="primary" numberOfLines={1} onPress={() => Linking.openURL(url)}>
                {url}
              </Txt>
            ))}
          </Card>
        </>
      )}
    </View>
  );
}

function Settings({ v, onDeleted, startOpen }: { v: Vehicle; onDeleted: () => void; startOpen: boolean }) {
  const research = useResearchAgain(v.id);
  const remove = useDeleteVehicle();
  const robi = useRobi();
  // Opened by "Ce n'est pas ma voiture ?": filled in with what is already known.
  const [editing, setEditing] = useState(startOpen);
  const [hints, setHints] = useState<OwnerHints>(() => prefillHints(v));

  function confirmDelete() {
    Alert.alert("Supprimer cette voiture ?", "Elle sera retirée de votre compte, avec son suivi d'entretien.", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: () =>
          remove.mutate(v.id, {
            onSuccess: () => {
              robi.say("La voiture est retirée de votre compte.");
              onDeleted();
            },
            onError: (err) => Alert.alert("Suppression impossible", err.message),
          }),
      },
    ]);
  }

  return (
    <View style={{ gap: space.lg }}>
      <SectionTitle>Identification</SectionTitle>
      <Card style={{ gap: space.lg }}>
        {!editing ? (
          <>
            <Txt tone="muted">
              {v.profile ? `Robi a identifié : ${vehicleTitle(v)}${v.profile.modelYear ? ` (${v.profile.modelYear})` : ""}.` : "Voiture pas encore identifiée."}{" "}
              Si ce n'est pas votre voiture, corrigez les informations avec votre carte grise.
            </Txt>
            <Button
              label="Ce n'est pas ma voiture ?"
              icon="create-outline"
              variant="secondary"
              onPress={() => {
                setHints(prefillHints(v));
                setEditing(true);
              }}
            />
          </>
        ) : (
          <>
            <Txt tone="muted">
              J'ai rempli ce que je sais déjà. Vérifiez avec votre carte grise et corrigez ce qui ne va pas, puis relancez la recherche.
            </Txt>
            <OwnerHintsFields value={hints} onChange={setHints} />
            <Button
              label="Relancer la recherche"
              icon="refresh"
              disabled={v.status === "PENDING" || !hints.make}
              loading={research.isPending}
              onPress={() =>
                research.mutate(cleanHints(hints), {
                  onSuccess: () => {
                    setEditing(false);
                    robi.say("Je relance l'analyse avec les infos de votre carte grise.", { title: "C'est parti", mood: "thinking" });
                  },
                })
              }
            />
            <Button label="Annuler" variant="ghost" size="md" onPress={() => setEditing(false)} />
          </>
        )}
        {research.error ? (
          <Txt tone="danger" accessibilityLiveRegion="polite">
            La recherche n'a pas pu être relancée : {research.error.message}
          </Txt>
        ) : research.isSuccess ? (
          <Txt tone="success" accessibilityLiveRegion="polite">
            C'est parti : je relance l'analyse avec vos informations.
          </Txt>
        ) : null}
      </Card>

      <Button label="Supprimer cette voiture" icon="trash-outline" variant="danger" onPress={confirmDelete} loading={remove.isPending} />
    </View>
  );
}

function Dashboard({ id }: { id: string }) {
  const t = useTheme();
  const { data: v, isLoading, error, refetch } = useVehicle(id);
  const maintenance = useMaintenance(id, v?.status === "READY");
  const [tab, setTab] = useState<Tab>("entretien");
  const [fixRequested, setFixRequested] = useState(false);

  if (!v && error) {
    return (
      <Screen>
        <RobotGuide mood="alert" title="Connexion impossible" action={{ label: "Réessayer", onPress: () => void refetch() }}>
          Je n'arrive pas à charger cette voiture. Vérifiez votre connexion internet.
        </RobotGuide>
      </Screen>
    );
  }
  if (isLoading || !v) {
    return (
      <Screen>
        <Skeleton height={260} />
        <Skeleton height={28} width="60%" />
        <Skeleton height={90} />
      </Screen>
    );
  }

  const p = v.profile;
  const credit = v.model3d?.kind === "glb" || v.model3d?.kind === "sketchfab" ? v.model3d.credit : null;

  return (
    <Screen>
      <Stack.Screen options={{ title: vehicleTitle(v) }} />

      <Card padded={false} style={{ overflow: "hidden" }}>
        <Car3D model3d={v.model3d} color={v.color} height={260} />
      </Card>
      {credit ? (
        <Txt variant="micro" tone="muted" onPress={() => Linking.openURL(credit.url)}>
          Modèle 3D « {credit.title} » par {credit.author}
          {credit.license ? ` (${credit.license})` : ""}
        </Txt>
      ) : null}

      <View style={{ gap: space.sm }}>
        <Txt variant="title">{vehicleTitle(v)}</Txt>
        {p ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
            {p.modelYear ? <Pill label={String(p.modelYear)} icon="calendar" /> : null}
            {p.engine.fuelType ? <Pill label={p.engine.fuelType} icon="water" /> : null}
            <Pill label={p.bodyVariant && p.bodyVariant !== "standard" ? p.bodyVariant : "Version standard"} icon="car-sport" />
          </View>
        ) : null}
      </View>

      <Guide
        v={v}
        m={maintenance.data}
        onFix={() => {
          setFixRequested(true);
          setTab("reglages");
        }}
      />

      <ScrollTabs<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: "entretien", label: "Entretien", icon: "construct-outline" },
          { value: "carnet", label: "Carnet de vidange", icon: "water-outline" },
          { value: "historique", label: "Historique", icon: "time-outline" },
          { value: "fiche", label: "Fiche", icon: "document-text-outline" },
          { value: "reglages", label: "Réglages", icon: "options-outline" },
        ]}
      />

      <Appear key={tab} style={{ gap: space.lg }}>
      {tab === "entretien" &&
        (v.status === "READY" ? (
          <MaintenanceSection
            vehicleId={v.id}
            mileageKm={v.mileageKm}
            data={maintenance.data}
            loading={maintenance.isLoading}
            error={maintenance.error}
            onRetry={() => void maintenance.refetch()}
          />
        ) : (
          <Card>
            <Txt tone="muted">Le plan d'entretien apparaîtra dès que j'aurai identifié votre voiture.</Txt>
          </Card>
        ))}
      {tab === "carnet" && (
        <View style={{ gap: space.lg }}>
          <RobotGuide mood="happy" compact>
            Chaque vidange avec sa date et son kilométrage, et ce qu'il reste avant la prochaine.
          </RobotGuide>
          <OilLogCard vehicleId={v.id} mileageKm={v.mileageKm} />
        </View>
      )}
      {tab === "historique" && <HistorySection vehicleId={v.id} mileageKm={v.mileageKm} />}
      {tab === "fiche" &&
        (v.status === "READY" && p ? (
          <Specs v={v} />
        ) : (
          <Card>
            <Txt tone="muted">La fiche technique apparaîtra à la fin de l'analyse.</Txt>
          </Card>
        ))}
      {tab === "reglages" && <Settings v={v} startOpen={fixRequested || v.status === "FAILED"} onDeleted={() => router.back()} />}
      </Appear>
      <View style={{ height: space.sm, backgroundColor: t.bg }} />
    </Screen>
  );
}

export default function VehicleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <RequireAuth>{id ? <Dashboard id={id} /> : null}</RequireAuth>;
}
