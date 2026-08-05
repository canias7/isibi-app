import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

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
  tagline: "Slow mornings, strong evenings — a studio on the high street.",
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
  { name: "Sunrise Flow", description: "A gentle vinyasa to wake the body before work", price: 14, meta: "60 min" },
  { name: "Hatha Fundamentals", description: "Slow, held postures — good for a first class", price: 14, meta: "60 min" },
  { name: "Power Vinyasa", description: "Fast-paced and sweaty, for the already-flexible", price: 16, meta: "75 min" },
  { name: "Restorative & Yin", description: "Long holds, blankets and blocks, low light", price: 14, meta: "60 min" },
  { name: "Evening Wind-Down", description: "Breathwork and stretch to close the day", price: 12, meta: "45 min" },
];

function Home() {
  const [slot, setSlot] = useState<string | null>(null);
  const teachers = useRows<Teacher>("teachers", { order: "name", dir: "asc" });
  const navigate = useNavigate();

  return (
    <SiteChrome {...CHROME}>
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                A studio on the high street
              </p>
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">Aurora Yoga</h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                Five classes a day, small rooms, teachers who remember your name. Pick a
                slot below and we'll hold your mat.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <a
                  className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground motion-press"
                  href="#/book"
                >
                  Book now
                </a>
                <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="#classes">
                  See the timetable
                </a>
                <OpenNow
                  hours={HOURS.filter((h) => h.open && h.close).map((h) => ({
                    day: h.day,
                    open: h.open!,
                    close: h.close!,
                  }))}
                />
              </div>
            </div>
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <p className="text-sm font-medium text-muted-foreground">Check availability</p>
              <AvailabilityGrid
                slots={["07:00", "09:00", "12:00", "17:30", "18:45", "20:00"]}
                taken={["09:00", "18:45"]}
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
            { title: "Small classes", description: "Rarely more than fourteen mats a room" },
            { title: "All levels welcome", description: "Every class marks how gentle or hard it is" },
            { title: "Mats provided", description: "Turn up in whatever you can move in" },
          ]}
        />
      </section>

      <section id="classes" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <SectionHeader
            eyebrow="The timetable"
            title="This week's classes"
            description="Drop-in or book ahead — either way, pick a class and we'll save your spot."
          />
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
        <SectionHeader
          eyebrow="The teachers"
          title="Who's on the mat with you"
          description="Every class is led by one of these five — ask for a favourite when you book."
        />
        {teachers.isPending && (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          </div>
        )}
        {teachers.isError && (
          <p className="mt-8 text-sm text-destructive">Couldn't load the teachers. Refresh and try again.</p>
        )}
        {teachers.data?.length === 0 && (
          <Empty className="mt-8" title="Teachers coming soon" description="We're introducing the team shortly." />
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
          <SectionHeader eyebrow="Kind words" title="From the mats" />
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            <Testimonial
              item={{
                quote:
                  "I came for the Sunrise Flow once and now it's the best part of my Tuesday.",
                name: "Naomi Field",
                role: "Sunrise Flow regular",
              }}
            />
            <Testimonial
              item={{
                quote: "Small rooms, real attention. My first downward dog was corrected within a minute.",
                name: "Ravi Chandra",
                role: "Hatha Fundamentals",
              }}
            />
          </div>
        </div>
      </section>

      <section id="find-us" className="mx-auto grid max-w-6xl gap-10 px-6 py-16 sm:grid-cols-2">
        <div>
          <SectionHeader eyebrow="Find us" title="On the high street" />
          <div className="mt-6 max-w-sm">
            <OpeningHours days={HOURS} />
          </div>
        </div>
        <LocationCard
          className="self-start"
          name="Aurora Yoga"
          address="22 Meadow Street, Bristol BS1 5JT"
          note="Above the health-food shop. Bikes can come up; there's no lift for anything bigger."
        />
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <CtaBand
          title="There's almost always a mat free this week"
          description="Book in thirty seconds — we confirm by email."
          action={{ label: "Book now", href: "#/book" }}
        />
      </section>
    </SiteChrome>
  );
}
