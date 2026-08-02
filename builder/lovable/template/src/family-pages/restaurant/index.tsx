// restaurant — the list of things IS the page; one scroll, no nav needed. A
// café on Division Street: a full-bleed picture of the room, the live answer to
// "are you open", the menu in full with real descriptions, the room in
// photographs, kind words, and find-us.
//
// REWRITTEN 2026-08-02. The first version was one 3xl column of small text on
// white with no picture anywhere — the wrong answer twice over for a café,
// because a café is chosen on how the ROOM looks before anybody reads a word,
// and a menu with no photographs is a price list. Now a picture leads at
// 21/9, the menu runs two columns with the counter beside it, and there is a
// real gallery band. Wider throughout (6xl, not 3xl) so 1280px stops having
// dead margins down both sides.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { CtaBand } from "@/components/ui/cta-band";
import { Gallery } from "@/components/ui/gallery";
import { LocationCard } from "@/components/ui/location-card";
import { Marquee } from "@/components/ui/marquee";
import { MenuSection } from "@/components/ui/menu-section";
import { OpenNow } from "@/components/ui/open-now";
import { OpeningHours, type DayHours } from "@/components/ui/opening-hours";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { StatsBand } from "@/components/ui/stats-band";
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
      links={[{ label: "The menu", href: "#menu" }, { label: "The room", href: "#room" }, { label: "Find us", href: "#find-us" }]}
      action={{ label: "Directions", href: "#find-us" }}>

      {/* The words and the room, side by side.
          NOT a full-bleed band, and that is a measured decision rather than a
          taste one: a 1280×550 picture slot with nothing in it is 550px of wash
          before a visitor reads a single word, and every site is image-empty on
          day one. Beside the words, the same slot reads as a picture that has
          not been added yet — which is what it is. */}
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_1fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Division Street · Sheffield · est. 2019</p>
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">Pennine &amp; Steam</h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                Espresso from Foundry, bread from Seven Hills, and that's the whole trick. Eleven tables,
                one grinder, and nobody has ever been rushed out of the window seat.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <a className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" href="#menu">See the menu</a>
                <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="#find-us">Find us</a>
                <OpenNow hours={HOURS.map((h) => ({ day: h.day, open: h.open!, close: h.close! }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <SafeImage src={null} alt="The counter at half seven" ratio="3/4" className="col-span-1" />
              <div className="flex flex-col gap-4">
                <SafeImage src={null} alt="The bench in the window" ratio="1/1" />
                <SafeImage src={null} alt="Out of the grinder" ratio="1/1" />
              </div>
            </div>
          </div>
          <div className="mt-14 border-t border-border pt-10">
            <StatsBand items={[
              { value: "07:30", label: "First coffee, weekdays" },
              { value: "£2.60", label: "Espresso, and it stays there" },
              { value: "11", label: "Tables, including the window" },
              { value: "4.9", label: "On Google, 512 reviews" },
            ]} />
          </div>
        </div>
      </section>

      {/* A café's real inventory of promises, said once and quickly. */}
      <section className="border-b border-border bg-muted/50 py-3">
        <Marquee speed={38} items={[
          "Oat milk is not an upcharge",
          "Decaf is the same beans, decaffeinated properly",
          "Dogs always — water bowl by the door",
          "Bread from Seven Hills, in at six",
          "Cash or card, no minimum",
          "The window bench is nobody's reserved table",
        ].map((t) => <span key={t} className="text-sm text-muted-foreground">{t}</span>)} />
      </section>

      <section id="menu" className="mx-auto max-w-6xl px-6 py-20">
        <SectionHeader eyebrow="The menu" title="Everything, priced"
          description="Changes twice a year; the coffee never does. Ask what's on batch — it is usually worth it." />
        <div className="mt-10 grid gap-12 lg:grid-cols-[1.45fr_1fr]">
          <MenuSection groups={[
            { name: "Coffee", note: "Foundry's Alpine, plus one rotating single origin", items: [
              { name: "Espresso", price: 2.6 },
              { name: "Flat white", price: 3.4, description: "Two shots, five ounces, no latte art lectures" },
              { name: "Batch filter", price: 2.9, description: "Changes weekly; ask what's on" },
              { name: "Cortado", price: 3.2 },
              { name: "Hot chocolate", price: 3.6, description: "Proper — a bar melted, not a powder" },
            ] },
            { name: "Toast", note: "Seven Hills sourdough, always", items: [
              { name: "Marmite & butter", price: 3.5, description: "Salted butter, no apologies" },
              { name: "Raspberry jam", price: 3.5, description: "WI stall at the farmers' market, whoever won that month" },
              { name: "Whipped ricotta & honey", price: 5, description: "The one everyone photographs" },
              { name: "Beans on, done right", price: 6, description: "Slow-cooked, smoked paprika, too much butter" },
            ] },
            { name: "Cake", items: [
              { name: "Brown butter blondie", price: 3.8 },
              { name: "Lemon drizzle", price: 3.6, description: "The recipe is Sam's nan's and stays that way" },
              { name: "Whatever Friday brings", price: 4, description: "Follow the window" },
            ] },
          ]} />

          <div className="flex flex-col gap-6">
            <SafeImage src={null} alt="Whipped ricotta and honey, the one everyone photographs" ratio="4/3" />
            <figure className="rounded-lg border border-border bg-muted/40 p-6">
              <blockquote className="text-lg leading-relaxed text-balance">
                “We buy about forty kilos a month and roast none of it ourselves. That is the job of people
                who are better at it than we are.”
              </blockquote>
              <figcaption className="mt-4 text-sm text-muted-foreground">Sam Ellery — she opened it</figcaption>
            </figure>
            <SafeImage src={null} alt="Batch filter, poured at the counter" ratio="4/3" />
          </div>
        </div>
      </section>

      <section id="room" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <SectionHeader eyebrow="The room" title="Small on purpose"
            description="Two big windows onto Division Street, and one bench that seats six if everybody is friendly." />
          <Gallery className="mt-10" columns={3} items={[
            { alt: "The bench in the window, mid-morning", caption: "The window bench — first come" },
            { alt: "The machine during the rush", caption: "One grinder, one job" },
            { alt: "The long bench along the back wall", caption: "Six, if everyone is friendly" },
            { alt: "Bread in from Seven Hills at six", caption: "In at six, gone by two" },
            { alt: "Saturday, from the door", caption: "Saturday, about eleven" },
            { alt: "Saturday's cake shelf", caption: "Friday brings whatever it brings" },
          ]} />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <SectionHeader eyebrow="Kind words" title="What people say when nobody is asking" />
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          <Testimonial item={{ quote: "The only place near work where nobody minds if you sit with one coffee for an hour and a half.", name: "Ruth Oyelaran", role: "Most Tuesdays" }} />
          <Testimonial item={{ quote: "I asked what was on batch and got a four-minute answer. That is the right amount of enthusiasm.", name: "Tom Brackley", role: "Found it by accident" }} />
          <Testimonial item={{ quote: "Best flat white between Leeds and anywhere. I plan bus changes around it.", name: "Google review", role: "512 of them, 4.9" }} />
        </div>
      </section>

      <section id="find-us" className="border-t border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid gap-10 lg:grid-cols-[1fr_1fr_1.1fr]">
            <div>
              <SectionHeader eyebrow="Find us" title="Middle of Division Street" />
              <LocationCard className="mt-6" name="Pennine & Steam" address="84 Division Street, Sheffield, S1 4GF"
                note="Two doors up from the barbers, the blue frontage. No bookings, no laptops at the window bench on weekends." />
            </div>
            <div>
              <h3 className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">Opening hours</h3>
              <OpeningHours className="mt-5" days={HOURS} />
            </div>
            <SafeImage src={null} alt="The blue frontage on Division Street" ratio="4/5" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <CtaBand title="We do not take bookings" description="Eleven tables, first come. Before eleven on a weekday you will always get one."
          action={{ label: "Get directions", href: "#find-us" }} />
      </section>
    </SiteChrome>
  );
}
