import { Tabs } from "expo-router";
import { SymbolView } from "expo-symbols";
import { theme } from "./theme";

/** One tab: the screen file in `app/(tabs)/` (`index` is the first), its label, and an icon from `TAB_ICONS`. */
export type AppTab = { name: string; title: string; icon: keyof typeof TAB_ICONS };

/** The icons a tab can use, by plain name: each is the iPhone's own symbol and Android's own icon. */
export const TAB_ICONS = {
  home: ["house.fill", "home"], menu: ["list.bullet", "list"], shop: ["bag.fill", "shopping_bag"],
  basket: ["basket.fill", "shopping_basket"], order: ["cart.fill", "shopping_cart"], book: ["calendar", "calendar_month"],
  hours: ["clock.fill", "schedule"], map: ["map.fill", "map"], info: ["info.circle.fill", "info"],
  profile: ["person.crop.circle.fill", "account_circle"], chat: ["bubble.left.fill", "chat"], heart: ["heart.fill", "favorite"],
  star: ["star.fill", "star"], search: ["magnifyingglass", "search"], gallery: ["photo.on.rectangle", "photo_library"],
} as const;

/**
 * THE TAB BAR, the one navigation an app has. `app/(tabs)/_layout.tsx` is
 * exactly `<AppTabs tabs={[…]} />`: two to five tabs, the home screen first.
 */
export function AppTabs({ tabs }: { tabs: AppTab[] }) {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.soft,
        tabBarStyle: { backgroundColor: theme.card, borderTopColor: theme.line },
        headerStyle: { backgroundColor: theme.paper },
        headerShadowVisible: false,
        headerTitleStyle: { color: theme.ink, fontWeight: "700" },
      }}
    >
      {tabs.slice(0, 5).map((t) => {
        const [ios, android] = TAB_ICONS[t.icon] || TAB_ICONS.info;
        return (
          <Tabs.Screen
            key={t.name}
            name={t.name}
            options={{
              title: t.title,
              tabBarIcon: ({ color }) => <SymbolView name={{ ios, android, web: android } as never} tintColor={color} size={24} />,
            }}
          />
        );
      })}
    </Tabs>
  );
}
