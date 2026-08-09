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
import { Empty } from "@/components/ui/empty";

export const Route = createFileRoute("/")({ component: Home });

type Teacher = Row & { name: string; bio: string | null; photo_url: string | null };

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A calm room off the high street — mats provided.",
  links: [
    { label: "Classes", href: "#classes" },
    { label: "Teachers", href: "#teachers" },
    { label: "The studio", href: "/work" },
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
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Studio on the high street
              </p>
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">
                Aurora Yoga
              </h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                Small classes, proper adjustments, and a room that stays warm in
                winter. Book a class below, or check what's free today.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link
                  className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground motion-press"
                  to="/book"
                >
                  Book now
                </Link>
                <Link
                  className="rounded-md border border-border px-5 py-2.5 text-sm font-medium"
                  to="/work"
                >
                  See the studio
                </Link>
                <OpenNow
                  hours={HOURS.filter((h) => h.open && h.close).map((h) => ({
                    day: h.day,
                    open: h.open!,
                    close: h.close!,
                  }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <SafeImage src={null} alt="" fallbackSeed="studio-1" ratio="1/1" />
              <SafeImage src={null} alt="" fallbackSeed="studio-2" ratio="1/1" />
              <SafeImage src={null} alt="" fallbackSeed="studio-3" ratio="1/1" />
              <SafeImage src={null} alt="" fallbackSeed="studio-4" ratio="1/1" />
            </div>
          </div>
          <div className="mt-14 border-t border-border pt-10">
            <StatsBand
              items={[
                { value: "6", label: "Classes running most weeks" },
                { value: "12", label: "Max mats per class" },
                { value: "4.9", label: "Average class rating" },
                { value: "£14", label: "Drop-in, one class" },
              ]}
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <TrustStrip
          items={[
            { title: "Small classes", description: "Twelve mats, never more, so you get seen" },
            { title: "All levels welcome", description: "Every class notes who it suits" },
            { title: "Mats and props provided", description: "Turn up empty-handed" },
          ]}
        />
      </section>

      <section id="classes" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <SectionHeader
            eyebrow="Today"
            title="Today's classes"
            description="Pick a spot below; we hold it for ten minutes while you finish booking."
          />
          <div className="mt-8 grid gap-8 lg:grid-cols-[1.35fr_1fr]">
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <AvailabilityGrid
                slots={["07:00", "09:00", "12:15", "17:30", "18:30", "19:45"]}
                taken={["09:00", "18:30"]}
                value={slot}
                onSelect={setSlot}
              />
              <p className="mt-4 text-sm text-muted-foreground">
                {slot ? `Holding ${slot} — finish up on the booking page.` : "Tap a time to hold it."}
              </p>
              {slot && (
                <Link
                  className="mt-2 inline-block text-sm font-medium underline underline-offset-4"
                  to="/book"
                >
                  Continue to book {slot} →
                </Link>
              )}
            </div>
            <SafeImage src={null} alt="" fallbackSeed="class-in-session" ratio="4/3" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeader
          eyebrow="The timetable"
          title="Classes and prices"
          description="Drop in to any class, or ask about the ten-class pass at the desk."
        />
        <PriceList
          className="mt-8"
          items={[
            { name: "Morning flow", description: "Gentle vinyasa to start the day", price: 14, meta: "60 min" },
            { name: "Hatha", description: "Slower, holds each pose longer", price: 14, meta: "60 min" },
            { name: "Power vinyasa", description: "Fast-paced and sweaty", price: 16, meta: "75 min" },
            { name: "Restorative", description: "Blankets, blocks, and quiet", price: 14, meta: "60 min" },
            { name: "Beginners' six-week course", description: "Start from nothing, in a small group", price: 65, meta: "6 weeks" },
          ]}
          action={{ label: "Book", onSelect: (row) => navigate({ to: "/book", search: { service: row.name } }) }}
        />
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <SectionHeader eyebrow="Your teachers" title="Who's teaching" />
          {teachers.isPending && <Skeleton className="mt-8 h-48 rounded-xl" />}
          {teachers.isError && (
            <p className="mt-8 text-sm text-destructive">Couldn't load the teachers. Refresh and try again.</p>
          )}
          {teachers.data?.length === 0 && (
            <div className="mt-8">
              <Empty title="No teachers listed yet" description="Check back soon — the studio is still adding profiles." />
            </div>
          )}
          {!!teachers.data?.length && (
            <TeamGrid
              className="mt-8"
              items={teachers.data.map((t) => ({
                name: t.name,
                role: t.bio,
                photo: t.photo_url,
                fallbackSeed: t.name,
              }))}
            />
          )}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeader eyebrow="Kind words" title="From the mats" />
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          <Testimonial
            item={{
              quote: "First class in years and nobody made me feel behind. Coming back every week now.",
              name: "Priya Shah",
              role: "Morning flow, most Tuesdays",
            }}
          />
          <Testimonial
            item={{
              quote: "Small enough that the teacher actually corrects your alignment. That's rare.",
              name: "Tom Whitfield",
              role: "Power vinyasa regular",
            }}
          />
        </div>
      </section>

      <section id="find-us" className="border-y border-border bg-muted/40">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 sm:grid-cols-2">
          <div>
            <SectionHeader eyebrow="Find us" title="Above the bakery on the high street" />
            <div className="mt-6 max-w-sm">
              <OpeningHours days={HOURS} />
            </div>
          </div>
          <LocationCard
            className="self-start"
            name="Aurora Yoga"
            address="22 High Street, Bristol BS1 4DJ"
            note="Up the side stairs next to the bakery. Bike racks out front, no dedicated parking."
          />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <CtaBand
          title="There's usually a spot on the mat today"
          description="Book in thirty seconds — we confirm by email."
          action={{ label: "Book now", href: "/book" }}
        />
      </section>
    </SiteChrome>
  );
}
