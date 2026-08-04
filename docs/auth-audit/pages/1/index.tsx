import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { useRows, type Row } from "@/lib/rows";
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
import { AvailabilityGrid } from "@/components/ui/availability-grid";

export const Route = createFileRoute("/")({ component: Home });

type Teacher = Row & { name: string; bio: string | null; phone: string | null };

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A quiet studio, a steady practice.",
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
  { day: 0, label: "Sunday", open: "08:30", close: "13:00" },
];

const CLASSES = [
  { name: "Sunrise Vinyasa", description: "A flowing start to the day, breath-led", price: 16, meta: "60 min" },
  { name: "Slow Hatha", description: "Held postures, plenty of props", price: 14, meta: "60 min" },
  { name: "Restorative & Yin", description: "Long holds, blankets, dim lights", price: 15, meta: "75 min" },
  { name: "Strength & Flow", description: "Vinyasa with a weighted edge", price: 17, meta: "60 min" },
  { name: "Beginners' Foundations", description: "New to yoga? Start here", price: 12, meta: "45 min" },
];

function Home() {
  const teachers = useRows<Teacher>("teachers", { order: "name", dir: "asc" });
  const navigate = useNavigate();

  return (
    <SiteChrome {...CHROME}>
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_1fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Aurora Yoga
              </p>
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">
                Aurora Yoga
              </h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                A small studio built around a steady mat practice — five classes a
                day, a handful of teachers who know your name, and a spot on the
                mat that's usually free this week.
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
                  href="#classes"
                >
                  See the timetable
                </a>
                <OpenNow
                  hours={HOURS.map((h) => ({ day: h.day, open: h.open!, close: h.close! }))}
                />
              </div>
            </div>
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <p className="text-sm font-medium text-muted-foreground">Today's mats</p>
              <AvailabilityGrid
                slots={["07:00", "09:00", "12:00", "17:30", "18:45", "20:00"]}
                taken={["09:00", "18:45"]}
                value={null}
                onSelect={() => navigate({ to: "/book" })}
              />
              <p className="mt-4 text-sm text-muted-foreground">
                Tap a time to continue to the booking form.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <TrustStrip
          items={[
            { title: "Small classes", description: "Never more than sixteen mats" },
            { title: "All levels welcome", description: "Every class notes who it suits" },
            { title: "Mats and props provided", description: "Just bring yourself" },
          ]}
        />
      </section>

      <section id="classes" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <SectionHeader
            eyebrow="The timetable"
            title="This week's classes"
            description="Drop in, or book ahead for the classes that fill first."
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
          title="Who you'll practise with"
          description="Ask for whoever you liked last time — it's on your booking either way."
        />
        {teachers.isPending && <Skeleton className="mt-8 h-40 rounded-xl" />}
        {teachers.isError && (
          <p className="mt-8 text-sm text-destructive">
            Couldn't load the teachers. Refresh and try again.
          </p>
        )}
        {teachers.data?.length === 0 && (
          <Empty
            className="mt-8"
            title="No teachers listed yet"
            description="Check back soon — this section fills in as the studio adds its team."
          />
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
                  "Started with the beginners' class terrified I'd get it wrong. Nobody made me feel that way once.",
                name: "Priya Sharma",
                role: "Slow Hatha, twice a week",
              }}
            />
            <Testimonial
              item={{
                quote: "The Sunday restorative class is the best hour of my week, no contest.",
                name: "Callum Reid",
                role: "Restorative & Yin",
              }}
            />
          </div>
        </div>
      </section>

      <section id="find-us" className="mx-auto grid max-w-6xl gap-10 px-6 py-16 sm:grid-cols-2">
        <div>
          <SectionHeader eyebrow="Find us" title="In the studio" />
          <div className="mt-6 max-w-sm">
            <OpeningHours days={HOURS} />
          </div>
        </div>
        <LocationCard
          className="self-start"
          name="Aurora Yoga"
          address="9 Millgate Lane, Bristol BS6 5TF"
          note="Above the wholefood shop. Bikes welcome, no car park."
        />
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <CtaBand
          title="Your mat is usually free this week"
          description="Book in thirty seconds — we confirm by email."
          action={{ label: "Book now", href: "#/book" }}
        />
      </section>
    </SiteChrome>
  );
}
