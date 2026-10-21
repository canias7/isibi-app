import { AppTabs } from "@/components/app";

export default function TabLayout() {
  return (
    <AppTabs tabs={[
      { name: "index", title: "Today", icon: "home" },
      { name: "loaves", title: "Loaves", icon: "basket" },
      { name: "order", title: "Order", icon: "shop" },
      { name: "hours", title: "Hours", icon: "hours" },
    ]} />
  );
}
