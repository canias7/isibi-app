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

const HOURS: DayHours[] = [
  { day: 1, label: "Monday", open: "06:30", close: "20:30" },
  { day: 2, label: "Tuesday", open: "06:30", close: "20:30" },
  { day: 3, label: "Wednesday", open: "06:30", close: "20:30" },
  { day: 4, label: "Thursday", open: "06:30", close: "20:30" },
  { day: 5, label: "Friday", open: "07:00", close: "19:00" },
  { day: 6, label: "Saturday", open: "08:00", close: "13:00" },
  { day: 0, label: "Sunday", open: "08:00", close: "13:00" },
];

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A quiet studio for a proper practice.",
  links: [
    { label: "Classes", href: "#prices" },
    { label: "The work", href: "/work" },
    { label: "Teachers", href: "#teachers" },
    { label: "Find us", href: "#find-us" },
  ],
  action: { label: "Book now", href: "/book" },
};

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
                Aurora Yoga
              </p>
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">
                A steadier practice, on the mat next to you
              </h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                Small classes, proper instruction, and a studio that stays quiet even when it's full.
                Check today's slots below.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <a className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" href="/book">
                  Book now
                </a>
                <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="/work">
                  See the studio
                </a>
                <OpenNow hours={HOURS.map((h) => ({ day: h.day, open: h.open!, close: h.close! }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <SafeImage src={null} alt="A morning flow class in progress" ratio="1/1" fallbackSeed="a" />
              <SafeImage src={null} alt="Rows of mats set for practice" ratio="1/1" fallbackSeed="b" />
              <SafeImage src={null} alt="A quiet corner of the studio" ratio="1/1" fallbackSeed="c" />
              <SafeImage src={null} alt="Props stacked ready for class" ratio="1/1" fallbackSeed="d" />
            </div>
          </div>
          <div className="mt-14 border-t border-border pt-10">
            <StatsBand
              items={[
                { value: "12", label: "Classes on the timetable each week" },
                { value: "18", label: "Max per class — nobody's a face in a crowd" },
                { value: "4.9", label: "Average rating from members" },
                { value: "£14", label: "Drop-in, one class" },
              ]}
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <TrustStrip
          items={[
            { title: "Small classes", description: "Capped so a teacher can actually see you" },
            { title: "All levels welcome", description: "Modifications offered, never assumed" },
            { title: "Mats provided", description: "Turn up in whatever you can move in" },
          ]}
        />
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <SectionHeader
            eyebrow="Today"
            title="Today's slots"
            description="Pick a time and carry it straight into the booking form."
          />
          <div className="mt-8 grid gap-8 lg:grid-cols-[1.35fr_1fr]">
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <AvailabilityGrid
                slots={["07:00", "08:00", "09:15", "12:00", "17:30", "18:30", "19:30"]}
                taken={["08:00", "18:30"]}
                value={slot}
                onSelect={setSlot}
              />
              <p className="mt-4 text-sm text-muted-foreground">
                {slot ? `Holding ${slot} — finish up on the booking page.` : "Tap a time to hold it."}
              </p>
              {slot && (
                <a
                  className="mt-2 inline-block text-sm font-medium underline underline-offset-4"
                  href="/book"
                >
                  Continue to book {slot} →
                </a>
              )}
            </div>
            <SafeImage src={null} alt="The studio floor, ready for the morning class" ratio="4/3" fallbackSeed="e" />
          </div>
        </div>
      </section>

      <section id="prices" className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeader
          eyebrow="The classes"
          title="What's on, what it costs"
          description="Drop in to any class, or ask about a membership once you know which ones suit you."
        />
        <PriceList
          className="mt-8"
          items={[
            { name: "Morning Flow", description: "A brisk vinyasa to start the day", price: 14, meta: "60 min" },
            { name: "Slow & Steady", description: "Gentle, held postures, plenty of breath", price: 14, meta: "60 min" },
            { name: "Restorative", description: "Long holds, low light, no rush", price: 14, meta: "75 min" },
            { name: "Beginners' Six-Week Course", description: "Start here if you're new to the mat", price: 72, meta: "6 sessions" },
          ]}
          action={{ label: "Book", onSelect: (r) => navigate({ to: "/book", search: { service: r.name } }) }}
        />
      </section>

      <section id="teachers" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <SectionHeader eyebrow="Who teaches" title="Meet the teachers" description="Every class names its teacher on the timetable." />
          {teachers.isPending && <Skeleton className="mt-8 h-48 rounded-xl" />}
          {teachers.isError && (
            <p className="mt-8 text-sm text-destructive">Couldn't load the teachers. Refresh and try again.</p>
          )}
          {teachers.data?.length === 0 && (
            <p className="mt-8 text-sm text-muted-foreground">No teachers listed yet.</p>
          )}
          {!!teachers.data?.length && (
            <TeamGrid
              className="mt-8"
              items={teachers.data.map((t) => ({ name: t.name, role: t.bio, photo: t.photo_url }))}
            />
          )}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeader eyebrow="Kind words" title="From the mat" />
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          <Testimonial
            item={{
              quote: "I'd never done yoga before the beginners' course. Six weeks in and I actually look forward to Tuesdays.",
              name: "Priya Shah",
              role: "Beginners' course, now Morning Flow",
            }}
          />
          <Testimonial
            item={{
              quote: "Restorative on a Sunday evening is the best decision I make each week.",
              name: "Callum Reid",
              role: "Sunday regular",
            }}
          />
        </div>
      </section>

      <section id="find-us" className="border-y border-border bg-muted/40">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 sm:grid-cols-2">
          <div>
            <SectionHeader eyebrow="Find us" title="The studio" />
            <div className="mt-6 max-w-sm">
              <OpeningHours days={HOURS} />
            </div>
          </div>
          <LocationCard
            className="self-start"
            name="Aurora Yoga"
            address="9 Mill Lane, Bristol BS1 4AA"
            note="Above the bookshop. Bikes can come in through the side door."
          />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <CtaBand
          title="There's a slot most days"
          description="Book in thirty seconds — we'll see you on the mat."
          action={{ label: "Book now", href: "/book" }}
        />
      </section>
    </SiteChrome>
  );
}
