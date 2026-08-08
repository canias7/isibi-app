import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useRows, type Row } from "@/lib/rows";
import { SiteChrome } from "@/components/ui/site-chrome";
import { AvailabilityGrid } from "@/components/ui/availability-grid";
import { CtaBand } from "@/components/ui/cta-band";
import { Gallery } from "@/components/ui/gallery";
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

export const Route = createFileRoute("/")({ component: P });

type Teacher = Row & { name: string; bio: string | null; photo_url: string | null };

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A quiet studio for a steady practice.",
  links: [
    { label: "Classes", href: "#classes" },
    { label: "The work", href: "/work" },
    { label: "Teachers", href: "#teachers" },
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
  { day: 6, label: "Saturday", open: "08:30", close: "13:00" },
  { day: 0, label: "Sunday", open: "09:00", close: "12:00" },
];

function P() {
  const [slot, setSlot] = useState<string | null>(null);
  const teachers = useRows<Teacher>("teachers", { order: "name", dir: "asc" });

  return (
    <SiteChrome {...CHROME}>
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">A studio, not a gym</p>
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">Aurora Yoga</h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                Small classes, proper attention, a mat waiting warm. Book a class in under a minute.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground motion-press" to="/book">Book now</Link>
                <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="#classes">See today's classes</a>
                <OpenNow hours={HOURS.map((h) => ({ day: h.day, open: h.open!, close: h.close! }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <SafeImage src={null} alt="" ratio="1/1" fallbackSeed="aurora-1" />
              <SafeImage src={null} alt="" ratio="1/1" fallbackSeed="aurora-2" />
              <SafeImage src={null} alt="" ratio="1/1" fallbackSeed="aurora-3" />
              <SafeImage src={null} alt="" ratio="1/1" fallbackSeed="aurora-4" />
            </div>
          </div>
          <div className="mt-14 border-t border-border pt-10">
            <StatsBand items={[
              { value: "12", label: "Classes a week, morning and evening" },
              { value: "14", label: "Mats, so it never feels crowded" },
              { value: "4.9", label: "Average class rating" },
              { value: "6 yrs", label: "On the same corner" },
            ]} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <TrustStrip items={[
          { title: "Small classes", description: "Never more than fourteen on a mat" },
          { title: "All levels welcome", description: "Every class notes who it suits" },
          { title: "Mats and blocks provided", description: "Turn up as you are" },
        ]} />
      </section>

      <section id="classes" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <SectionHeader eyebrow="Today" title="Today's classes" description="Pick a time; we hold your spot for ten minutes while you finish booking." />
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
                <Link className="mt-2 inline-block text-sm font-medium underline underline-offset-4" to="/book">
                  Continue to book {slot} →
                </Link>
              )}
            </div>
            <SafeImage src={null} alt="" ratio="4/3" fallbackSeed="aurora-studio" />
          </div>
        </div>
      </section>

      <section id="prices" className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeader eyebrow="Classes" title="What's on" description="Drop in to any class — no membership needed to start." />
        <PriceList
          className="mt-8"
          items={[
            { name: "Morning Flow", description: "A steady vinyasa to start the day", price: 14, meta: "60 min" },
            { name: "Slow & Restorative", description: "Long holds, blankets and blocks", price: 14, meta: "60 min" },
{ name: "Beginners' Yoga", description: "No experience needed — just breath and basics", price: 12, meta: "50 min" },
{ name: "Evening Wind Down", description: "Gentle stretch after a long day", price: 14, meta: "55 min" },
{ name: "Strength & Balance", description: "A firmer, more physical class", price: 16, meta: "60 min" },
          ]}
          action={{ label: "Book", onSelect: (r) => { window.location.href = `/book?service=${encodeURIComponent(r.name)}`; } }}
        />
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <SectionHeader eyebrow="The studio" title="A look inside" />
            <Link className="text-sm font-medium underline underline-offset-4" to="/work">The whole gallery →</Link>
          </div>
          <Gallery className="mt-8" columns={3} items={[
            { src: null, alt: "", fallbackSeed: "g1", caption: "Morning Flow, first light through the blinds" } as any,
            { src: null, alt: "", fallbackSeed: "g2", caption: "Blocks and blankets set out for Restorative" } as any,
            { src: null, alt: "", fallbackSeed: "g3", caption: "The studio empty before opening" } as any,
          ]} />
        </div>
      </section>

      <section id="teachers" className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeader eyebrow="Who teaches" title="Meet the teachers" description="Every class is led by one of these four; the timetable says who." />
        {teachers.isPending && <Skeleton className="mt-8 h-40 rounded-xl" />}
        {teachers.isError && <p className="mt-8 text-sm text-destructive">Couldn't load the teachers. Refresh and try again.</p>}
        {teachers.data?.length === 0 && <p className="mt-8 text-sm text-muted-foreground">Teacher profiles are coming soon.</p>}
        {!!teachers.data?.length && (
          <TeamGrid
            className="mt-8"
            items={teachers.data.map((t) => ({ name: t.name, role: t.bio, photo: t.photo_url }))}
          />
        )}
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <SectionHeader eyebrow="Kind words" title="From the mats" />
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            <Testimonial item={{ quote: "I came for a beginners' class terrified and left wanting to book the next one. No judgement at all.", name: "Nadia Farrow", role: "Beginners' Yoga" }} />
            <Testimonial item={{ quote: "The Sunday slow class is the best hour of my week.", name: "Rhys Bevan", role: "Slow & Restorative, weekly" }} />
          </div>
        </div>
      </section>

      <section id="find-us" className="mx-auto grid max-w-6xl gap-10 px-6 py-16 sm:grid-cols-2">
        <div>
          <SectionHeader eyebrow="Find us" title="Where we are" />
          <div className="mt-6 max-w-sm"><OpeningHours days={HOURS} /></div>
        </div>
        <LocationCard className="self-start" name="Aurora Yoga" address="18 Millbrook Lane, Bristol BS6 5TF" note="Above the deli, entrance round the side. Bike racks out front." />
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <CtaBand title="A mat is usually free today" description="Book in under a minute — we'll confirm by email." action={{ label: "Book now", href: "/book" }} />
      </section>
    </SiteChrome>
  );
}
