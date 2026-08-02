// hire /item — one vehicle in full. Spec, rates by period, and the honest list
// of what it will not do — because a hire that turns up too small is a wasted
// day for the customer and a wasted vehicle for the yard.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { AvailabilityCalendar, type Night } from "@/components/ui/availability-calendar";
import { Faq } from "@/components/ui/faq";
import { Gallery } from "@/components/ui/gallery";
import { RateCard } from "@/components/ui/rate-card";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
export const Route = createFileRoute("/item")({ component: P });
const SPEC = [
  ["Load length", "3.4m"],
  ["Load height", "1.9m — you can stand up in it"],
  ["Load width", "1.75m, 1.39m between the arches"],
  ["Payload", "1,300kg"],
  ["Gross weight", "3,500kg — an ordinary car licence"],
  ["Doors", "Side sliding, plus twin rears to 270°"],
  ["Fuel", "Diesel, ~38mpg loaded"],
  ["Extras fitted", "Ply lining, six lashing points, reversing camera"],
];
// Every day of the month, so an absent square reads as "not listed" rather
// than as free — the same rule the component itself refuses to guess at.
const AUGUST: Night[] = Array.from({ length: 31 }, (_, i) => {
  const day = i + 1;
  const dow = new Date(2026, 7, day).getDay();
  return {
    date: `2026-08-${String(day).padStart(2, "0")}`,
    taken: [6, 7, 8, 14, 15, 21, 22, 28, 29].includes(day),
    rate: dow === 5 || dow === 6 ? 64 : 58,
    minNights: dow === 5 ? 3 : 1,
  };
});
function P() {
  return (
    <SiteChrome name="Rivelin Vehicle Hire" tagline="Vans, Lutons and trailers, hired by the day in Sheffield."
      links={[{ label: "Home", href: "#/" }, { label: "Reserve", href: "#/book" }]}
      action={{ label: "Check availability", href: "#/book" }}>

      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <SafeImage src={null} alt="Long wheelbase van" ratio="4/3" />
            <Gallery className="mt-4" columns={4} items={[
              { src: null, alt: "Load area, empty" },
              { src: null, alt: "Rear doors open to 270°" },
              { src: null, alt: "Side door and the arches" },
              { src: null, alt: "The cab" },
            ]} />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Ordinary car licence · 3 on the fleet</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight">Long wheelbase van</h1>
            <p className="mt-2 text-lg text-muted-foreground">Transit L3 · 3.4m load · 1,300kg payload</p>
            <p className="mt-6 max-w-prose text-base leading-relaxed text-muted-foreground">
              The one most people want and the one that runs out first. A two-bed flat fits in it in
              one go; a three-bed house does not, and we would rather tell you that now than at nine
              on a Saturday morning.
            </p>

            <h2 className="mt-8 text-sm font-medium uppercase tracking-widest text-muted-foreground">Specification</h2>
            <dl className="mt-3 divide-y divide-border border-y border-border text-sm">
              {SPEC.map(([k, v]) => (
                <div key={k} className="grid grid-cols-[9rem_1fr] gap-4 py-2.5">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>

            {/* THE HONEST HALF. A hire that turns up too small is a wasted day
                at both ends, and it is the single most common complaint in this
                trade. */}
            <h2 className="mt-8 text-sm font-medium uppercase tracking-widest text-muted-foreground">What it will not do</h2>
            <ul className="mt-3 divide-y divide-border border-y border-border text-sm">
              <li className="py-2.5">A three-bedroom house in one load. That is the Luton, or two runs.</li>
              <li className="py-2.5">Anything over 1.39m wide flat on the floor — the wheel arches are the limit, not the walls.</li>
              <li className="py-2.5">Go under a 2.0m height barrier. It is 2.55m to the roof and multi-storey car parks are out.</li>
              <li className="py-2.5">Tow. The trailer goes behind the Luton or the tipper, not this.</li>
              <li className="py-2.5">Carry anything wet or loose without a sheet — ply lining is not a skip.</li>
            </ul>
          </div>
        </div>

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="Rates" title="Priced by period, with the per-day figure worked out"
            description="Compare the right-hand column, not the left. A week costs a third less per day than three days do." />
          <div className="mt-8 max-w-3xl">
            <RateCard unit="day" caption="Long wheelbase van" bands={["Weekday", "Weekend"]}
              rates={[
                { period: "A day", units: 1, price: 58, more: [64] },
                { period: "A weekend, Fri–Mon", units: 3, price: 132, more: [132], note: "Out Friday after 4, back Monday by 9" },
                { period: "Three days", units: 3, price: 145, more: [158] },
                { period: "A week", units: 7, price: 245, more: [245] },
                { period: "A month", units: 28, price: 720, more: [720] },
              ]}
              note="Insurance is in the price. Fuel is not — it goes out full and comes back full, and we charge forecourt rates plus nothing if it does not." />
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="Availability" title="Which days this van is free"
            description="Straight off the board. Struck through means it is out. Weekends carry a three-day minimum in summer because a Saturday-only hire ties it up for the whole weekend." />
          <div className="mt-8 max-w-3xl">
            <AvailabilityCalendar nights={AUGUST} month="2026-08" now={new Date(2026, 7, 2)} />
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="max-w-3xl">
            <SectionHeader eyebrow="Asked often" title="About this one" />
            <Faq className="mt-6" items={[
              { question: "Will a washing machine fit through the side door?", answer: "Yes, and a fridge-freezer. The side opening is 1.3m wide and 1.5m tall." },
              { question: "Can two people move a house with it?", answer: "A one or two-bed flat, comfortably. Anything bigger and you want the Luton with the tail lift — the lift is what saves your back, not the size." },
              { question: "Is there a sat nav?", answer: "No, and there is a phone cradle and a USB socket. A hire van's sat nav is always three years out of date." },
              { question: "What if it breaks down?", answer: "Full breakdown cover including recovery to your destination, not to the nearest garage. Ring us first — we usually have another van on the road." },
            ]} />
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
