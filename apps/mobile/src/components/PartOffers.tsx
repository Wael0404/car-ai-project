import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Image, Linking, Modal, Pressable, ScrollView, Share, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Card, Pill, Skeleton, Txt, type IconName } from "@/components/ui";
import { tnd } from "@/lib/format";
import { font, radius, space, useTheme } from "@/lib/theme";
import type { PartOffer, PartPrices } from "@/lib/types";

/**
 * Offers grouped by part (oil filter, oil...), each with the photo of the part
 * and its maker's reference, so the owner buys exactly the right one.
 */

/** "MISFAT L008" — what to show or tell the seller. */
const refLabel = (o: PartOffer) => [o.brand, o.reference].filter(Boolean).join(" ");

/** Product photo on a white tile (shop photos have white backgrounds, also in dark mode). */
function PartPhoto({ uri, size, pending, icon, label }: { uri: string | null; size: number; pending: boolean; icon: IconName; label: string }) {
  const t = useTheme();
  const [failedUri, setFailedUri] = useState<string | null>(null);
  if (uri && failedUri !== uri) {
    return (
      <View
        style={{ width: size, height: size, borderRadius: radius.md, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: t.border, overflow: "hidden" }}
      >
        <Image
          source={{ uri }}
          style={{ width: "100%", height: "100%" }}
          resizeMode="contain"
          accessibilityLabel={label}
          onError={() => setFailedUri(uri)}
        />
      </View>
    );
  }
  if (pending) return <Skeleton height={size} width={size} style={{ borderRadius: radius.md }} />;
  return (
    <View
      style={{ width: size, height: size, borderRadius: radius.md, backgroundColor: t.surface2, alignItems: "center", justifyContent: "center" }}
      accessible
      accessibilityLabel="Pas de photo"
    >
      <Ionicons name={icon} size={size * 0.4} color={t.muted} />
    </View>
  );
}

function RefBadge({ offer, large }: { offer: PartOffer; large?: boolean }) {
  const t = useTheme();
  if (!offer.reference) return null;
  return (
    <View
      style={{
        alignSelf: "flex-start",
        maxWidth: "100%",
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: t.surface2,
        borderRadius: radius.sm,
        paddingHorizontal: large ? 12 : 8,
        paddingVertical: large ? 8 : 3,
      }}
    >
      <Txt variant={large ? "caption" : "micro"} tone="muted">
        Réf.
      </Txt>
      {/* In the sheet: long press to copy (in the list a press opens the sheet). */}
      <Txt
        selectable={large}
        variant={large ? "heading" : "caption"}
        style={{ flexShrink: 1, fontFamily: font.semibold, letterSpacing: 0.5, fontVariant: ["tabular-nums"] }}
      >
        {refLabel(offer)}
      </Txt>
    </View>
  );
}

