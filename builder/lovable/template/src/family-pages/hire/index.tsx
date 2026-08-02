// hire — ITEM-AND-DATES-FIRST: pick the thing, pick the dates, see the price.
// The deposit and the excess are on the page rather than discovered at the
// counter, which is the one thing everybody in this trade gets stung by.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Faq } from "@/components/ui/faq";
import { LocationCard } from "@/components/ui/location-card";
import { OpeningHours } from "@/components/ui/opening-hours";
import { RateCard } from "@/components/ui/rate-card";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { TrustStrip } from "@/components/ui/trust-strip";
export const Route = createFileRoute("/")({ component: P });
export const FLEET = [
  { name: "Short wheelbase van", spec: "Transit Custom · 2.5m load · 1,100kg", day: 48, alt: "Short wheelbase van" },
  { name: "Long wheelbase van", spec: "Transit L3 · 3.4m load · 1,300kg", day: 58, alt: "Long wheelbase van" },
  { name: "Luton with a tail lift", spec: "4.0m box · 1,000kg lift", day: 78, alt: "Luton van with tail lift" },
  { name: "7.5 tonne", spec: "6.0m box · needs a C1 licence", day: 125, alt: "7.5 tonne lorry" },
  { name: "Car trailer", spec: "Braked, 2,700kg gross", day: 35, alt: "Car trailer" },
  { name: "Tipper", spec: "3.5t · electric tip · caged sides", day: 92, alt: "Tipper truck" },
];
function P() {
  return (
    <SiteChrome name="Rivelin Vehicle Hire" tagline="Vans, Lutons and trailers, hired by the day in Sheffield."
      links={[{ label: "One van in full", href: "#/item" }, { label: "Reserve", href: "#/book" }, { label: "Find us", href: "#find-us" }]}
      action={{ label: "Check availability", href: "#/book" }}>

      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Neepsend · open 7 days · deposit £150, excess £750, both on this page</p>
          <h1 className="mt-3 max-w-3xl text-5xl font-semibold tracking-tight text-balance">
            Every rate, every deposit, before you ring
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Six vehicles, priced by the day, the weekend, the week and the month — with the per-day
            figure worked out for you, because a week is usually cheaper than four days and nobody
            ever notices.
          </p>
          <TrustStrip className="mt-10" items={[
            { title: "£150 deposit", description: "Held, not taken. Back within three days" },
            { title: "£750 excess", description: "Reducible to £150 for £12 a day" },
            { title: "Unlimited mileage", description: "In the UK. No hidden per-mile charge" },
          ]} />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <SectionHeader eyebrow="The fleet" title="Six vehicles, all on the road today"
            description="Day rates below. Every one of them is priced by longer periods too, which is almost always the cheaper answer." />
          <a className="text-sm font-medium underline underline-offset-4" href="#/item">One in full →</a>
        </div>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FLEET.map((v) => (
            <a key={v.name} href="#/item" className="group block">
              <SafeImage src={null} alt={v.alt} ratio="4/3" fallbackSeed={v.name} />
              <h3 className="mt-3 text-lg font-medium underline-offset-4 group-hover:underline">{v.name}</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">{v.spec}</p>
              <p className="mt-1 text-base tabular-nums">£{v.day} <span className="text-sm text-muted-foreground">a day</span></p>
            </a>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <SectionHeader eyebrow="Rates" title="The longer you take it, the less a day costs"
            description="The right-hand column is the figure to compare on. Three days and a week are within thirty pounds of each other, which is the thing worth knowing before you book." />
          <div className="mt-8 max-w-3xl">
            <RateCard unit="day" caption="Long wheelbase van"
              rates={[
                { period: "A day", units: 1, price: 58 },
                { period: "A weekend, Fri–Mon", units: 3, price: 132, note: "Collected Friday after 4, back Monday by 9" },
                { period: "Three days", units: 3, price: 145 },
                { period: "A week", units: 7, price: 245 },
                { period: "A month", units: 28, price: 720 },
              ]}
              note="Every vehicle is priced this way — the numbers change, the shape does not. Fuel is yours; the tank is full when you take it and full when it comes back." />
          </div>
        </div>
      </section>

      <section id="find-us" className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-12 lg:grid-cols-[1fr_1fr]">
          <div>
            <SectionHeader eyebrow="Find us" title="Rutland Road" />
            <LocationCard className="mt-6" name="Rivelin Vehicle Hire"
              address="Arch 4, Rutland Road, Neepsend, Sheffield, S3 8DG"
              note="Under the viaduct, third arch along. Free parking for the car you leave behind, for as long as the hire lasts." />
            <OpeningHours className="mt-6" days={[
              { day: 1, label: "Monday", open: "07:30", close: "18:00" },
              { day: 2, label: "Tuesday", open: "07:30", close: "18:00" },
              { day: 3, label: "Wednesday", open: "07:30", close: "18:00" },
              { day: 4, label: "Thursday", open: "07:30", close: "18:00" },
              { day: 5, label: "Friday", open: "07:30", close: "19:00" },
              { day: 6, label: "Saturday", open: "08:00", close: "16:00" },
              { day: 0, label: "Sunday", open: "09:00", close: "13:00" },
            ]} />
          </div>
          <div>
            <SectionHeader eyebrow="Asked often" title="The things people find out too late" />
            <Faq className="mt-6" items={[
              { question: "What licence do I need?", answer: "An ordinary car licence covers everything up to the Luton. The 7.5 tonne needs a C1, which you only have automatically if you passed your test before 1997." },
              { question: "How much is the deposit really?", answer: "£150, held on a card, released within three days of the vehicle coming back. It is not taken and it is not a fee." },
              { question: "What is the excess?", answer: "£750 as standard, which is what you would pay towards any damage. £12 a day brings it down to £150 and most people take it for anything longer than a weekend." },
              { question: "Is there a mileage limit?", answer: "Not in the UK. Abroad needs telling us first and costs £45 for the paperwork." },
              { question: "What if I bring it back late?", answer: "An hour is free. After that it is a half day, and after four hours it is a full one — because the next person is standing at the counter." },
              { question: "Do I have to clean it?", answer: "Sweep it out. We do not charge for a normal amount of dirt and we do charge £60 for a van with a skip's worth of rubble in it." },
            ]} />
          </div>
        </div>
      </section>
    </SiteChrome>
  );
}
