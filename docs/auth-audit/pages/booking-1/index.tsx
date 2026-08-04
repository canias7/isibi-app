import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { useRows, usePublicRows, type Row } from "@/lib/rows";
import { SiteChrome } from "@/components/ui/site-chrome";
import { AvailabilityGrid } from "@/components/ui/availability-grid";
import { CtaBand } from "@/components/ui/cta-band";
import { LocationCard } from "@/components/ui/location-card";
import { OpenNow } from "@/components/ui/open-now";
import { OpeningHours, type DayHours } from "@/components/ui/opening-hours";
import { PriceList } from "@/components/ui/price-list";
import { SafeImage } from "@/components/ui/safe-image";
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
  tagline: "A calm room, a good mat, and a class that starts on time.",
  links: [
    { label: "Classes", href: "#prices" },
    { label: "Teachers", href: "#teachers" },
    { label: "The work", href: "#/work" },
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

const SLOTS = ["07:00", "08:15", "09:30", "12:00", "17:30", "18:45"];

function Home() {
  const [slot, setSlot] = useState<string | null>(null);
  const teachers = useRows<Teacher>("teachers", { order: "name", dir: "asc" });
  const today = new Date().toISOString().slice(0, 10);
  const taken = usePublicRows<{ slot_date: string; slot_time: string }>("bookings", { slot_date: today });

  return (
    <SiteChrome {...CHROME}>
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Aurora Yoga
              </p>
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">
                Aurora Yoga
              </h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                A small studio built for practice, not performance. Slow flows,
                strong holds, and a teacher who knows your name by the second class.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <a className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground motion-press" href="#/book">
                  Book now
                </a>
                <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium motion-press" href="#/work">
                  See the studio
                </a>
                <OpenNow hours={HOURS.map((h) => ({ day: h.day, open: h.open!, close: h.close! }))} />
              </div>
            </div>
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <p className="text-sm font-medium">Today's slots</p>
              {taken.isPending && <Skeleton className="mt-4 h-40 rounded-lg" />}
              {taken.isError && (
                <p className="mt-4 text-sm text-destructive">
                  Couldn't load today's availability. Try the booking page directly.
                </p>
              )}
              {!taken.isPending && !taken.isError && (
                <AvailabilityGrid
                  className="mt-4"
                  slots={SLOTS}
                  taken={taken.data?.map((t) => t.slot_time) ?? []}
                  value={slot}
                  onSelect={setSlot}
                />
              )}
              <p className="mt-4 text-sm text-muted-foreground">
                {slot ? `Holding ${slot} — finish up on the booking page.` : "Tap a time to hold it."}
              </p>
              {slot && (
                <a className="mt-2 inline-block text-sm font-medium underline underline-offset-4" href="#/book">
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
            { title: "Small classes", description: "Capped at fourteen, so you get seen" },
            { title: "Every level welcome", description: "First class free for anyone new" },
            { title: "Mats and blocks provided", description: "Turn up in what you're wearing" },
          ]}
        />
      </section>

      <section id="prices" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-4xl px-6 py-16">
          <SectionHeader
            eyebrow="The timetable"
            title="Classes and prices"
            description="Drop in, or bring your own mat and pay as you go — no membership required."
          />
          <PriceList
            className="mt-8"
            items={[
              { name: "Morning Flow", description: "Gentle vinyasa to start the day", price: 14, meta: "60 min" },
              { name: "Power Yoga", description: "Stronger pace, building heat", price: 16, meta: "60 min" },
              { name: "Restorative", description: "Slow, supported, mostly on the floor", price: 14, meta: "75 min" },
              { name: "Beginners' Foundations", description: "The postures, properly explained", price: 12, meta: "45 min" },
              { name: "Candlelit Yin", description: "Long holds, low light, Thursday evenings", price: 16, meta: "75 min" },
            ]}
            action={{ label: "Book", onSelect: (r) => { location.hash = `#/book?service=${encodeURIComponent(r.name)}`; } }}
          />
        </div>
      </section>

      <section id="teachers" className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeader
          eyebrow="Your teachers"
          title="Who's on the mat"
          description="Every teacher here trained for years before they taught a single class."
        />
        {teachers.isPending && <Skeleton className="mt-8 h-40 rounded-xl" />}
        {teachers.isError && (
          <p className="mt-8 text-sm text-destructive">Couldn't load the teachers. Refresh and try again.</p>
        )}
        {teachers.data?.length === 0 && (
          <Empty className="mt-8" title="Teachers coming soon" description="We're adding profiles for the studio's teachers shortly." />
        )}
        {!!teachers.data?.length && (
          <TeamGrid
            className="mt-8"
            items={teachers.data.map((t) => ({ name: t.name, role: t.bio ?? "", photo: t.photo_url ?? undefined }))}
          />
        )}
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <SectionHeader eyebrow="Kind words" title="From the mats" />
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            <Testimonial
              item={{
                quote: "I'd never done yoga before Foundations. Three months in and I actually look forward to Mondays.",
                name: "Priya Shah",
                role: "Beginners' Foundations",
              }}
            />
            <Testimonial
              item={{
                quote: "Candlelit Yin on a Thursday is the best hour of my week, no contest.",
                name: "Owen Tarrant",
                role: "Regular, two years",
              }}
            />
          </div>
        </div>
      </section>

      <section id="find-us" className="mx-auto grid max-w-6xl gap-10 px-6 py-16 sm:grid-cols-2">
        <div>
          <SectionHeader eyebrow="Find us" title="Above the greengrocer" />
          <div className="mt-6 max-w-sm">
            <OpeningHours days={HOURS} />
          </div>
        </div>
        <LocationCard
          className="self-start"
          name="Aurora Yoga"
          address="27 Mill Lane, Bristol BS6 5TF"
          note="Up the stairs beside Greenfield's. Leave shoes at the top."
        />
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <CtaBand
          title="There's usually a mat free this week"
          description="Book in thirty seconds — we'll email to confirm."
          action={{ label: "Book now", href: "#/book" }}
        />
      </section>
    </SiteChrome>
  );
}
