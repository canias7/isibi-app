import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useRows, type Row } from "@/lib/rows";
import { SiteChrome } from "@/components/ui/site-chrome";
import { AvailabilityGrid } from "@/components/ui/availability-grid";
import { CtaBand } from "@/components/ui/cta-band";
import { LocationCard } from "@/components/ui/location-card";
import { OpenNow } from "@/components/ui/open-now";
import { OpeningHours, type DayHours } from "@/components/ui/opening-hours";
import { PriceList } from "@/components/ui/price-list";
import { SectionHeader } from "@/components/ui/section-header";
import { TeamGrid } from "@/components/ui/team-grid";
import { Testimonial } from "@/components/ui/testimonial";
import { TrustStrip } from "@/components/ui/trust-strip";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty } from "@/components/ui/empty";

export const Route = createFileRoute("/")({ component: Home });

type Teacher = Row & { name: string; bio: string | null; photo_url: string | null };

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A calm, well-lit studio — book your mat in a minute.",
  links: [
    { label: "Classes", href: "#classes" },
    { label: "Teachers", href: "#teachers" },
    { label: "Find us", href: "#find-us" },
    { label: "The studio", href: "/work" },
  ],
  action: { label: "Book now", href: "/book" },
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
  { name: "Sunrise Flow", description: "A gentle vinyasa to start the day", price: 14, meta: "60 min" },
  { name: "Power Vinyasa", description: "Strong, sweaty, set to music", price: 16, meta: "60 min" },
  { name: "Hatha Slow", description: "Held postures, deep breath work", price: 14, meta: "75 min" },
  , 
  { name: "Restorative", description: "Bolsters, blankets, long holds", price: 14, meta: "60 min" },
  { name: "Beginners' Foundations", description: "Six-week grounding in the basics", price: 12, meta: "45 min" },
];

function Home() {
  const teachers = useRows<Teacher>("teachers", { order: "name", dir: "asc" });
  const [slot, setSlot] = useState<string | null>(null);

  return (
    <SiteChrome {...CHROME}>
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid items-start gap-10 lg:grid-cols-[1.2fr_1fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Aurora Yoga</p>
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">Find your mat, this evening or this week</h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                Small classes, proper instruction, no mirrors. Check today's slots below or book straight in.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground motion-press" to="/book">Check availability</Link>
                <OpenNow hours={HOURS.map((h) => ({ day: h.day, open: h.open!, close: h.close! }))} />
              </div>
            </div>
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <SectionHeader eyebrow="Today" title="Today's slots" description="A held place for ten minutes while you finish booking." />
              <AvailabilityGrid
                className="mt-6"
                slots={["07:00", "09:00", "12:15", "17:30", "18:30", "19:30"]}
                taken={["09:00", "18:30"]}
                value={slot}
                onSelect={setSlot}
              />
              <p className="mt-4 text-sm text-muted-foreground">{slot ? `Holding ${slot} — pick your class on the booking page.` : "Tap a time to hold it."}</p>
              {slot && (
                <Link className="mt-2 inline-block text-sm font-medium underline underline-offset-4" to="/book">Continue to book {slot} →</Link>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <TrustStrip
          items={[
            { title: "Small classes", description: "Never more than fourteen mats" },
            { title: "All levels welcome", description: "Every class notes who it suits" },
            { title: "Book in a minute", description: "No account needed to reserve a mat" },
          ]}
        />
      </section>

      <section id="classes" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-4xl px-6 py-16">
          <SectionHeader eyebrow="The timetable" title="Classes and prices" description="Drop in for one, or ask about a class card at the desk." />
          <PriceList
            className="mt-8"
            items={CLASSES}
            action={{ label: "Book", onSelect: () => {} }}
          />
          <div className="mt-6 text-center">
            <Link className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground motion-press" to="/book">Book now</Link>
          </div>
        </div>
      </section>

      <section id="teachers" className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeader eyebrow="The teachers" title="Who you'll practise with" description="Every class lists its teacher when you book." />
        {teachers.isPending && <Skeleton className="mt-8 h-40 rounded-xl" />}
        {teachers.isError && (
          <p className="mt-8 text-sm text-destructive">Couldn't load the teachers. Refresh and try again.</p>
        )}
        {teachers.data?.length === 0 && (
          <Empty className="mt-8" title="No teachers listed yet" description="Check back soon — we're adding profiles." />
        )}
        {!!teachers.data?.length && (
          <TeamGrid
            className="mt-8"
            items={teachers.data.map((t) => ({
              name: t.name,
              role: t.bio,
              photo: t.photo_url,
              fallbackSeed: t.name,
            }))}
          />
        )}
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <SectionHeader eyebrow="Kind words" title="From the mats" />
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            <Testimonial item={{ quote: "The Sunrise Flow set me up for the whole day. Small class, proper attention.", name: "Priti Shah", role: "Tuesday regular" }} />
            <Testimonial item={{ quote: "Restorative on a Sunday is the best hour of my week.", name: "Callum Reeves", role: "Weekend student" }} />
          </div>
          <div className="mt-8 text-center">
            <Link className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground motion-press" to="/book">Book now</Link>
          </div>
        </div>
      </section>

      <section id="find-us" className="mx-auto grid max-w-6xl gap-10 px-6 py-16 sm:grid-cols-2">
        <div>
          <SectionHeader eyebrow="Find us" title="Opening hours" />
          <OpeningHours className="mt-6" days={HOURS} />
        </div>
        <LocationCard
          className="self-start"
          name="Aurora Yoga Studio"
          address="22 Meadow Lane, Bristol BS1 4QT"
          note="Above the cafe, up one flight. Bike racks out front, no car park."
        />
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <CtaBand title="Your mat is usually free today" description="Check availability and book in under a minute." action={{ label: "Book now", href: "/book" }} />
      </section>
    </SiteChrome>
  );
}
