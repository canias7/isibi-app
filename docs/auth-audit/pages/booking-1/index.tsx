import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

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
  tagline: "A quiet room, a good floor, classes that start on time.",
  links: [
    { label: "Classes", href: "#prices" },
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

const SLOTS = ["07:00", "08:15", "09:30", "12:00", "17:30", "18:45"];
const TAKEN = ["08:15", "18:45"];

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
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl text-balance">
            A steady practice, a room that doesn't rush you
          </h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Small classes, proper mats, teachers who remember your name. Check what's on today
            and take a spot.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <a
              className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground motion-press"
              href="#/book"
            >
              Book now
            </a>
            <OpenNow hours={HOURS.map((h) => ({ day: h.day, open: h.open!, close: h.close! }))} />
          </div>

          <div className="mt-10 rounded-xl border bg-card p-6 shadow-sm">
            <h2 className="text-sm font-medium">Today's slots</h2>
            <AvailabilityGrid
              className="mt-4"
              slots={SLOTS}
              taken={TAKEN}
              value={slot}
              onSelect={setSlot}
            />
            <p className="mt-4 text-sm text-muted-foreground">
              {slot ? `Holding ${slot} — pick a class on the booking page.` : "Tap a time to hold it."}
            </p>
            <button
              className="mt-3 text-sm font-medium underline underline-offset-4"
              onClick={() => navigate({ to: "/book", search: { service: undefined } })}
            >
              Continue to booking →
            </button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-10">
        <TrustStrip
          items={[
            { title: "Small classes", description: "Capped so a teacher can actually see you" },
            { title: "Every level", description: "Modifications offered, never assumed" },
            { title: "Mats provided", description: "Turn up empty-handed if you like" },
          ]}
        />
      </section>

      <section id="prices" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <SectionHeader
            eyebrow="Classes"
            title="What's on"
            description="Drop into any class — no membership required to start."
          />
          <PriceList
            className="mt-8"
            items={[
              { name: "Morning Flow", description: "Vinyasa, gentle pace, big stretch", price: 14, meta: "60 min" },
              { name: "Slow & Strong", description: "Held poses, plenty of breath", price: 14, meta: "60 min" },
              { name: "Restorative", description: "Props, blankets, very little movement", price: 12, meta: "50 min" },
              { name: "Beginners' Course", description: "Six weeks, same faces each time", price: 65, meta: "6 wks" },
            ]}
            action={{
              label: "Book",
              onSelect: (r) => navigate({ to: "/book", search: { service: r.name } }),
            }}
          />
        </div>
      </section>

      <section id="teachers" className="mx-auto max-w-5xl px-6 py-16">
        <SectionHeader
          eyebrow="Teachers"
          title="Who's teaching"
          description="Every teacher here trained for at least 200 hours before they took a class."
        />
        {teachers.isPending && <Skeleton className="mt-8 h-48 rounded-xl" />}
        {teachers.isError && (
          <p className="mt-8 text-sm text-destructive">Couldn't load the teachers. Refresh and try again.</p>
        )}
        {teachers.data?.length === 0 && (
          <Empty className="mt-8" title="No teachers listed yet" description="Check back soon — the studio is adding profiles." />
        )}
        {!!teachers.data?.length && (
          <TeamGrid
            className="mt-8"
            items={teachers.data.map((t) => ({ name: t.name, role: t.bio ?? undefined, photo: t.photo_url ?? undefined }))}
          />
        )}
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <SectionHeader eyebrow="Kind words" title="From the mats" />
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            <Testimonial
              item={{
                quote: "First studio where nobody made me feel behind. I go twice a week now.",
                name: "Priya Shah",
                role: "Slow & Strong regular",
              }}
            />
            <Testimonial
              item={{
                quote: "The beginners' course was exactly paced right — I actually came back for week two.",
                name: "Owen Cartwright",
                role: "Beginners' Course",
              }}
            />
          </div>
        </div>
      </section>

      <section id="find-us" className="mx-auto grid max-w-5xl gap-10 px-6 py-16 sm:grid-cols-2">
        <div>
          <SectionHeader eyebrow="Find us" title="On the high street" />
          <OpeningHours days={HOURS} className="mt-6" />
        </div>
        <LocationCard
          className="self-start"
          name="Aurora Yoga"
          address="22 Riverside Walk, Bristol BS1 6TH"
          note="Above the health food shop. Bike racks out front, no dedicated car park."
        />
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-20">
        <CtaBand
          title="A spot is usually open today"
          description="Book in thirty seconds — we'll see you on the mat."
          action={{ label: "Book now", href: "#/book" }}
        />
      </section>
    </SiteChrome>
  );
}
