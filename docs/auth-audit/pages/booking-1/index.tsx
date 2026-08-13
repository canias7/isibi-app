import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRows, type Row } from "@/lib/rows";
import { SiteChrome } from "@/components/ui/site-chrome";
import { AvailabilityGrid } from "@/components/ui/availability-grid";
import { CtaBand } from "@/components/ui/cta-band";
import { OpenNow } from "@/components/ui/open-now";
import { OpeningHours, type DayHours } from "@/components/ui/opening-hours";
import { PriceList } from "@/components/ui/price-list";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { StatsBand } from "@/components/ui/stats-band";
import { TeamGrid } from "@/components/ui/team-grid";
import { Testimonial } from "@/components/ui/testimonial";
import { TrustStrip } from "@/components/ui/trust-strip";
import { LocationCard } from "@/components/ui/location-card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/")({ component: Home });

type Teacher = Row & { name: string; bio: string | null; photo_url: string | null };

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A calm, well-lit studio — five classes a day, every level welcome.",
  links: [
    { label: "Classes", href: "#classes" },
    { label: "Teachers", href: "#teachers" },
    { label: "Find us", href: "#find-us" },
    { label: "The work", href: "/work" },
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

function Home() {
  const navigate = useNavigate();
  const [slot, setSlot] = useState<string | null>(null);
  const teachers = useRows<Teacher>("teachers", { order: "name", dir: "asc" });

  return (
    <SiteChrome {...CHROME}>
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">A studio, not a gym floor</p>
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">Aurora Yoga</h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                Five classes a day, mats and blocks provided, and a teacher who remembers your name by your second visit.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <a className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground motion-press" href="/book">Book now</a>
                <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium motion-press" href="/work">See the studio</a>
                <OpenNow hours={HOURS.map((h) => ({ day: h.day, open: h.open!, close: h.close! }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <SafeImage src={null} alt="" ratio="1/1" fallbackSeed="a" />
              <SafeImage src={null} alt="" ratio="1/1" fallbackSeed="b" />
              <SafeImage src={null} alt="" ratio="1/1" fallbackSeed="c" />
              <SafeImage src={null} alt="" ratio="1/1" fallbackSeed="d" />
            </div>
          </div>
          <div className="mt-14 border-t border-border pt-10">
            <StatsBand items={[
              { value: "5", label: "Classes a day, most levels" },
              { value: "4.9", label: "Average rating from students" },
              { value: "60", label: "Minutes, most sessions" },
              { value: "£14", label: "A single drop-in class" },
            ]} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <TrustStrip items={[
          { title: "Small classes", description: "Capped so the teacher can actually adjust you" },
          { title: "All levels", description: "Never done yoga? Come to a beginners slot" },
          { title: "Mats provided", description: "Turn up in whatever you can move in" },
        ]} />
      </section>

      <section id="classes" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <SectionHeader eyebrow="Today" title="Today's slots" description="Pick a time — we hold it for ten minutes while you finish booking." />
          <div className="mt-8 grid gap-8 lg:grid-cols-[1.35fr_1fr]">
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <AvailabilityGrid
                slots={["07:00", "08:15", "09:30", "12:00", "17:30", "18:45", "20:00"]}
                taken={["08:15", "18:45"]}
                value={slot}
                onSelect={setSlot}
              />
              <p className="mt-4 text-sm text-muted-foreground">{slot ? `Holding ${slot} — finish up on the booking page.` : "Tap a time to hold it."}</p>
              {slot && (
                <a className="mt-2 inline-block text-sm font-medium underline underline-offset-4" href={`/book?time=${encodeURIComponent(slot)}`}>
                  Continue to book {slot} →
                </a>
              )}
            </div>
            <SafeImage src={null} alt="" ratio="4/3" fallbackSeed="studio-floor" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeader eyebrow="The classes" title="What's on" description="Drop in to any single class, or book a run of them once you know what suits you." />
        <PriceList
          className="mt-8"
          items={[
            { name: "Beginners Flow", description: "Slow, plenty of explaining, no jumping", price: 14, meta: "60 min" },
            { name: "Vinyasa", description: "A moving, breath-led practice", price: 16, meta: "60 min" },
            { name: "Restorative", description: "Long holds, blankets and blocks", price: 14, meta: "75 min" },
            { name: "Hatha", description: "Steady postures, held and repeated", price: 15, meta: "60 min" },
            { name: "Candlelit Yin", description: "Friday evenings, low light, deep stretch", price: 16, meta: "75 min" },
          ]}
          action={{ label: "Book", onSelect: (r) => navigate({ to: "/book", search: { class: r.name } }) }}
        />
      </section>

      <section id="teachers" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <SectionHeader eyebrow="Who teaches" title="Meet the teachers" description="Ask for whoever suits your pace — it's fine to try a few before you settle." />
          {teachers.isPending && <Skeleton className="mt-8 h-40 rounded-xl" />}
          {teachers.isError && <p className="mt-8 text-sm text-destructive">Couldn't load the teachers. Refresh and try again.</p>}
          {teachers.data?.length === 0 && <p className="mt-8 text-sm text-muted-foreground">Teacher profiles are coming soon.</p>}
          {!!teachers.data?.length && (
            <TeamGrid
              className="mt-8"
              items={teachers.data.map((t) => ({ name: t.name, role: t.bio, photo: t.photo_url, fallbackSeed: t.name }))}
            />
          )}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeader eyebrow="Kind words" title="From the mats" />
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          <Testimonial item={{ quote: "First class I've ever finished feeling calmer than when I walked in. The teacher noticed I was struggling and just quietly fixed my alignment.", name: "Nadia Ferris", role: "Beginners Flow, twice a week" }} />
          <Testimonial item={{ quote: "The Friday candlelit class is the best hour of my week, genuinely.", name: "Owen Baptiste", role: "Yin regular" }} />
        </div>
      </section>

      <section id="find-us" className="mx-auto grid max-w-6xl gap-10 px-6 py-16 sm:grid-cols-2">
        <div>
          <SectionHeader eyebrow="Find us" title="The studio" />
          <div className="mt-6 max-w-sm"><OpeningHours days={HOURS} /></div>
        </div>
        <LocationCard className="self-start" name="Aurora Yoga" address="12 Meadowbank Lane, Bristol BS6 5RT" note="Up the stairs above the bakery. Bike racks out front; no parking on the lane itself." />
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <CtaBand title="There's usually a mat free this week" description="Book in thirty seconds — we confirm by email." action={{ label: "Book now", href: "/book" }} />
      </section>
    </SiteChrome>
  );
}
