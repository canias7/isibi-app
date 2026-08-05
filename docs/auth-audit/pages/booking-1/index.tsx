import { createFileRoute, Link } from "@tanstack/react-router";

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

type Teacher = Row & { name: string; bio: string | null; photo_url: string | null };

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A calm room, a good floor, six classes a week.",
  links: [
    { label: "Timetable", href: "#timetable" },
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
  { name: "Sunrise Flow", description: "A gentle vinyasa to wake the body up", price: 14, meta: "60 min" },
  { name: "Hatha Fundamentals", description: "Slow, precise, good for beginners", price: 14, meta: "60 min" },
  { name: "Power Vinyasa", description: "Stronger sequencing, breath-led", price: 16, meta: "75 min" },
  { name: "Restorative & Yin", description: "Long holds, blankets and bolsters", price: 14, meta: "60 min" },
  { name: "Prenatal", description: "Small class, all trimesters welcome", price: 15, meta: "55 min" },
];

function Home() {
  const teachers = useRows<Teacher>("teachers", { order: "name", dir: "asc" });

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
                A quiet room to come back to every week
              </h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                Six classes a week, small groups, mats and props provided. First class is on us.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link
                  to="/book"
                  className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground motion-press"
                >
                  Book now
                </Link>
                <Link to="/work" className="rounded-md border border-border px-5 py-2.5 text-sm font-medium">
                  See the studio
                </Link>
                <OpenNow
                  hours={HOURS.map((h) => ({ day: h.day, open: h.open!, close: h.close! }))}
                />
              </div>
            </div>
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <p className="text-sm font-medium text-muted-foreground">Today's classes</p>
              <AvailabilityGrid
                slots={["07:00", "09:00", "12:00", "17:30", "18:45", "20:00"]}
                taken={["09:00"]}
              />
              <Link to="/book" className="mt-4 inline-block text-sm font-medium underline underline-offset-4">
                Check availability →
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <TrustStrip
          items={[
            { title: "Small classes", description: "Never more than fourteen on the mat" },
            { title: "Props provided", description: "Mats, blocks and bolsters, all included" },
            { title: "First class free", description: "Come see the room before you commit" },
          ]}
        />
      </section>

      <section id="timetable" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <SectionHeader
            eyebrow="The timetable"
            title="This week's classes"
            description="Drop in or book ahead — a spot is held for ten minutes once you pick a time."
          />
          <PriceList
            className="mt-8"
            items={CLASSES}
            action={{
              label: "Book",
              onSelect: (r) => {
                window.location.hash = `#/book?service=${encodeURIComponent(r.name)}`;
              },
            }}
          />
        </div>
      </section>

      <section id="teachers" className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeader
          eyebrow="The teachers"
          title="Who's on the mat"
          description="Every class is led by one of these four — ask for whoever suits your practice."
        />
        {teachers.isPending && <Skeleton className="mt-8 h-48 rounded-xl" />}
        {teachers.isError && (
          <p className="mt-8 text-sm text-destructive">
            Couldn't load the teachers. Refresh and try again.
          </p>
        )}
        {teachers.data?.length === 0 && (
          <Empty className="mt-8" title="No teachers listed yet" description="Check back soon." />
        )}
        {!!teachers.data?.length && (
          <TeamGrid
            className="mt-8"
            items={teachers.data.map((t) => ({
              name: t.name,
              role: t.bio,
              photo: t.photo_url,
            }))}
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
                  "I was intimidated by yoga for years. The Hatha class made it make sense.",
                name: "Priya Shah",
                role: "Twice a week",
              }}
            />
            <Testimonial
              item={{
                quote: "Restorative on a Sunday evening is the best hour of my week.",
                name: "Callum Reed",
                role: "Sunday regular",
              }}
            />
          </div>
        </div>
      </section>

      <section id="find-us" className="mx-auto grid max-w-6xl gap-10 px-6 py-16 sm:grid-cols-2">
        <div>
          <SectionHeader eyebrow="Find us" title="Open seven days" />
          <OpeningHours days={HOURS} className="mt-6" />
        </div>
        <LocationCard
          className="self-start"
          name="Aurora Yoga"
          address="22 Riverside Walk, Bristol BS1 6QR"
          note="Above the deli, up one flight. Bike racks out front, no dedicated parking."
        />
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <CtaBand
          title="Your mat is usually free tonight"
          description="Book in thirty seconds — we'll see you on the mat."
          action={{ label: "Book now", href: "#/book" }}
        />
      </section>
    </SiteChrome>
  );
}
