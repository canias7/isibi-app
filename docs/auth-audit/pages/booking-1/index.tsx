import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { useRows, usePublicRows, type Row, type PublicRow } from "@/lib/rows";
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
  tagline: "A calm room, a steady practice.",
  links: [
    { label: "Classes", href: "#classes" },
    { label: "Teachers", href: "#teachers" },
    { label: "The work", href: "/work" },
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
  { day: 0, label: "Sunday", open: "09:00", close: "12:30" },
];

const CLASSES = [
  { name: "Morning Flow", description: "A gentle vinyasa to open the day", price: 14, meta: "60 min" },
  { name: "Hatha Foundations", description: "Slow, precise, good for beginners", price: 14, meta: "60 min" },
  { name: "Power Vinyasa", description: "Strong and fast-paced", price: 16, meta: "75 min" },
  { name: "Restorative", description: "Long holds, blankets and bolsters", price: 15, meta: "75 min" },
  { name: "Candlelit Yin", description: "Deep stretch as the room dims", price: 15, meta: "60 min" },
];

type BookingPublic = PublicRow & { slot_date: string; slot_time: string };

function Home() {
  const [slot, setSlot] = useState<string | null>(null);
  const teachers = useRows<Teacher>("teachers", { order: "name", dir: "asc" });
  const navigate = useNavigate();

  const today = new Date().toISOString().slice(0, 10);
  const taken = usePublicRows<BookingPublic>("bookings", { slot_date: today });

  const todaySlots = ["07:00", "09:00", "12:15", "17:30", "18:45", "19:45"];

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
                A steady practice, close to home
              </h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                Small classes, real teaching, mats provided. Book a slot below or come
                for whichever class suits your evening.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <a
                  className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground motion-press"
                  href="/book"
                >
                  Book now
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
              <SectionHeader eyebrow="Today" title="Check availability" align="left" />
              {taken.isPending && <Skeleton className="mt-4 h-40 rounded-lg" />}
              {!taken.isPending && (
                <AvailabilityGrid
                  slots={todaySlots}
                  taken={taken.data?.map((t) => t.slot_time) ?? []}
                  value={slot}
                  onSelect={setSlot}
                />
              )}
              <p className="mt-4 text-sm text-muted-foreground">
                {slot ? `Holding ${slot} — pick a class on the booking page.` : "Tap a time to hold it."}
              </p>
              {slot && (
                <button
                  className="mt-2 text-sm font-medium underline underline-offset-4"
                  onClick={() => navigate({ to: "/book", search: { time: slot } })}
                >
                  Continue with {slot} →
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <TrustStrip
          items={[
            { title: "Small classes", description: "Never more than fourteen mats" },
            { title: "Mats provided", description: "Arrive as you are" },
            { title: "All levels", description: "Every class notes who it suits" },
          ]}
        />
      </section>

      <section id="classes" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <SectionHeader
            eyebrow="Timetable"
            title="This week's classes"
            description="Drop in to any class — no membership required, though regulars save with a block."
          />
          <PriceList
            className="mt-8"
            items={CLASSES}
            action={{
              label: "Book",
              onSelect: (row) => navigate({ to: "/book", search: { class: row.name } }),
            }}
          />
        </div>
      </section>

      <section id="teachers" className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeader
          eyebrow="The teachers"
          title="Who's on the mat"
          description="Every class lists its teacher when you book, so you can follow one you like."
        />
        {teachers.isPending && (
          <div className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          </div>
        )}
        {teachers.isError && (
          <p className="mt-8 text-sm text-destructive">Couldn't load the teachers. Refresh and try again.</p>
        )}
        {teachers.data?.length === 0 && (
          <Empty className="mt-8" title="Teachers coming soon" description="We're adding the team here shortly." />
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
          <SectionHeader eyebrow="Kind words" title="From the mat" />
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            <Testimonial
              item={{
                quote: "I was intimidated by yoga for years. The Hatha class was patient and exact — I finally understand alignment.",
                name: "Priya Nair",
                role: "Hatha Foundations, Tuesdays",
              }}
            />
            <Testimonial
              item={{
                quote: "Candlelit Yin on a Thursday is the best forty minutes of my week.",
                name: "Callum Reid",
                role: "Regular, six months",
              }}
            />
          </div>
        </div>
      </section>

      <section id="find-us" className="mx-auto grid max-w-6xl gap-10 px-6 py-16 sm:grid-cols-2">
        <div>
          <SectionHeader eyebrow="Find us" title="The studio" />
          <div className="mt-6 max-w-sm">
            <OpeningHours days={HOURS} />
          </div>
        </div>
        <LocationCard
          className="self-start"
          name="Aurora Yoga"
          address="22 Riverside Walk, Bristol BS1 6QH"
          note="Above the bakery, first floor. Bikes can be locked in the courtyard."
        />
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <CtaBand
          title="There's usually a mat free tonight"
          description="Book in thirty seconds — we confirm by email."
          action={{ label: "Book now", href: "/book" }}
        />
      </section>
    </SiteChrome>
  );
}