/** Big photo, reference to copy, link to the shop, share to a garage. */
function OfferSheet({ offer, icon, pending, onClose }: { offer: PartOffer; icon: IconName; pending: boolean; onClose: () => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const photo = Math.min(width - space.lg * 4, 360);

  function share() {
    const lines = [
      offer.product,
      offer.reference ? `Référence : ${refLabel(offer)}` : null,
      offer.priceTnd !== null ? `${tnd(offer.priceTnd)} chez ${offer.shop}` : offer.shop,
      offer.url,
    ];
    void Share.share({ message: lines.filter(Boolean).join("\n") }).catch(() => {});
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fermer"
          onPress={onClose}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: t.overlay }}
        />
        <View
          accessibilityViewIsModal
          style={{ maxHeight: "92%", backgroundColor: t.card, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg }}
        >
          <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.lg + insets.bottom, gap: space.lg }}>
            <View style={{ alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: t.border }} />
            <View style={{ alignItems: "center" }}>
              <PartPhoto uri={offer.image} size={photo} pending={pending} icon={icon} label={`Photo : ${offer.product}`} />
            </View>
            <View style={{ gap: space.sm }}>
              <Txt variant="label" tone="muted">
                {offer.part}
              </Txt>
              <Txt variant="heading" accessibilityRole="header">
                {offer.product}
              </Txt>
              <RefBadge offer={offer} large />
              {offer.reference ? (
                <Txt variant="caption" tone="muted">
                  Appui long sur la référence pour la copier. Montrez-la au vendeur pour être sûr d'avoir la bonne pièce.
                </Txt>
              ) : pending ? (
                <Txt variant="caption" tone="muted" accessibilityLiveRegion="polite">
                  Recherche de la référence…
                </Txt>
              ) : (
                <Txt variant="caption" tone="muted">
                  Référence non indiquée : vérifiez-la sur le site de la boutique.
                </Txt>
              )}
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
                <Ionicons name="storefront-outline" size={16} color={t.muted} />
                <Txt tone="muted" numberOfLines={1}>
                  {offer.shop}
                </Txt>
              </View>
              <Txt variant="title" style={{ fontVariant: ["tabular-nums"] }}>
                {offer.priceTnd !== null ? tnd(offer.priceTnd) : "Prix sur le site"}
              </Txt>
            </View>
            <Button label={`Voir chez ${offer.shop}`} icon="open-outline" onPress={() => void Linking.openURL(offer.url)} />
            <Button label="Partager (référence et lien)" icon="share-social-outline" variant="secondary" onPress={share} />
            <Button label="Fermer" variant="ghost" size="md" onPress={onClose} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function OfferRow({
  offer,
  first,
  cheapest,
  pending,
  icon,
  onOpen,
}: {
  offer: PartOffer;
  first: boolean;
  cheapest: boolean;
  pending: boolean;
  icon: IconName;
  onOpen: () => void;
}) {
  const t = useTheme();
  const price = offer.priceTnd !== null ? tnd(offer.priceTnd) : "prix sur le site";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${offer.product}${offer.reference ? `, référence ${refLabel(offer)}` : ""}, ${price}, chez ${offer.shop}`}
      accessibilityHint="Affiche la photo, la référence et le lien de la boutique"
      onPress={onOpen}
      style={({ pressed }) => ({
        flexDirection: "row",
        gap: space.md,
        padding: space.lg,
        borderTopWidth: first ? 0 : 0.5,
        borderTopColor: t.border,
        backgroundColor: pressed ? t.surface2 : "transparent",
      })}
    >
      <PartPhoto uri={offer.image} size={72} pending={pending} icon={icon} label={`Photo : ${offer.product}`} />
      <View style={{ flex: 1, gap: 6 }}>
        <Txt variant="bodyStrong" numberOfLines={2}>
          {offer.product}
        </Txt>
        <RefBadge offer={offer} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <Ionicons name="storefront-outline" size={14} color={t.muted} />
          <Txt variant="caption" tone="muted">
            {offer.shop}
          </Txt>
          {cheapest ? <Pill label="Le moins cher" tone="success" /> : null}
        </View>
      </View>
      <View style={{ alignItems: "flex-end", justifyContent: "space-between" }}>
        <Txt variant="heading" style={{ fontVariant: ["tabular-nums"] }}>
          {offer.priceTnd !== null ? tnd(offer.priceTnd) : "—"}
        </Txt>
        <Ionicons name="chevron-forward" size={18} color={t.muted} />
      </View>
    </Pressable>
  );
}

export function PartOffers({ data, icon }: { data: PartPrices; icon: IconName }) {
  const t = useTheme();
  // Index, not a copy: the open sheet shows photos/references as they arrive.
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const open = openIdx === null ? null : (data.offers[openIdx] ?? null);

  // Keep the agent's order (cheapest first) inside each part.
  const groups: Array<{ part: string; offers: PartOffer[] }> = [];
  for (const o of data.offers) {
    const g = groups.find((x) => x.part === o.part);
    if (g) g.offers.push(o);
    else groups.push({ part: o.part, offers: [o] });
  }

  return (
    <View style={{ gap: space.lg }}>
      {data.oemRefs.length > 0 && (
        <Card style={{ gap: space.sm }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
            <Ionicons name="ribbon-outline" size={18} color={t.primary} />
            <Txt variant="bodyStrong">Référence d'origine (constructeur)</Txt>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
            {data.oemRefs.map((r) => (
              <View key={r} style={{ backgroundColor: t.surface2, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 6 }}>
                <Txt selectable style={{ fontFamily: font.semibold, letterSpacing: 0.5 }}>
                  {r}
                </Txt>
              </View>
            ))}
          </View>
          <Txt variant="caption" tone="muted">
            Toute pièce équivalente doit correspondre à cette référence. Appui long pour la copier.
          </Txt>
        </Card>
      )}

      {data.enriching ? (
        <Txt variant="caption" tone="muted" accessibilityLiveRegion="polite">
          J'ajoute les photos et les références des pièces…
        </Txt>
      ) : null}

      {groups.map((g) => {
        const prices = g.offers.map((o) => o.priceTnd).filter((p): p is number => p !== null);
        const min = prices.length ? Math.min(...prices) : null;
        return (
          <Card key={g.part} padded={false} style={{ overflow: "hidden", gap: 0 }}>
            <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.sm, gap: space.md }}>
              <Txt variant="heading" accessibilityRole="header" style={{ flex: 1 }}>
                {g.part}
              </Txt>
              <Txt variant="caption" tone="muted">
                {g.offers.length} offre{g.offers.length > 1 ? "s" : ""}
                {min !== null ? ` · dès ${tnd(min)}` : ""}
              </Txt>
            </View>
            {g.offers.map((o, i) => (
              <OfferRow
                key={o.url + i}
                offer={o}
                first={i === 0}
                cheapest={min !== null && o.priceTnd === min && g.offers.length > 1}
                pending={data.enriching}
                icon={icon}
                onOpen={() => setOpenIdx(data.offers.indexOf(o))}
              />
            ))}
          </Card>
        );
      })}

      {open ? <OfferSheet offer={open} icon={icon} pending={data.enriching} onClose={() => setOpenIdx(null)} /> : null}
    </View>
  );
}
