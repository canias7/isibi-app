import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

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
  tagline: "A calm room, a steady practice, every day of the week.",
  links: [
    { label: "Classes", href: "#classes" },
    { label: "Teachers", href: "#teachers" },
    { label: "The studio", href: "#/work" },
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
  { day: 6, label: "Saturday", open: "08:30", close: "14:00" },
  { day: 0, label: "Sunday", open: "09:00", close: "13:00" },
];

function Home() {
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
                Aurora Yoga
              </h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                Slow flows, strong vinyasas, and a quiet room to land in between them.
                Check today's classes below and book straight in.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link
                  to="/book"
                  className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
                >
                  Book now
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
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <p className="text-sm font-medium text-muted-foreground">Today's classes</p>
              <AvailabilityGrid
                slots={["07:00", "09:00", "12:15", "17:30", "18:30", "19:30"]}
                taken={["09:00", "18:30"]}
                value={slot}
                onSelect={setSlot}
              />
              <p className="mt-4 text-sm text-muted-foreground">
                {slot ? `Holding ${slot} — finish up on the booking page.` : "Tap a time to hold it."}
              </p>
              {slot && (
                <Link to="/book" className="mt-2 inline-block text-sm font-medium underline underline-offset-4">
                  Continue to book {slot} →
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <TrustStrip
          items={[
            { title: "Small classes", description: "Never more than sixteen mats" },
            { title: "All levels welcome", description: "Every class notes who it suits" },
            { title: "Mats and blocks provided", description: "Just bring yourself" },
          ]}
        />
      </section>

      <section id="classes" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <SectionHeader
            eyebrow="The timetable"
            title="This week's classes"
            description="Drop in to any class, or book ahead to be sure of a mat."
          />
          <PriceList
            className="mt-8"
            items={[
              { name: "Sunrise Flow", description: "A gentle wake-up vinyasa", price: 12, meta: "Mon, Wed, Fri · 07:00" },
              { name: "Vinyasa", description: "Strong and steady, all levels", price: 14, meta: "Tue, Thu · 18:30" },
              { name: "Restorative", description: "Slow holds, props and quiet", price: 12, meta: "Sun · 09:00" },
              { name: "Yin", description: "Long, still, deeply calming", price: 12, meta: "Wed · 19:30" },
              { name: "Beginners' Foundations", description: "The basics, taught properly", price: 10, meta: "Sat · 08:30" },
            ]}
            action={{ label: "Book", onSelect: () => { window.location.hash = "#/book"; } }}
          />
        </div>
      </section>

      <section id="teachers" className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeader
          eyebrow="Who teaches"
          title="Meet the teachers"
          description="Every class is led by one of these four — ask for whoever suits your practice."
        />
        {teachers.isPending && (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          </div>
        )}
        {teachers.isError && (
          <p className="mt-8 text-sm text-destructive">Couldn't load the teachers. Refresh and try again.</p>
        )}
        {teachers.data?.length === 0 && (
          <Empty className="mt-8" title="No teachers listed yet" description="Check back soon — the studio is adding profiles." />
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
                quote: "I was terrified of my first Vinyasa class. Nobody made me feel behind — I go back every Tuesday now.",
                name: "Priya Shah",
                role: "Tuesday regular",
              }}
            />
            <Testimonial
              item={{
                quote: "The Yin class undid a year of desk posture in about six weeks.",
                name: "Tom Reilly",
                role: "Wednesday evenings",
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
          address="18 Willowbank Lane, Bristol BS6 5TF"
          note="Above the health food shop. Bikes can be left in the yard behind."
        />
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <CtaBand
          title="There's usually a mat free this week"
          description="Book in thirty seconds — we confirm by email."
          action={{ label: "Book now", href: "#/book" }}
        />
      </section>
    </SiteChrome>
  );
}
