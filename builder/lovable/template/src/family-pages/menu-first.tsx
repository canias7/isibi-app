// menu-first — "the list of things IS the page". Directive components only.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { MenuSection } from "@/components/ui/menu-section";
import { OpenNow } from "@/components/ui/open-now";
import { OpeningHours, type DayHours } from "@/components/ui/opening-hours";
import { LocationCard } from "@/components/ui/location-card";
export const Route = createFileRoute("/")({ component: P });
const HOURS: DayHours[] = [
  { day: 1, label: "Monday", open: "07:30", close: "15:00" },
  { day: 2, label: "Tuesday", open: "07:30", close: "15:00" },
  { day: 3, label: "Wednesday", open: "07:30", close: "15:00" },
  { day: 4, label: "Thursday", open: "07:30", close: "15:00" },
  { day: 5, label: "Friday", open: "07:30", close: "16:00" },
  { day: 6, label: "Saturday", open: "08:30", close: "16:00" },
  { day: 0, label: "Sunday", open: null, close: null },
];
function P() {
  return (
    <SiteChrome name="Pennine & Steam" tagline="Coffee and toast on Division Street."
      links={[{ label: "Menu", href: "#menu" }, { label: "Find us", href: "#find" }]}
      action={{ label: "Directions", href: "#find" }}>
      <div className="mx-auto max-w-2xl px-6 py-10">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">Pennine &amp; Steam</h1>
          <OpenNow hours={HOURS.filter((h) => h.open).map((h) => ({ day: h.day, open: h.open!, close: h.close! }))} />
        </div>
        <p className="mt-2 text-muted-foreground">Espresso from Foundry, bread from Seven Hills. That's the whole idea.</p>
        <div id="menu" className="mt-10">
          <MenuSection groups={[
            { name: "Coffee", items: [
              { name: "Espresso", price: 2.6 }, { name: "Flat white", price: 3.4 },
              { name: "Batch filter", price: 2.8, meta: "refill £1" },
              { name: "Cortado", price: 3.2 }]},
            { name: "Toast", note: "Until 11:30", items: [
              { name: "Marmite & butter", price: 3.5 }, { name: "Raspberry jam", price: 3.5 },
              { name: "Whipped ricotta, honey", price: 5.5, meta: "add walnuts £1" }]},
            { name: "Cake", items: [
              { name: "Brown butter blondie", price: 3.8 }, { name: "Lemon drizzle", price: 3.6 }]},
          ]} />
        </div>
        <div id="find" className="mt-12 grid gap-6 sm:grid-cols-2">
          <OpeningHours days={HOURS} />
          <LocationCard name="Pennine & Steam" address="41 Division Street, Sheffield S1 4GE" note="No bookings — it's eleven stools." />
        </div>
      </div>
    </SiteChrome>
  );
}
