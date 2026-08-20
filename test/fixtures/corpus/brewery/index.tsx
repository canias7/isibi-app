// brewery — RANGE-FIRST: what is pouring right now is the news, because a
// producer's stock changes weekly. The taproom is sold as hard as the bottle.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { CtaBand } from "@/components/ui/cta-band";
import { EventCard } from "@/components/ui/event-card";
import { Gallery } from "@/components/ui/gallery";
import { LocationCard } from "@/components/ui/location-card";
import { OpeningHours, type DayHours } from "@/components/ui/opening-hours";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { StatsBand } from "@/components/ui/stats-band";
import { TapList } from "@/components/ui/tap-list";
import { Testimonial } from "@/components/ui/testimonial";
export const Route = createFileRoute("/")({ component: P });
const HOURS: DayHours[] = [
  { day: 1, label: "Monday", open: null, close: null },
  { day: 2, label: "Tuesday", open: null, close: null },
  { day: 3, label: "Wednesday", open: "16:00", close: "22:00" },
  { day: 4, label: "Thursday", open: "16:00", close: "22:00" },
  { day: 5, label: "Friday", open: "15:00", close: "23:00" },
  { day: 6, label: "Saturday", open: "12:00", close: "23:00" },
  { day: 0, label: "Sunday", open: "12:00", close: "20:00" },
];
function P() {
  return (
    <SiteChrome name="Six Weirs" tagline="A brewery and taproom under the arches at Kelham."
      links={[{ label: "The range", href: "/range" }, { label: "Taproom", href: "/visit" }, { label: "Find us", href: "#find-us" }]}
      action={{ label: "What's pouring", href: "#pouring" }}>

      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid items-start gap-12 lg:grid-cols-[1fr_1.05fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Arch 14, Kelham Island · brewing since 2016</p>
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">Six Weirs</h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                Ten barrels a week, drunk mostly within a mile of where it was made. The taproom is the
                brewery — you drink about four metres from the tanks.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <a className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" href="/visit">Taproom hours</a>
                <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="/range">The whole range</a>
              </div>
              <div className="mt-10 grid grid-cols-2 gap-4">
                <SafeImage src={null} alt="The tanks, from the bar" ratio="1/1" />
                <SafeImage src={null} alt="Arch 14 from Alma Street" ratio="1/1" />
              </div>
            </div>
            <div id="pouring" className="rounded-xl border border-border bg-background p-6 shadow-sm">
              <TapList heading="Pouring now — updated Thursday" pours={[
                { tap: 1, name: "Weir Pale", style: "Pale ale", abv: 4.2, price: "£4.60", serve: "Cask" },
                { tap: 2, name: "Arch 14", style: "Best bitter", abv: 4.5, price: "£4.40", serve: "Cask", note: "The one that pays the rent" },
                { tap: 3, name: "Kelham Dark", style: "Porter", abv: 5.1, price: "£5.20", serve: "Keg" },
                { tap: 4, name: "Cutlers IPA", style: "West coast IPA", abv: 6.4, price: "£6.10", serve: "Keg" },
                { tap: 5, name: "Rivelin Saison", style: "Saison", abv: 5.8, price: "£5.40", serve: "Keg", off: true },
                { tap: 6, name: "Don Lager", style: "Helles", abv: 4.6, price: "£5.00", serve: "Keg" },
                { tap: 7, name: "Guest cider", style: "Medium, Herefordshire", abv: 5.5, price: "£5.20", serve: "Box" },
              ]} />
              <p className="mt-4 text-sm text-muted-foreground">
                Two-thirds and halves on everything. Takeaway in four-pints or two-pint cartons.
              </p>
            </div>
          </div>
          <div className="mt-14 border-t border-border pt-10">
            <StatsBand items={[
              { value: "10 bbl", label: "A week, and that is the ceiling" },
              { value: "7", label: "Lines, one always a guest" },
              { value: "£4.40", label: "A pint of Arch 14, held since 2023" },
              { value: "1 mile", label: "Where most of it gets drunk" },
            ]} />
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <SectionHeader eyebrow="The taproom" title="Four metres from the tanks"
            description="Concrete floor, long benches, no telly. Dogs yes, under-18s until seven." />
          <Gallery className="mt-10" columns={3} items={[
            { alt: "The bar, Friday about six", caption: "Friday, about six" },
            { alt: "The tanks behind the bar", caption: "The tanks are the decor" },
            { alt: "Long benches down the arch", caption: "You will end up talking to somebody" },
            { alt: "The cellar under the arch", caption: "The cellar, which is cold for free" },
            { alt: "Takeaway cartons on the bar", caption: "Four-pints to take away" },
            { alt: "The yard in summer", caption: "The yard, when it is not raining" },
          ]} />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <SectionHeader eyebrow="On this month" title="Things happening in the arch" />
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <EventCard title="Brewery tour & tasting" start="2026-08-09T14:00:00" venue="£18, six people max" />
              <EventCard title="Meet the brewer — porter night" start="2026-08-14T19:00:00" venue="Free, turn up" />
              <EventCard title="Bottle share, bring one" start="2026-08-21T19:30:00" venue="Free, bring something odd" />
              <EventCard title="Cask ale festival" start="2026-09-05T12:00:00" venue="Twelve casks, three days" />
            </div>
          </div>
          <div className="space-y-6">
            <Testimonial item={{ quote: "Asked what the porter was like and got a third of it in my hand before I could answer.", name: "Nadia El-Amin", role: "Google review" }} />
            <Testimonial item={{ quote: "The bitter is four forty and has been for three years. In this economy that is basically a public service.", name: "Rob Ashworth", role: "Every Friday" }} />
          </div>
        </div>
      </section>

      <section id="find-us" className="border-t border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid gap-10 lg:grid-cols-3">
            <div>
              <SectionHeader eyebrow="Find us" title="Under the arches" />
              <LocationCard className="mt-6" name="Six Weirs" address="Arch 14, Alma Street, Kelham Island, S3 8SA"
                note="The blue door under the viaduct. Tram to Shalesmoor, five minutes' walk." />
            </div>
            <div>
              <h3 className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">Taproom hours</h3>
              <OpeningHours className="mt-5" days={HOURS} />
            </div>
            <SafeImage src={null} alt="The blue door under the viaduct" ratio="4/5" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <CtaBand title="It changes every Thursday"
          description="The tap list above is the live one. If you want a particular beer, ring first — ten barrels a week goes quickly."
          action={{ label: "See the whole range", href: "/range" }} />
      </section>
    </SiteChrome>
  );
}
