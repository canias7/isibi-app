// menu-first — the list of things IS the page; one scroll, no nav needed. A
// café: thin masthead with the live answer, the menu in full with real
// descriptions, the room, kind words, and find-us. Everything within one
// scroll of everything.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Gallery } from "@/components/ui/gallery";
import { LocationCard } from "@/components/ui/location-card";
import { MenuSection } from "@/components/ui/menu-section";
import { OpenNow } from "@/components/ui/open-now";
import { OpeningHours, type DayHours } from "@/components/ui/opening-hours";
import { SectionHeader } from "@/components/ui/section-header";
import { Testimonial } from "@/components/ui/testimonial";
export const Route = createFileRoute("/")({ component: P });
const HOURS: DayHours[] = [
  { day: 1, label: "Monday", open: "07:30", close: "16:00" },
  { day: 2, label: "Tuesday", open: "07:30", close: "16:00" },
  { day: 3, label: "Wednesday", open: "07:30", close: "16:00" },
  { day: 4, label: "Thursday", open: "07:30", close: "16:00" },
  { day: 5, label: "Friday", open: "07:30", close: "16:00" },
  { day: 6, label: "Saturday", open: "08:30", close: "17:00" },
  { day: 0, label: "Sunday", open: "09:00", close: "15:00" },
];
function P() {
  return (
    <SiteChrome name="Pennine & Steam" tagline="Coffee and toast at Division Street."
      links={[{ label: "The menu", href: "#menu" }, { label: "Find us", href: "#find-us" }]}
      action={{ label: "Directions", href: "#find-us" }}>

      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-3xl px-6 py-14">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Division Street · est. 2019</p>
              <h1 className="mt-2 text-4xl font-semibold tracking-tight">Pennine &amp; Steam</h1>
              <p className="mt-3 max-w-md text-lg text-muted-foreground">Espresso from Foundry, bread from Seven Hills, and that's the whole trick.</p>
            </div>
            <OpenNow hours={HOURS.map((h) => ({ day: h.day, open: h.open!, close: h.close! }))} />
          </div>
        </div>
      </section>

      <section id="menu" className="mx-auto max-w-3xl px-6 py-14">
        <SectionHeader eyebrow="The menu" title="Everything, priced" description="Oat milk is not an upcharge. Decaf is the same beans, decaffeinated properly." />
        <MenuSection className="mt-8" groups={[
          { name: "Coffee", items: [
            { name: "Espresso", price: 2.6 },
            { name: "Flat white", price: 3.4, description: "Two shots, five ounces, no latte art lectures" },
            { name: "Batch filter", price: 2.9, description: "Changes weekly; ask what's on" },
            { name: "Cortado", price: 3.2 },
            { name: "Hot chocolate", price: 3.6, description: "Proper — a bar melted, not a powder" },
          ] },
          { name: "Toast", note: "Seven Hills sourdough, always", items: [
            { name: "Marmite & butter", price: 3.5, description: "Salted butter, no apologies" },
            { name: "Raspberry jam", price: 3.5, description: "WI stall at the farmers' market, whoever won that month" },
            { name: "Whipped ricotta & honey", price: 5.0, description: "The one everyone photographs" },
            { name: "Beans on, done right", price: 6.0, description: "Slow-cooked, smoked paprika, too much butter" },
          ] },
          { name: "Cake", items: [
            { name: "Brown butter blondie", price: 3.8 },
            { name: "Lemon drizzle", price: 3.6, description: "The recipe is Sam's nan's and stays that way" },
            { name: "Whatever Friday brings", price: 4.0, description: "Follow the window" },
          ] },
        ]} />
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <SectionHeader eyebrow="The room" title="Small on purpose" />
          <Gallery className="mt-8" columns={3} items={[
            { src: null, alt: "The bench in the window" },
            { src: null, alt: "The machine, mid-morning rush" },
            { src: null, alt: "Saturday's cake shelf" },
          ]} />
          <Testimonial className="mt-10" item={{ quote: "Best flat white between Leeds and anywhere. I plan bus changes around it.", name: "Google review", role: "512 of them, 4.9" }} />
        </div>
      </section>

      <section id="find-us" className="mx-auto grid max-w-5xl gap-10 px-6 py-14 sm:grid-cols-2">
        <div>
          <SectionHeader eyebrow="Find us" title="Middle of Division Street" />
          <div className="mt-6 max-w-sm"><OpeningHours days={HOURS} /></div>
        </div>
        <LocationCard className="self-start" name="Pennine & Steam" address="84 Division Street, Sheffield S1 4GF" note="No bookings, no laptops at the window bench on weekends. Dogs always." />
      </section>
    </SiteChrome>
  );
}
