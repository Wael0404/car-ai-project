import { useState } from "react";
import {
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useTheme } from "@/lib/theme";
import type { GalleryPhoto } from "@/lib/types";

const ANGLE_LABEL: Record<string, string> = {
  front_three_quarter: "Avant",
  side: "Profil",
  rear_three_quarter: "Arrière",
  front: "Face avant",
  rear: "Face arrière",
};

/**
 * Real photos of the exact version of the car, swiped by angle. Shown when no
 * artist-made 3D model of that exact version exists.
 */
export function PhotoGallery({ photos, height }: { photos: GalleryPhoto[]; height: number }) {
  const t = useTheme();
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const current = photos[index] ?? photos[0]!;

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (width > 0) setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  }

  return (
    <View style={{ gap: 8 }}>
      <View
        style={[styles.frame, { height, backgroundColor: t.card }]}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      >
        {width > 0 && (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onScroll}
            accessibilityLabel="Photos de votre voiture"
          >
            {photos.map((p) => (
              <Image
                key={p.url}
                source={{ uri: p.url }}
                style={{ width, height }}
                resizeMode="cover"
                accessibilityLabel={`Photo ${ANGLE_LABEL[p.angle] ?? ""}`}
              />
            ))}
          </ScrollView>
        )}
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{ANGLE_LABEL[current.angle] ?? "Photo"}</Text>
        </View>
      </View>

      {photos.length > 1 && (
        <View style={styles.dots}>
          {photos.map((p, i) => (
            <View key={p.url} style={[styles.dot, { backgroundColor: i === index ? t.primary : t.border }]} />
          ))}
        </View>
      )}

      <Text style={{ color: t.muted, fontSize: 11 }} onPress={() => Linking.openURL(current.pageUrl)}>
        Photo réelle de votre version : {current.author}
        {current.license ? ` (${current.license})` : ""}, Wikimedia Commons
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: "100%", borderRadius: 16, overflow: "hidden" },
  badge: {
    position: "absolute",
    left: 12,
    top: 12,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  dots: { flexDirection: "row", justifyContent: "center", gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
});
