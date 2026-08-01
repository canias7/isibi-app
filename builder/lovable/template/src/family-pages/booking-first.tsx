// booking-first — the slot picker is the hero; everything else supports the
// appointment. A nail studio: prices as a menu, the people, the week's slots.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { AvailabilityGrid } from "@/components/ui/availability-grid";
import { OpenNow } from "@/components/ui/open-now";
import { OpeningHours, type DayHours } from "@/components/ui/opening-hours";
import { PriceList } from "@/components/ui/price-list";
import { TeamGrid } from "@/components/ui/team-grid";
export const Route = createFileRoute("/")({ component: P });
const HOURS: DayHours[] = [
  { day: 1, label: "Monday", open: null, close: null },
  { day: 2, label: "Tuesday", open: "10:00", close: "18:00" },
  { day: 3, label: "Wednesday", open: "10:00", close: "18:00" },
  { day: 4, label: "Thursday", open: "10:00", close: "20:00" },
  { day: 5, label: "Friday", open: "10:00", close: "20:00" },
  { day: 6, label: "Saturday", open: "09:00", close: "17:00" },
  { day: 0, label: "Sunday", open: null, close: null },
];
function P() {
  const [slot, setSlot] = useState<string | null>(null);
  return (
    <SiteChrome name="Tenfold Nails" tagline="Ten chairs on Ecclesall Road."
      links={[{ label: "Prices", href: "#prices" }, { label: "The team", href: "#team" }]}
      action={{ label: "Book now", href: "#book" }}>
      <div className="mx-auto max-w-3xl px-6 py-12">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">Tenfold Nails</h1>
          <OpenNow hours={HOURS.filter((h) => h.open).map((h) => ({ day: h.day, open: h.open!, close: h.close! }))} />
        </div>
        {/* The booking surface IS the hero — pick a time before anything else. */}
        <section id="book" className="mt-6 rounded-xl border bg-muted/40 p-5">
          <h2 className="text-lg font-medium">Today's chairs</h2>
          <AvailabilityGrid className="mt-4"
            slots={["10:00", "10:45", "11:30", "12:15", "14:00", "14:45", "15:30", "16:15"]}
            taken={["10:45", "14:00"]} value={slot} onSelect={setSlot} />
          <p className="mt-3 text-sm text-muted-foreground">{slot ? `Holding ${slot} — pick a finish below.` : "Pick a time; we hold it for ten minutes."}</p>
        </section>
        <section id="prices" className="mt-10">
          <h2 className="text-lg font-medium">The list</h2>
          <PriceList className="mt-2" items={[
            { name: "Shape and paint", price: 22, meta: "30 min" },
            { name: "Gel, full set", price: 34, meta: "50 min" },
            { name: "BIAB overlay", price: 38, meta: "60 min" },
            { name: "Removal and tidy", price: 14, meta: "25 min" }]} />
        </section>
        <section id="team" className="mt-10">
          <h2 className="text-lg font-medium">Who's on</h2>
          <TeamGrid className="mt-4" items={[
            { name: "Mei Lin", role: "Owner — BIAB and art" },
            { name: "Sofia Petrov", role: "Gel and chrome" },
            { name: "Amber Quinn", role: "Classic manicure" },
            { name: "Jade Nakamura", role: "Saturdays" }]} />
        </section>
        <section className="mt-10 max-w-sm"><OpeningHours days={HOURS} /></section>
      </div>
    </SiteChrome>
  );
}
