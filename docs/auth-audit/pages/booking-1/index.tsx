import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRows, type Row } from "@/lib/rows";
import { CtaBand } from "@/components/ui/cta-band";
import { Gallery } from "@/components/ui/gallery";
import { LocationCard } from "@/components/ui/location-card";
import { OpenNow } from "@/components/ui/open-now";
import { OpeningHours, type DayHours } from "@/components/ui/opening-hours";
import { PriceList } from "@/components/ui/price-list";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Skeleton } from "@/components/ui/skeleton";
import { TeamGrid } from "@/components/ui/team-grid";
import { Testimonial } from "@/components/ui/testimonial";
import { TrustStrip } from "@/components/ui/trust-strip";

export const Route = createFileRoute("/")({ component: Home });

type Teacher = Row & { name: string; bio: string | null; photo_url: string | null };

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A calm, well-lit room. Come as you are.",
  links: [
    { label: "Classes", href: "#classes" },
    { label: "Teachers", href: "#teachers" },
    { label: "The work", href: "/work" },
    { label: "Find us", href: "#find-us" },
  ],
  action: { label: "Book now", href: "/book" },
};

const HOURS: DayHours[] = [
  { day: 1, label: "Monday", open: "07:00", close: "20:30" },
  { day: 2, label: "Tuesday", open: "07:00", close: "20:30" },
  { day: 3, label: "Wednesday", open: "07:00", close: "20:30" },
  { day: 4, label: "Thursday", open: "07:00", close: "20:30" },
  { day: 5, label: "Friday", open: "07:00", close: "19:00" },
  { day: 6, label: "Saturday", open: "09:00", close: "14:00" },
  { day: 0, label: "Sunday", open: "09:00", close: "13:00" },
];

const CLASSES = [
  { name: "Morning Flow", description: "A gentle vinyasa to start the day", price: 14, meta: "60 min" },
  { name: "Hatha Foundations", description: "Slow, precise, good for beginners", price: 14, meta: "60 min" },
  { name: "Power Vinyasa", description: "Fast-paced and sweaty", price: 16, meta: "75 min" },
  { name: "Restorative", description: "Long holds, blankets and bolsters", price: 14, meta: "60 min" },
  { name: "Candlelit Yin", description: "Deep stretch as the room dims", price: 15, meta: "75 min" },
];

function Home() {
  const teachers = useRows<Teacher>("teachers", { order: "name", dir: "asc" });
  const navigate = useNavigate();

  return (
    <SiteChrome {...CHROME}>
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Aurora Yoga</p>
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">Roll out your mat, we'll take it from there</h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                Small classes, proper alignment cues, and a room that always smells faintly of eucalyptus. Check what's on today and book a spot.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <a className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground motion-press" href="/book">Check availability</a>
                <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="#classes">See the classes</a>
                <OpenNow hours={HOURS.map((h) => ({ day: h.day, open: h.open!, close: h.close! }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <SafeImage src={null} alt="" fallbackSeed="studio-1" ratio="1/1" />
              <SafeImage src={null} alt="" fallbackSeed="studio-2" ratio="1/1" />
              <SafeImage src={null} alt="" fallbackSeed="studio-3" ratio="1/1" />
              <SafeImage src={null} alt="" fallbackSeed="studio-4" ratio="1/1" />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <TrustStrip
          items={[
            { title: "Small classes", description: "We cap at eighteen mats, always" },
            { title: "All levels welcome", description: "Every class notes who it suits" },
            { title: "Mats provided", description: "Turn up empty-handed if you like" },
          ]}
        />
      </section>

      <section id="classes" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <SectionHeader eyebrow="The timetable" title="This week's classes" description="Drop-ins welcome. Book ahead for the popular slots — Power Vinyasa fills first." />
          <PriceList
            className="mt-8"
            items={CLASSES}
            action={{
              label: "Book",
              onSelect: (r) => navigate({ to: "/book", search: { service: r.name } }),
            }}
          />
        </div>
      </section>

      <section id="teachers" className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeader eyebrow="Who teaches" title="Meet the teachers" description="Every class says who's leading it — come and find your favourite." />
        {teachers.isPending && (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-56 rounded-xl" />
            ))}
          </div>
        )}
        {teachers.isError && (
          <p className="mt-8 text-sm text-destructive">Couldn't load the teachers. Refresh and try again.</p>
        )}
        {teachers.data?.length === 0 && (
          <p className="mt-8 text-sm text-muted-foreground">Teacher profiles are on their way.</p>
        )}
        {!!teachers.data?.length && (
          <TeamGrid
            className="mt-8"
            items={teachers.data.map((t) => ({ name: t.name, role: t.bio, photo: t.photo_url }))}
          />
        )}
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <SectionHeader eyebrow="The work" title="Inside the studio" />
          <Gallery
            className="mt-8"
            columns={3}
            items={[
              { src: null, alt: "", fallbackSeed: "g1", caption: "Sunrise, Morning Flow" },
              { src: null, alt: "", fallbackSeed: "g2", caption: "Restorative, blankets out" },
              { src: null, alt: "", fallbackSeed: "g3", caption: "Candlelit Yin on a Thursday" },
            ]}
          />
          <div className="mt-6">
            <a href="/work" className="text-sm font-medium underline underline-offset-4">See the full gallery →</a>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeader eyebrow="Kind words" title="What students say" />
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          <Testimonial item={{ quote: "The only Power Vinyasa in town that doesn't skip the cool-down. I leave calm, not wired.", name: "Priya Sharma", role: "Tuesday regular" }} />
          <Testimonial item={{ quote: "I was terrified of my first Hatha class. Nobody made me feel behind.", name: "Tom Baxter", role: "Beginner, three months in" }} />
        </div>
      </section>

      <section id="find-us" className="border-y border-border bg-muted/40">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 sm:grid-cols-2">
          <div>
            <SectionHeader eyebrow="Find us" title="In the old print works" />
            <div className="mt-6 max-w-sm">
              <OpeningHours days={HOURS} />
            </div>
          </div>
          <LocationCard
            className="self-start"
            name="Aurora Yoga"
            address="9 Mill Yard, Bristol BS1 6QP"
            note="Up the stairs behind the coffee roaster. Bike racks in the yard, no car parking on site."
          />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <CtaBand title="Most classes have room this week" description="Pick a class and a time — it takes under a minute." action={{ label: "Book now", href: "/book" }} />
      </section>
    </SiteChrome>
  );
}
