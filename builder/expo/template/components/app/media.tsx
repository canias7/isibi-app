import { Image, Text, View } from "react-native";

/** A picture, or the app's own soft placeholder when there is none yet — never a broken image. */
export function Thumb({ src, size = 52, label }: { src?: string | null; size?: number; label?: string }) {
  if (src) return <Image source={{ uri: src }} style={{ width: size, height: size, borderRadius: 10 }} accessibilityLabel={label} />;
  return <View style={{ width: size, height: size }} className="rounded-[10px] bg-accent" accessibilityLabel={label} />;
}

/** A card with a picture on top — a product, a dish, a service. Use several in a `ScrollView horizontal` for a row of them. */
export function Card({ title, subtitle, image, width = 150 }: { title: string; subtitle?: string; image?: string | null; width?: number }) {
  return (
    <View style={{ width }} className="gap-1 rounded-app bg-card p-2.5">
      {image ? <Image source={{ uri: image }} style={{ height: 100, borderRadius: 12 }} /> : <View className="h-[100px] rounded-xl bg-accent" />}
      <Text className="font-bold text-ink">{title}</Text>
      {subtitle ? <Text className="font-bold text-primary">{subtitle}</Text> : null}
    </View>
  );
}

/** A small rounded label: a status, a tag. `good` is the green "open now" kind. */
export function Badge({ label, tone = "plain" }: { label: string; tone?: "plain" | "good" }) {
  return (
    <View className={(tone === "good" ? "bg-good/15" : "bg-accent") + " flex-row items-center gap-2 self-start rounded-full px-3 py-1.5"}>
      {tone === "good" ? <View className="h-2 w-2 rounded-full bg-good" /> : null}
      <Text className={(tone === "good" ? "text-good" : "text-ink") + " text-[13px] font-semibold"}>{label}</Text>
    </View>
  );
}
