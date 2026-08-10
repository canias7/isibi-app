import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

import { useRows, type Row } from "@/lib/rows";
import { SiteChrome } from "@/components/ui/site-chrome";
import { AvailabilityGrid } from "@/components/ui/availability-grid";
import { CtaBand } from "@/components/ui/cta-band";
import { LocationCard } from "@/components/ui/location-card";
import { OpenNow } from "@/components/ui/open-now";
import { OpeningHours, type DayHours } from "@/components/ui/opening-hours";
import { PriceList } from "@/components/ui/price-list";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { StatsBand } from "@/components/ui/stats-band";
import { TeamGrid } from "@/components/ui/team-grid";
import { Testimonial } from "@/components/ui/testimonial";
import { TrustStrip } from "@/components/ui/trust-strip";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/")({ component: Home });

type Teacher = Row & { name: string; bio: string | null; photo_url: string | null };

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A studio in the city centre, breathing room every hour.",
  links: [
    { label: "Classes", href: "#classes" },
    { label: "Teachers", href: "#teachers" },
    { label: "The work", href: "/work" },
    { label: "Find us", href: "#find-us" },
  ],
  action: { label: "Book now", href: "/book" },
};

const HOURS: DayHours[] = [
  { day: 1, label: "Monday", open: "07:00", close: "21:00" },
  { day: 2, label: "Tuesday", open: "07:00", close: "21:00" },
  { day: 3, label: "Wednesday", open: "07:00", close: "21:00" },
  { day: 4, label: "Thursday", open: "07:00", close: "21:00" },
  { day: 5, label: "Friday", open: "07:00", close: "20:00" },
  { day: 6, label: "Saturday", open: "08:30", close: "16:00" },
  { day: 0, label: "Sunday", open: "09:00", close: "14:00" },
];

const PRICES = [
  { name: "Drop-in class", description: "Any class on the timetable, one visit", price: 16, meta: "60 min" },
  { name: "5-class pack", description: "Use across any style, valid 8 weeks", price: 70, meta: "save £10" },
  { name: "Unlimited monthly", description: "As many classes as you can fit in", price: 85, meta: "per month" },
  { name: "First class", description: "New to the studio? Your first visit is on us", price: 0, meta: "one-time" },
];

const CLASSES = [
  { time: "07:00", title: "Sunrise Vinyasa", teacher: "Ines" },
  { time: "09:30", title: "Slow Flow & Breath", teacher: "Priya" },
  { time: "12:15", title: "Lunchtime Hatha", teacher: "Marcus" },
  { time: "17:30", title: "Power Vinyasa", teacher: "Ines" },
  { time: "19:00", title: "Restorative & Yin", teacher: "Priya" },
];

