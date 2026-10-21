import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { Thumb } from "./media";

/** A tappable row: a picture or icon on the left, a title and a line under it, and something on the right (a price, a time). At least 64pt tall. */
export function ListRow({ title, subtitle, right, image, onPress }: {
  title: string; subtitle?: string; right?: string; image?: string | null; onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} className="min-h-[64px] flex-row items-center gap-3 rounded-app bg-card p-3 active:bg-accent/30">
      {image !== undefined ? <Thumb src={image} size={52} /> : null}
      <View className="flex-1">
        <Text className="text-base font-bold text-ink">{title}</Text>
        {subtitle ? <Text className="mt-0.5 text-[13px] text-soft">{subtitle}</Text> : null}
      </View>
      {right ? <Text className="text-base font-bold text-primary">{right}</Text> : null}
    </Pressable>
  );
}

/** Rows that belong together, in one rounded block with hairlines between them — settings, opening hours, contact details. */
export function Group({ children }: { children: ReactNode }) {
  return <View className="overflow-hidden rounded-app bg-card">{children}</View>;
}
/** A plain row inside a `Group`: a label on the left and a value on the right. `strong` lights the row up (today, the selected one). */
export function GroupRow({ label, value, strong = false, last = false }: { label: string; value?: string; strong?: boolean; last?: boolean }) {
  return (
    <View className={"min-h-[50px] flex-row items-center justify-between px-4" + (last ? "" : " border-b border-line")}>
      <Text className={strong ? "text-base font-bold text-primary" : "text-base text-ink"}>{label}</Text>
      {value ? <Text className="text-base font-semibold text-ink">{value}</Text> : null}
    </View>
  );
}

/** A filter or a choice of a few: chips in a row, one lit. */
export function Chips({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((o) => (
        <Pressable key={o} onPress={() => onChange(o)} className={(o === value ? "border-primary bg-primary" : "border-line bg-card") + " rounded-full border px-4 py-2"}>
          <Text className={(o === value ? "text-on-primary" : "text-ink") + " text-[13px] font-semibold"}>{o}</Text>
        </Pressable>
      ))}
    </View>
  );
}
