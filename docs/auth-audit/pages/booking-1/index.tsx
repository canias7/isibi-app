import { createFileRoute, Link } from "@tanstack/react-router";
import { useRows, type Row } from "@/lib/rows";
import { SiteChrome } from "@/components/ui/site-chrome";
import { OpenNow } from "@/components/ui/open-now";
import { OpeningHours, type DayHours } from "@/components/ui/opening-hours";
import { LocationCard } from "@/components/ui/location-card";
import { PriceList } from "@/components/ui/price-list";
import { SectionHeader } from "@/components/ui/section-header";
import { TeamGrid } from "@/components/ui/team-grid";
import { TrustStrip } from "@/components/ui/trust-strip";
import { CtaBand } from "@/components/ui/cta-band";
import { Testimonial } from "@/components/ui/testimonial";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty } from "@/components/ui/empty";

export const Route = createFileRoute("/")({ component: Home });

type Teacher = Row & { name: string; bio: string | null; photo_url: string | null };

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A calm, well-lit studio for every level of practice.",
  links: [
    { label: "Classes", href: "#classes" },
    { label: "Teachers", href: "#teachers" },
    { label: "The studio", href: "#/work" },
    { label: "Find us", href: "#find-us" },
  ],
  action: { label: "Book now", href: "#/book" },
};

const HOURS: DayHours[] = [
  { day: 1, label: "Monday", open: "07:00", close: "20:30" },
  { day: 2, label: "Tuesday", open: "07:00", close: "20:30" },
  { day: 3, label: "Wednesday", open: "07:00", close: "20:30" },
  { day: 4, label: "Thursday", open: "07:00", close: "20:30" },
  { day: 5, label: "Friday", open: "07:00", close: "19:00" },
  { day: 6, label: "Saturday", open: "08:30", close: "14:00" },
  { day: 0, label: "Sunday", open: "09:00", close: "13:00" },
];

const CLASSES = [
  { name: "Morning Flow", description: "Vinyasa to wake the body, all levels", price: 16, meta: "60 min" },
  { name: "Slow & Restorative", description: "Long holds, blocks and bolsters", price: 16, meta: "60 min" },
  { name: "Power Hour", description: "A stronger, faster practice", price: 18, meta: "60 min" },
  { name: "Beginners' Foundations", description: "The postures, properly explained", price: 14, meta: "45 min" },
  { name: "Candlelit Yin", description: "Deep stretch, low light, Friday evenings", price: 16, meta: "75 min" },
  { name: "Drop-in class card", description: "Ten classes, use across any style", price: 120, meta: "10 classes" },
];

function Home() {
  const teachers = useRows<Teacher>("teachers", { order: "name", dir: "asc" });

  return (
    <SiteChrome {...CHROME}>
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Aurora Yoga</p>
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">A calm room, a good teacher, every day of the week</h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                Vinyasa, restorative and beginners' classes on a timetable that actually runs on time. Check what's on today and book your mat.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <a className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground motion-press" href="#/book">Check availability</a>
                <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="#classes">See the timetable</a>
                <OpenNow hours={HOURS.map((h) => ({ day: h.day, open: h.open!, close: h.close! }))} />
              </div>
            </div>
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <SectionHeader eyebrow="Today" title="Ready to book" description="Pick a class on the booking page — we hold your mat once you confirm." />
              <a href="#/book" className="mt-6 inline-block rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground motion-press">Book now</a>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <TrustStrip items={[
          { title: "Small classes", description: "Capped so the teacher actually sees you" },
          { title: "All levels welcome", description: "Every class notes who it suits" },
          { title: "Mats provided", description: "Just bring yourself" },
        ]} />
      </section>

      <section id="classes" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <SectionHeader eyebrow="The timetable" title="Classes and class cards" description="Drop in to a single class, or buy a card for less per session." />
          <PriceList className="mt-8" items={CLASSES} action={{ label: "Book", onSelect: (r) => { location.hash = `#/book?service=${encodeURIComponent(r.name)}`; } }} />
        </div>
      </section>

      <section id="teachers" className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeader eyebrow="The teachers" title="Who you'll practise with" description="Every class is led by one of our qualified teachers below." />
        {teachers.isPending && <Skeleton className="mt-8 h-48 rounded-xl" />}
        {teachers.isError && <p className="mt-8 text-sm text-destructive">Couldn't load the teachers. Refresh and try again.</p>}
        {teachers.data?.length === 0 && (
          <div className="mt-8"><Empty title="No teachers listed yet" description="Check back soon — our teacher profiles are on their way." /></div>
        )}
        {!!teachers.data?.length && (
          <TeamGrid className="mt-8" items={teachers.data.map((t) => ({ name: t.name, role: t.bio ?? undefined, image: t.photo_url ?? undefined }))} />
        )}
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <SectionHeader eyebrow="Kind words" title="From our students" />
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            <Testimonial item={{ quote: "The Slow & Restorative class on a Wednesday evening has become the best part of my week.", name: "Priya Anand", role: "Weekly regular" }} />
            <Testimonial item={{ quote: "I'd never done yoga before Foundations. Patient, clear, no judgement.", name: "Tom Aitken", role: "Beginner, three months in" }} />
          </div>
        </div>
      </section>

      <section id="find-us" className="mx-auto grid max-w-6xl gap-10 px-6 py-16 sm:grid-cols-2">
        <div>
          <SectionHeader eyebrow="Find us" title="In the studio" />
          <div className="mt-6 max-w-sm"><OpeningHours days={HOURS} /></div>
        </div>
        <LocationCard className="self-start" name="Aurora Yoga" address="18 Meadow Lane, Bristol BS6 5TF" note="Above the health food shop; the studio entrance is round the side, up one flight of stairs." />
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <CtaBand title="Your mat is waiting" description="See what's on today and book in under a minute." action={{ label: "Book now", href: "#/book" }} />
      </section>
    </SiteChrome>
  );
}