function Home() {
  const navigate = useNavigate();
  const teachers = useRows<Teacher>("teachers", { order: "name", dir: "asc" });
  const [slot, setSlot] = useState<string | null>(null);

  return (
    <SiteChrome {...CHROME}>
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Aurora Yoga · Studio</p>
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">Aurora Yoga</h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                Vinyasa, Hatha and Yin classes running from early morning to evening. Mats are provided — just bring yourself.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground motion-press" to="/book">Book now</Link>
                <Link className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" to="/work">See the studio</Link>
                <OpenNow hours={HOURS.map((h) => ({ day: h.day, open: h.open!, close: h.close! }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <SafeImage src={null} alt="" ratio="1/1" fallbackSeed="studio-1" />
              <SafeImage src={null} alt="" ratio="1/1" fallbackSeed="studio-2" />
              <SafeImage src={null} alt="" ratio="1/1" fallbackSeed="studio-3" />
              <SafeImage src={null} alt="" ratio="1/1" fallbackSeed="studio-4" />
            </div>
          </div>
          <div className="mt-14 border-t border-border pt-10">
            <StatsBand items={[
              { value: "20+", label: "Classes a week, across styles" },
              { value: "4.9", label: "Average rating from members" },
              { value: "5", label: "Teachers, each with their own focus" },
              { value: "1st", label: "Class free for new members" },
            ]} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <TrustStrip items={[
          { title: "Mats provided", description: "Bring water, we'll sort the rest" },
          { title: "All levels welcome", description: "Every class states its pace up front" },
          { title: "Book in seconds", description: "No account needed to reserve a slot" },
        ]} />
      </section>

      <section id="classes" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <SectionHeader eyebrow="Today" title="Today's classes" description="Pick a class time to hold your mat, then finish on the booking page." />
          <div className="mt-8 grid gap-8 lg:grid-cols-[1.35fr_1fr]">
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <ul className="mb-6 divide-y divide-border motion-stagger">
                {CLASSES.map((c) => (
                  <li key={c.time} className="flex items-center justify-between py-2 text-sm">
                    <span className="font-medium">{c.time} · {c.title}</span>
                    <span className="text-muted-foreground">with {c.teacher}</span>
                  </li>
                ))}
              </ul>
              <AvailabilityGrid
                slots={CLASSES.map((c) => c.time)}
                taken={[]}
                value={slot}
                onSelect={setSlot}
              />
              <p className="mt-4 text-sm text-muted-foreground">
                {slot ? `Holding ${slot} — finish on the booking page.` : "Tap a time to hold it."}
              </p>
              {slot && (
                <Link className="mt-2 inline-block text-sm font-medium underline underline-offset-4" to="/book" search={{ time: slot }}>
                  Continue to book {slot} →
                </Link>
              )}
            </div>
            <SafeImage src={null} alt="" ratio="4/3" fallbackSeed="class-hero" />
          </div>
        </div>
      </section>

      <section id="prices" className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeader eyebrow="Pricing" title="Ways to join" description="Drop in whenever, or save with a pack — cancel anytime." />
        <PriceList
          className="mt-8"
          items={PRICES}
          action={{ label: "Book", onSelect: () => navigate({ to: "/book" }) }}
        />
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <SectionHeader eyebrow="The studio" title="A look inside" />
            <Link className="text-sm font-medium underline underline-offset-4" to="/work">The whole gallery →</Link>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <SafeImage src={null} alt="" ratio="4/3" fallbackSeed="peek-1" />
            <SafeImage src={null} alt="" ratio="4/3" fallbackSeed="peek-2" />
            <SafeImage src={null} alt="" ratio="4/3" fallbackSeed="peek-3" />
          </div>
        </div>
      </section>

      <section id="teachers" className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeader eyebrow="Who's teaching" title="Our teachers" description="Every class states who's leading it and what pace to expect." />
        {teachers.isPending && <Skeleton className="mt-8 h-40 rounded-xl" />}
        {teachers.isError && (
          <p className="mt-8 text-sm text-destructive">Couldn't load the teachers. Refresh and try again.</p>
        )}
        {teachers.data?.length === 0 && (
          <p className="mt-8 text-sm text-muted-foreground">Teacher profiles are coming soon.</p>
        )}
        {!!teachers.data?.length && (
          <TeamGrid
            className="mt-8"
            items={teachers.data.map((t) => ({ name: t.name, role: t.bio, photo: t.photo_url, fallbackSeed: t.name }))}
          />
        )}
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <SectionHeader eyebrow="Kind words" title="From our members" />
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            <Testimonial item={{ quote: "The 7am Vinyasa is my whole week's anchor. Never rushed, always full but never crowded.", name: "Odette Marsh", role: "Member since 2022" }} />
            <Testimonial item={{ quote: "Booked my first class not knowing a single pose. Left knowing exactly what to do next time.", name: "Callum Reyes", role: "New member" }} />
          </div>
        </div>
      </section>

      <section id="find-us" className="mx-auto grid max-w-6xl gap-10 px-6 py-16 sm:grid-cols-2">
        <div>
          <SectionHeader eyebrow="Find us" title="In the city centre" />
          <div className="mt-6 max-w-sm"><OpeningHours days={HOURS} /></div>
        </div>
        <LocationCard
          className="self-start"
          name="Aurora Yoga"
          address="18 Willow Court, Manchester M1 4EQ"
          note="Above the health food shop. Bike racks out front; no on-site parking."
        />
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <CtaBand title="There's usually a mat free today" description="Book in thirty seconds — we confirm by email." action={{ label: "Book now", href: "/book" }} />
      </section>
    </SiteChrome>
  );
}
