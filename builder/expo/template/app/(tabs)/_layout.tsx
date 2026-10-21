import { AppTabs } from "@/components/app";

export default function TabLayout() {
  return <AppTabs tabs={[{ name: "index", title: "Home", icon: "home" }]} />;
}
