import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { FlatList, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Robot, type RobotMood } from "@/components/Robot";
import { Button, Txt, type IconName } from "@/components/ui";
import { markWelcomeSeen } from "@/lib/onboarding";
import { radius, space, useTheme } from "@/lib/theme";

const SLIDES: Array<{ mood: RobotMood; title: string; text: string; points: Array<{ icon: IconName; text: string }> }> = [
  {
    mood: "wave",
    title: "Bonjour, je suis Robi",
    text: "Je suis votre assistant auto. Je vous guide pas à pas dans l'application.",
    points: [
      { icon: "car-sport-outline", text: "Ajoutez votre voiture en quelques secondes" },
      { icon: "sparkles-outline", text: "Je trouve toutes ses caractéristiques pour vous" },
    ],
  },
  {
    mood: "thinking",
    title: "Le numéro VIN suffit",
    text: "Entrez le VIN de votre carte grise. J'identifie la marque, le modèle, la version et le moteur.",
    points: [
      { icon: "document-text-outline", text: "Le VIN est en case E de la carte grise" },
      { icon: "images-outline", text: "Je vous montre votre voiture en 3D ou en photos" },
    ],
  },
  {
    mood: "happy",
    title: "Un entretien sans surprise",
    text: "Indiquez votre kilométrage : je vous dis quoi changer, combien ça coûte et où le faire.",
    points: [
      { icon: "construct-outline", text: "Vidange, filtres, freins, distribution…" },
      { icon: "location-outline", text: "Prix des pièces et garages près de chez vous" },
    ],
  },
];

export default function Welcome() {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const list = useRef<FlatList<(typeof SLIDES)[number]>>(null);
  const [index, setIndex] = useState(0);
  const last = index === SLIDES.length - 1;

  async function finish() {
    await markWelcomeSeen();
    router.replace("/login");
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ alignItems: "flex-end", paddingHorizontal: space.lg }}>
        {!last && (
          <Pressable onPress={finish} accessibilityRole="button" hitSlop={12} style={{ padding: space.sm }}>
            <Txt tone="muted" variant="bodyStrong">
              Passer
            </Txt>
          </Pressable>
        )}
      </View>

      <FlatList
        ref={list}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(s) => s.title}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item }) => (
          // Vertical scroll inside each slide: nothing is cut with large text sizes.
          <ScrollView
            style={{ width }}
            contentContainerStyle={{ flexGrow: 1, paddingHorizontal: space.xl, paddingVertical: space.lg, justifyContent: "center", gap: space.xl }}
            showsVerticalScrollIndicator={false}
          >
            <View style={{ alignItems: "center" }}>
              <View style={{ padding: space.xl, borderRadius: 999, backgroundColor: t.primarySoft }}>
                <Robot size={150} mood={item.mood} />
              </View>
            </View>
            <View style={{ gap: space.sm }}>
              <Txt variant="display" style={{ textAlign: "center" }}>
                {item.title}
              </Txt>
              <Txt tone="muted" style={{ textAlign: "center" }}>
                {item.text}
              </Txt>
            </View>
            <View style={{ gap: space.md }}>
              {item.points.map((p) => (
                <View key={p.text} style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
                  <View style={{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: t.card, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name={p.icon} size={20} color={t.primary} />
                  </View>
                  <Txt style={{ flex: 1 }}>{p.text}</Txt>
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      />

      <View style={{ padding: space.xl, gap: space.lg }}>
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 8 }} accessibilityLabel={`Étape ${index + 1} sur ${SLIDES.length}`}>
          {SLIDES.map((s, i) => (
            <View
              key={s.title}
              style={{ height: 8, width: i === index ? 24 : 8, borderRadius: 4, backgroundColor: i === index ? t.primary : t.border }}
            />
          ))}
        </View>
        <Button
          label={last ? "Commencer" : "Suivant"}
          icon={last ? "rocket-outline" : "arrow-forward"}
          onPress={() => {
            if (last) return void finish();
            // Programmatic scrolls do not fire onMomentumScrollEnd on Android.
            list.current?.scrollToIndex({ index: index + 1 });
            setIndex(index + 1);
          }}
        />
      </View>
    </SafeAreaView>
  );
}
