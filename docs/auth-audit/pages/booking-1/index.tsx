import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

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
  tagline: "A calm room, a good mat, classes most days.",
  links: [
    { label: "Timetable", href: "#timetable" },
    { label: "Prices", href: "#prices" },
    { label: "Teachers", href: "#teachers" },
    { label: "Find us", href: "#find-us" },
    { label: "Members", href: "/members" },
  ],
  action: { label: "Book now", href: "/book" },
};

const HOURS: DayHours[] = [
  { day: 1, label: "Monday", open: "07:00", close: "20:30" },
  { day: 2, label: "Tuesday", open: "07:00", close: "20:30" },
  { day: 3, label: "Wednesday", open: "07:00", close: "20:30" },
  { day: 4, label: "Thursday", open: "07:00", close: "20:30" },
  { day: 5, label: "Friday", open: "07:00", close: "19:00" },
  { day: 6, label: "Saturday", open: "09:00", close: "14:00" },
  { day: 0, label: "Sunday", open: "09:00", close: "12:30" },
];

const SLOTS = ["07:30", "09:00", "10:30", "12:00", "17:30", "18:30", "19:30"];

function Home() {
  const navigate = useNavigate();
  const teachers = useRows<Teacher>("teachers", { order: "name", dir: "asc" });
  const [slot, setSlot] = useState<string | null>(null);

  return (
    <SiteChrome {...CHROME}>
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Studio classes · all levels welcome
              </p>
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">Aurora Yoga</h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                A quiet room, proper mats and a mix of strong and gentle classes through the
                week. First class is free if you've never been.
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
                <OpenNow hours={HOURS.map((h) => ({ day: h.day, open: h.open!, close: h.close! }))} />
              </div>
            </div>
            <SafeImage src={null} alt="" ratio="1/1" fallbackSeed="aurora-hero" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <TrustStrip
          items={[
            { title: "All levels", description: "Every class notes who it suits" },
            { title: "Free first class", description: "Come try it before you commit to anything" },
            { title: "Mats provided", description: "Turn up in clothes you can move in" },
          ]}
        />
      </section>

      <section id="timetable" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <SectionHeader
            eyebrow="Today"
            title="Check availability"
            description="Pick a time below, then finish your booking on the next page."
          />
          <div className="mt-8 grid gap-8 lg:grid-cols-[1.35fr_1fr]">
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <AvailabilityGrid slots={SLOTS} taken={["09:00", "18:30"]} value={slot} onSelect={setSlot} />
              <p className="mt-4 text-sm text-muted-foreground">
                {slot ? `Holding ${slot} — pick a class on the booking page.` : "Tap a time to hold it."}
              </p>
              {slot && (
                <Link
                  to="/book"
                  className="mt-2 inline-block text-sm font-medium underline underline-offset-4"
                >
                  Continue to book {slot} →
                </Link>
              )}
            </div>
            <SafeImage src={null} alt="" ratio="4/3" fallbackSeed="aurora-room" />
          </div>
        </div>
      </section>

      <section id="prices" className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeader
          eyebrow="Classes and prices"
          title="What it costs"
          description="Pay per class or ask about a block at the studio — either way, book your spot below."
        />
        <PriceList
          className="mt-8"
          items={[
            { name: "Vinyasa Flow", description: "Steady pace, breath-led, builds through the class", price: 14, meta: "60 min" },
            { name: "Gentle Hatha", description: "Slow and supported — good for a first class", price: 12, meta: "60 min" },
            { name: "Restorative", description: "Mostly floor work, blankets and blocks", price: 12, meta: "75 min" },
            { name: "Power Yoga", description: "Faster, stronger, for people already moving well", price: 15, meta: "50 min" },
            { name: "Yin & Sound", description: "Long holds, ends with a sound bath", price: 16, meta: "75 min" },
          ]}
          action={{ label: "Book", onSelect: (r) => navigate({ to: "/book", search: { service: r.name } }) }}
        />
      </section>

      <section id="teachers" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <SectionHeader eyebrow="Who's teaching" title="Meet the teachers" description="Each class notes who's leading it — ask them anything before or after." />
          {teachers.isPending && <Skeleton className="mt-8 h-40 rounded-xl" />}
          {teachers.isError && (
            <p className="mt-8 text-sm text-destructive">Couldn't load the teachers. Refresh and try again.</p>
          )}
          {teachers.data?.length === 0 && (
            <p className="mt-8 text-sm text-muted-foreground">Teacher profiles are coming soon.</p>
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
              quote: "Came for the free class and never left. The Yin & Sound on Thursdays is my whole week's reset.",
              name: "Priya Sharma",
              role: "Thursday regular",
            }}
          />
          <Testimonial
            item={{
              quote: "I'd never done yoga before. Gentle Hatha was exactly the right place to start.",
              name: "Owen Bracewell",
              role: "New to the mat",
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
            address="22 Riverside Walk, Bristol BS1 6ND"
            note="Above the health food shop. Leave shoes at the top of the stairs."
          />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <CtaBand
          title="There's almost always a spot on the mat"
          description="Book in thirty seconds — we'll see you on the mat."
          action={{ label: "Book now", href: "/book" }}
        />
      </section>
    </SiteChrome>
  );
}
