import { createFileRoute, useNavigate } from "@tanstack/react-router";
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

export const Route = createFileRoute("/")({ component: Home });

type Teacher = Row & { name: string; bio: string | null; photo_url: string | null };

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A calm room, six classes a day.",
  links: [
    { label: "Classes", href: "#classes" },
    { label: "The work", href: "#/work" },
    { label: "Teachers", href: "#teachers" },
    { label: "Find us", href: "#find-us" },
    { label: "Members", href: "#/account" },
  ],
  action: { label: "Book now", href: "#/book" },
};

const HOURS: DayHours[] = [
  { day: 1, label: "Monday", open: "07:00", close: "20:00" },
  { day: 2, label: "Tuesday", open: "07:00", close: "20:00" },
  { day: 3, label: "Wednesday", open: "07:00", close: "20:00" },
  { day: 4, label: "Thursday", open: "07:00", close: "20:00" },
  { day: 5, label: "Friday", open: "07:00", close: "19:00" },
  { day: 6, label: "Saturday", open: "08:00", close: "14:00" },
  { day: 0, label: "Sunday", open: "09:00", close: "13:00" },
];

const CLASSES = [
  { name: "Morning Flow", description: "Slow vinyasa to start the day", price: 14, meta: "60 min" },
  { name: "Hatha Foundations", description: "Alignment-focused, good for new students", price: 14, meta: "60 min" },
  { name: "Power Vinyasa", description: "A stronger, faster class", price: 16, meta: "75 min" },
  { name: "Restorative & Yin", description: "Long holds, props provided", price: 14, meta: "60 min" },
  { name: "Candlelit Slow Flow", description: "Evening class, low light", price: 15, meta: "60 min" },
];

function Home() {
  const teachers = useRows<Teacher>("teachers", { order: "name", dir: "asc" });
  const navigate = useNavigate();
  const [slot, setSlot] = useState<string | null>(null);

  return (
    <SiteChrome {...CHROME}>
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Aurora Yoga</p>
          <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">A calm room, six classes a day</h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Drop in or book ahead. New students get their first class free — just say so when you arrive.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <a className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" href="#/book">Book now</a>
            <OpenNow hours={HOURS.map((h) => ({ day: h.day, open: h.open!, close: h.close! }))} />
          </div>

          <div className="mt-10 rounded-xl border bg-card p-6 shadow-sm">
            <p className="text-sm font-medium">Today's slots</p>
            <AvailabilityGrid
              className="mt-4"
              slots={["07:00", "08:15", "09:30", "12:00", "17:30", "18:45"]}
              taken={["08:15", "17:30"]}
              value={slot}
              onSelect={setSlot}
            />
            <p className="mt-3 text-sm text-muted-foreground">
              {slot ? `Holding ${slot} — finish on the booking page.` : "Tap a time to hold it."}
            </p>
            {slot && (
              <button
                className="mt-2 text-sm font-medium underline underline-offset-4"
                onClick={() => navigate({ to: "/book", search: { time: slot } })}
              >
                Continue to book {slot} →
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-10">
        <TrustStrip
          items={[
            { title: "New here? First class free", description: "Just mention it at the desk" },
            { title: "Mats and props provided", description: "Bring a towel, we'll do the rest" },
            { title: "Small classes", description: "Never more than eighteen on a mat" },
          ]}
        />
      </section>

      <section id="classes" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <SectionHeader eyebrow="Classes" title="What's on" description="Every class ends with five minutes of stillness — arrive a little early if you're new." />
          <PriceList
            className="mt-8"
            items={CLASSES}
            action={{ label: "Book", onSelect: (r) => navigate({ to: "/book", search: { class_name: r.name } }) }}
          />
        </div>
      </section>

      <section id="teachers" className="mx-auto max-w-5xl px-6 py-16">
        <SectionHeader eyebrow="Teachers" title="Who's teaching" description="Classes are covered when a teacher is away, never cancelled." />
        {teachers.isPending && <Skeleton className="mt-8 h-40 rounded-xl" />}
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
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <SectionHeader eyebrow="Kind words" title="From the mat" />
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            <Testimonial item={{ quote: "I came in stiff from a desk job and left feeling like a person again. Three times a week now.", name: "Priya Adeyemi", role: "Morning Flow regular" }} />
            <Testimonial item={{ quote: "Small classes, no ego, and someone always corrects your alignment without making it weird.", name: "Tom Sutcliffe", role: "Hatha Foundations" }} />
          </div>
        </div>
      </section>

      <section id="find-us" className="mx-auto grid max-w-5xl gap-10 px-6 py-16 sm:grid-cols-2">
        <div>
          <SectionHeader eyebrow="Find us" title="Drop by" />
          <OpeningHours days={HOURS} className="mt-6" />
        </div>
        <LocationCard
          className="self-start"
          name="Aurora Yoga"
          address="22 Meadow Lane, Bristol BS3 4LP"
          note="Above the health-food shop. Small free car park round the back."
        />
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-20">
        <CtaBand title="There's usually a mat free tonight" description="Book in thirty seconds — we'll email a confirmation." action={{ label: "Book now", href: "#/book" }} />
      </section>
    </SiteChrome>
  );
}
