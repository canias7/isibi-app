import type { ReactNode } from "react";
import { ScrollView, Text, View } from "react-native";

/** A screen's body: the app's paper, scrolling, with even padding and gaps. `bar` sits pinned above the tab bar. */
export function Screen({ children, bar }: { children: ReactNode; bar?: ReactNode }) {
  return (
    <View className="flex-1 bg-paper">
      <ScrollView contentContainerClassName="p-5 gap-4" contentContainerStyle={bar ? { paddingBottom: 110 } : undefined}>
        {children}
      </ScrollView>
      {bar ? <View className="absolute inset-x-0 bottom-0 border-t border-line bg-paper p-4">{bar}</View> : null}
    </View>
  );
}

/** The big title at the top of a screen. */
export function Title({ children }: { children: ReactNode }) {
  return <Text className="text-[32px] font-extrabold leading-tight text-ink">{children}</Text>;
}
/** A section's heading inside a screen. */
export function Heading({ children }: { children: ReactNode }) {
  return <Text className="mt-2 text-xl font-bold text-ink">{children}</Text>;
}
/** Ordinary text: `soft` for the quieter kind under a title. */
export function Body({ children, soft = false }: { children: ReactNode; soft?: boolean }) {
  return <Text className={(soft ? "text-soft" : "text-ink") + " text-base leading-6"}>{children}</Text>;
}
