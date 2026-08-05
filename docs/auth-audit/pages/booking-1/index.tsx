import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { useRows, type Row } from "@/lib/rows";
import { AvailabilityGrid } from "@/components/ui/availability-grid";
import { CtaBand } from "@/components/ui/cta-band";
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
  tagline: "A calm, well-lit studio for every kind of practice.",
  links: [
    { label: "Classes", href: "#classes" },
    { label: "Teachers", href: "#teachers" },
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

const SLOTS = ["07:00", "08:15", "09:30", "12:00", "17:30", "18:45", "19:15"];

function Home() {
  const [slot, setSlot] = useState<string | null>(null);
  const teachers = useRows<Teacher>("teachers", { order: "name", dir: "asc" });

  return (
    <SiteChrome {...CHROME}>
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_1fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Aurora Yoga Studio
              </p>
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">
                Aurora Yoga
              </h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                Vinyasa, restorative and everything between, on mats warmed by morning
                light. Book a slot below or come find us on the mat.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <a
                  className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground motion-press"
                  href="#/book"
                >
                  Book now
                </a>
                <a
                  className="rounded-md border border-border px-5 py-2.5 text-sm font-medium motion-press"
                  href="#/work"
                >
                  See the studio
                </a>
                <OpenNow hours={HOURS.map((h) => ({ day: h.day, open: h.open!, close: h.close! }))} />
              </div>
            </div>
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <SectionHeader eyebrow="Today" title="Check today's availability" />
              <AvailabilityGrid
                className="mt-5"
                slots={SLOTS}
                taken={["08:15", "18:45"]}
                value={slot}
                onSelect={setSlot}
              />
              <p className="mt-4 text-sm text-muted-foreground">
                {slot ? `Holding ${slot} — finish up on the booking page.` : "Tap a time to hold it."}
              </p>
              {slot && (
                <a
                  className="mt-2 inline-block text-sm font-medium underline underline-offset-4"
                  href="#/book"
                >
                  Continue to book {slot} →
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <TrustStrip
          items={[
            { title: "Small class sizes", description: "Capped so teachers can actually adjust you" },
            { title: "Mats and props provided", description: "Turn up empty-handed" },
            { title: "Every level welcome", description: "First-timers to daily practitioners" },
          ]}
        />
      </section>

      <section id="classes" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-4xl px-6 py-16">
          <SectionHeader
            eyebrow="Classes"
            title="This week's timetable"
            description="Drop in to any class, or book ahead to guarantee your mat."
          />
          <PriceList
            className="mt-8"
            items={[
              { name: "Sunrise Vinyasa", description: "Flowing, breath-led, 7am start", price: 14, meta: "60 min" },
              { name: "Slow Flow", description: "Gentle pace, deep stretch", price: 12, meta: "50 min" },
              { name: "Restorative", description: "Long holds, blankets and bolsters", price: 14, meta: "60 min" },
              { name: "Power Yoga", description: "Strength-building, faster pace", price: 15, meta: "55 min" },
              { name: "Beginners' Foundations", description: "The basics, explained properly", price: 12, meta: "45 min" },
            ]}
            action={{ label: "Book", onSelect: () => { location.hash = "#/book"; } }}
          />
        </div>
      </section>

      <section id="teachers" className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeader
          eyebrow="Our teachers"
          title="Who you'll practise with"
          description="Every class is led by one of our resident teachers."
        />
        {teachers.isPending && <Skeleton className="mt-8 h-40 rounded-xl" />}
        {teachers.isError && (
          <p className="mt-8 text-sm text-destructive">Couldn't load our teachers. Refresh and try again.</p>
        )}
        {teachers.data?.length === 0 && (
          <p className="mt-8 text-sm text-muted-foreground">Teacher profiles are coming soon.</p>
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
          <SectionHeader eyebrow="Kind words" title="From our students" />
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            <Testimonial
              item={{
                quote: "The Slow Flow on Tuesdays fixed my desk-shoulders. I book it every week now.",
                name: "Nadia Sharpe",
                role: "Weekly regular",
              }}
            />
            <Testimonial
              item={{
                quote: "First class I'd ever done. Nobody made me feel like I was behind.",
                name: "Owen Price",
                role: "Beginners' Foundations",
              }}
            />
          </div>
        </div>
      </section>

      <section id="find-us" className="mx-auto grid max-w-6xl gap-10 px-6 py-16 sm:grid-cols-2">
        <div>
          <SectionHeader eyebrow="Find us" title="The studio" />
          <div className="mt-6 max-w-sm">
            <OpeningHours days={HOURS} />
          </div>
        </div>
        <LocationCard
          className="self-start"
          name="Aurora Yoga"
          address="18 Meadow Lane, Bristol BS1 6PN"
          note="Above the wholefood shop. Bike racks out front, no dedicated parking."
        />
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <CtaBand
          title="There's usually a mat free this week"
          description="Book in under a minute — we'll hold your spot."
          action={{ label: "Book now", href: "#/book" }}
        />
      </section>
    </SiteChrome>
  );
}
