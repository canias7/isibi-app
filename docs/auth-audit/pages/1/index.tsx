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
  tagline: "A quiet studio for a steady practice.",
  links: [
    { label: "Classes", href: "#classes" },
    { label: "Teachers", href: "#teachers" },
    { label: "Find us", href: "#find-us" },
    { label: "The work", href: "#/work" },
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
  { name: "Morning flow", description: "A steady vinyasa to open the day", price: 14, meta: "60 min" },
  { name: "Slow & stretch", description: "Long holds, gentle pace", price: 12, meta: "60 min" },
  { name: "Hot power", description: "Heated room, stronger sequence", price: 16, meta: "75 min" },
  { name: "Beginners' foundations", description: "For your first weeks on the mat", price: 10, meta: "45 min" },
  { name: "Restorative & breath", description: "Props, stillness, long exhale", price: 12, meta: "60 min" },
];

function Home() {
  const teachers = useRows<Teacher>("teachers", { order: "name", dir: "asc" });
  const navigate = useNavigate();
  const [slot, setSlot] = useState<string | null>(null);

  return (
    <SiteChrome {...CHROME}>
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Aurora Yoga
          </p>
          <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">
            A steadier practice, five classes a day
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Small rooms, real teachers, and a mat waiting whenever you check availability below.
          </p>
          <div className="mt-8 grid gap-8 lg:grid-cols-[1.35fr_1fr] lg:items-start">
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Today's classes</h2>
                <OpenNow
                  hours={HOURS.filter((h) => h.open && h.close).map((h) => ({
                    day: h.day,
                    open: h.open!,
                    close: h.close!,
                  }))}
                />
              </div>
              <AvailabilityGrid
                className="mt-5"
                slots={["07:00", "09:00", "11:00", "13:00", "17:30", "18:45", "20:00"]}
                taken={["09:00", "18:45"]}
                value={slot}
                onSelect={setSlot}
              />
              <p className="mt-4 text-sm text-muted-foreground">
                {slot ? `Holding ${slot} — pick a class on the booking page.` : "Tap a time to hold it."}
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <a
                  className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground motion-press"
                  href="#/book"
                >
                  Book now
                </a>
                <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="#/work">
                  See the studio
                </a>
              </div>
            </div>
            <TrustStrip
              items={[
                { title: "Small classes", description: "Capped so a teacher can actually see you" },
                { title: "All levels welcome", description: "Every class notes who it suits" },
                { title: "Mats provided", description: "Turn up empty-handed if you like" },
              ]}
            />
          </div>
        </div>
      </section>

      <section id="classes" className="mx-auto max-w-3xl px-6 py-16">
        <SectionHeader
          eyebrow="The timetable"
          title="Classes and prices"
          description="Drop into any class — no course commitment. First class is half price."
        />
        <PriceList
          className="mt-8"
          items={CLASSES}
          action={{
            label: "Book",
            onSelect: (r) => navigate({ to: "/book", search: { service: r.name } }),
          }}
        />
      </section>

      <section id="teachers" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <SectionHeader
            eyebrow="The teachers"
            title="Who you'll practise with"
            description="Every teacher trains here year-round — ask for whoever suits your pace."
          />
          {teachers.isPending && (
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-40 rounded-xl" />
              ))}
            </div>
          )}
          {teachers.isError && (
            <p className="mt-8 text-sm text-destructive">
              Couldn't load the teachers. Refresh and try again.
            </p>
          )}
          {teachers.data?.length === 0 && (
            <Empty
              className="mt-8"
              title="No teachers listed yet"
              description="Check back soon — the timetable is still filling in."
            />
          )}
          {!!teachers.data?.length && (
            <TeamGrid
              className="mt-8"
              items={teachers.data.map((t) => ({
                name: t.name,
                role: t.bio ?? undefined,
              }))}
            />
          )}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <SectionHeader eyebrow="Kind words" title="What the mats say" />
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          <Testimonial
            item={{
              quote:
                "I came in stiff from a desk job and left able to breathe again. Three months in, still going.",
              name: "Nadia Farrow",
              role: "Morning flow, twice a week",
            }}
          />
          <Testimonial
            item={{
              quote: "Beginners' foundations meant I actually understood what I was doing by week two.",
              name: "Joel Bratton",
              role: "Started this spring",
            }}
          />
        </div>
      </section>

      <section id="find-us" className="border-y border-border bg-muted/40">
        <div className="mx-auto grid max-w-5xl gap-10 px-6 py-16 sm:grid-cols-2">
          <div>
            <SectionHeader eyebrow="Find us" title="On the ground floor" />
            <OpeningHours days={HOURS} className="mt-6" />
          </div>
          <LocationCard
            className="self-start"
            name="Aurora Yoga"
            address="22 Bellhouse Lane, Bristol BS6 5RT"
            note="Street parking after 6pm; the 44 bus stops opposite."
          />
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <CtaBand
          title="There's usually a mat free today"
          description="Check availability and book in under a minute."
          action={{ label: "Book now", href: "#/book" }}
        />
      </section>
    </SiteChrome>
  );
}
