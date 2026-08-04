import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { useRows, type Row } from "@/lib/rows";
import { AvailabilityGrid } from "@/components/ui/availability-grid";
import { CtaBand } from "@/components/ui/cta-band";
import { LocationCard } from "@/components/ui/location-card";
import { OpenNow } from "@/components/ui/open-now";
import { OpeningHours, type DayHours } from "@/components/ui/opening-hours";
import { PriceList } from "@/components/ui/price-list";
import { SectionHeader } from "@/components/ui/section-header";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Skeleton } from "@/components/ui/skeleton";
import { TeamGrid } from "@/components/ui/team-grid";
import { Testimonial } from "@/components/ui/testimonial";
import { TrustStrip } from "@/components/ui/trust-strip";
import { Empty } from "@/components/ui/empty";

export const Route = createFileRoute("/")({ component: Home });

type Teacher = Row & { name: string; bio: string | null; phone: string | null };

const CHROME = {
  name: "Aurora Yoga",
  tagline: "Slow mornings, steady evenings — a mat and a class most days.",
  links: [
    { label: "Today's classes", href: "#today" },
    { label: "Prices", href: "#prices" },
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
  { day: 6, label: "Saturday", open: "08:30", close: "13:00" },
  { day: 0, label: "Sunday", open: "09:00", close: "12:30" },
];

const CLASSES = [
  { name: "Sunrise Flow", price: 14, description: "A gentle vinyasa to open the day", meta: "60 min" },
  { name: "Hatha Fundamentals", price: 14, description: "Slow, held postures — good for a first class", meta: "60 min" },
  { name: "Power Vinyasa", price: 16, description: "A stronger, faster class for the regulars", meta: "75 min" },
  { name: "Restorative & Yin", price: 15, description: "Long holds, blankets and bolsters", meta: "75 min" },
  { name: "Candlelit Slow Flow", price: 15, description: "Our Friday evening wind-down", meta: "60 min" },
];

function Home() {
  const teachers = useRows<Teacher>("teachers", { order: "name", dir: "asc" });
  const navigate = useNavigate();
  const [slot, setSlot] = useState<string | null>(null);

  return (
    <SiteChrome {...CHROME}>
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Studio classes, every day
              </p>
    <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">Aurora Yoga</h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                A small studio with a full timetable — five classes a day, mats and blocks
                provided, and a teacher who knows your name by your third visit.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <a className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" href="#/book">
                  Book now
                </a>
                <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="#/work">
                  See the studio
                </a>
                <OpenNow hours={HOURS.map((h) => ({ day: h.day, open: h.open!, close: h.close! }))} />
              </div>
            </div>
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <AvailabilityGrid
                slots={["07:00", "09:00", "12:00", "17:30", "18:45", "19:30"]}
                taken={["09:00", "18:45"]}
                value={slot}
                onSelect={setSlot}
              />
              <p className="mt-4 text-sm text-muted-foreground">
                {slot ? `Holding ${slot} — pick a class on the booking page.` : "Tap a time to hold it."}
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

      <section id="today" className="mx-auto max-w-6xl px-6 py-10">
        <TrustStrip
          items={[
            { title: "Five classes a day", description: "Morning, midday and evening slots" },
            { title: "Mats provided", description: "Arrive empty-handed if you need to" },
            { title: "No membership required", description: "Pay per class, book when it suits" },
          ]}
        />
      </section>

      <section id="prices" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <SectionHeader
            eyebrow="The timetable"
            title="Classes and prices"
            description="Book any class below — the form arrives already knowing which one."
          />
          <PriceList
            className="mt-8"
            items={CLASSES}
            action={{
              label: "Book",
              onSelect: (c) => navigate({ to: "/book", search: { service: c.name } }),
            }}
          />
        </div>
      </section>

      <section id="teachers" className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeader
          eyebrow="The teachers"
          title="Who's leading class"
          description="Every teacher here trained for at least two years before taking a room."
        />
        {teachers.isPending && (
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </div>
        )}
        {teachers.isError && (
          <p className="mt-8 text-sm text-destructive">Couldn't load the teachers. Refresh and try again.</p>
        )}
        {teachers.data?.length === 0 && (
          <Empty className="mt-8" title="No teachers listed yet" description="Check back soon — our roster is being added." />
        )}
        {!!teachers.data?.length && (
          <TeamGrid
            className="mt-8"
            items={teachers.data.map((t) => ({ name: t.name, role: t.bio ?? undefined }))}
          />
        )}
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <SectionHeader eyebrow="Kind words" title="From the mats" />
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            <Testimonial
              item={{
                quote:
                  "I'd never done yoga before Sunrise Flow. Three months later it's the best part of my week.",
                name: "Priya Shah",
                role: "Tuesday mornings",
              }}
            />
            <Testimonial
              item={{
                quote: "Restorative on a Sunday evening is the reset I didn't know I needed.",
                name: "Tom Blackwell",
                role: "Sunday regular",
              }}
            />
          </div>
        </div>
      </section>

      <section id="find-us" className="mx-auto grid max-w-6xl gap-10 px-6 py-16 sm:grid-cols-2">
        <div>
          <SectionHeader eyebrow="Find us" title="In the old print works" />
          <div className="mt-6 max-w-sm">
            <OpeningHours days={HOURS} />
          </div>
        </div>
        <LocationCard
          className="self-start"
          name="Aurora Yoga"
          address="9 Foundry Lane, Bristol BS1 6JT"
          note="Up the stairs beside the coffee roastery. Bike racks out front, no car park."
        />
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <CtaBand
          title="There's usually a class within the hour"
          description="Book in thirty seconds — we'll hold your spot."
          action={{ label: "Book now", href: "#/book" }}
        />
      </section>
    </SiteChrome>
  );
}
