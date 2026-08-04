import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { useRows, type Row } from "@/lib/rows";
import { AvailabilityGrid } from "@/components/ui/availability-grid";
import { CtaBand } from "@/components/ui/cta-band";
import { OpenNow } from "@/components/ui/open-now";
import { OpeningHours, type DayHours } from "@/components/ui/opening-hours";
import { PriceList } from "@/components/ui/price-list";
import { SectionHeader } from "@/components/ui/section-header";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Skeleton } from "@/components/ui/skeleton";
import { TeamGrid } from "@/components/ui/team-grid";
import { Testimonial } from "@/components/ui/testimonial";
import { TrustStrip } from "@/components/ui/trust-strip";
import { LocationCard } from "@/components/ui/location-card";
import { Empty } from "@/components/ui/empty";

export const Route = createFileRoute("/")({ component: Home });

type Teacher = Row & { name: string; bio: string | null; phone: string | null };

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A quiet studio for a steady practice.",
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
  { day: 6, label: "Saturday", open: "09:00", close: "14:00" },
  { day: 0, label: "Sunday", open: "09:00", close: "12:30" },
];

const CLASSES = [
  { name: "Sunrise Flow", description: "A gentle vinyasa to open the day", price: 16, meta: "60 min" },
  { name: "Hatha Foundations", description: "Slow, precise, good for beginners", price: 14, meta: "60 min" },
  { name: "Power Vinyasa", description: "Dynamic and sweaty, some experience helpful", price: 18, meta: "75 min" },
  { name: "Restorative & Yin", description: "Long holds, blankets and blocks", price: 15, meta: "75 min" },
  { name: "Prenatal Yoga", description: "Safe, supported movement for every trimester", price: 16, meta: "55 min" },
];

function Home() {
  const teachers = useRows<Teacher>("teachers", { order: "name", dir: "asc" });
  const navigate = useNavigate();
  const [slot, setSlot] = useState<string | null>(null);

  return (
    <SiteChrome {...CHROME}>
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            A studio, not a gym
          </p>
          <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">Aurora Yoga</h1>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
            Small classes, real attention, and a mat waiting whenever you need one. Book a class below or come find us on the mat this evening.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <a className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" href="#/book">
              Book now
            </a>
            <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="#/work">
              See the studio
            </a>
            <OpenNow hours={HOURS.map((h) => ({ day: h.day, open: h.open!, close: h.close! }))} />
          </div>

          <div className="mt-10 rounded-xl border bg-card p-6 shadow-sm">
            <SectionHeader eyebrow="Today" title="Today's slots" description="Pick a time — we hold it while you choose a class." />
            <AvailabilityGrid
              className="mt-5"
              slots={["07:00", "08:00", "09:15", "12:00", "17:30", "18:45", "20:00"]}
              taken={["08:00", "18:45"]}
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
      </section>

      <section className="mx-auto max-w-5xl px-6 py-10">
        <TrustStrip
          items={[
            { title: "Small classes", description: "Capped so the teacher can actually see you" },
            { title: "Every level welcome", description: "Modifications offered, never assumed" },
            { title: "Mats and blocks provided", description: "Bring water, nothing else" },
          ]}
        />
      </section>

      <section id="classes" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <SectionHeader
            eyebrow="The timetable"
            title="Classes and drop-in prices"
            description="Come once, or book a class you'll keep coming back to."
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

      <section id="teachers" className="mx-auto max-w-5xl px-6 py-16">
        <SectionHeader
          eyebrow="The teachers"
          title="Who you'll practise with"
          description="Ask for whoever taught your first class — it's on your booking either way."
        />
        {teachers.isPending && <Skeleton className="mt-8 h-40 rounded-xl" />}
        {teachers.isError && (
          <p className="mt-8 text-sm text-destructive">Couldn't load the teachers. Refresh and try again.</p>
        )}
        {teachers.data?.length === 0 && (
          <Empty className="mt-8" title="No teachers listed yet" description="Check back soon — our team page is being written." />
        )}
        {!!teachers.data?.length && (
          <TeamGrid
            className="mt-8"
            items={teachers.data.map((t) => ({ name: t.name, role: t.bio ?? undefined }))}
          />
        )}
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <SectionHeader eyebrow="Kind words" title="From the mat" />
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            <Testimonial
              item={{
                quote: "I've tried three studios in this city. This is the only one where the teacher remembers my knee.",
                name: "Priya Shah",
                role: "Hatha Foundations, twice weekly",
              }}
            />
            <Testimonial
              item={{
                quote: "Restorative on a Sunday evening fixed my whole week. Can't recommend it enough.",
                name: "Tom Fenwick",
                role: "Restorative & Yin regular",
              }}
            />
          </div>
        </div>
      </section>

      <section id="find-us" className="mx-auto grid max-w-5xl gap-10 px-6 py-16 sm:grid-cols-2">
        <div>
          <SectionHeader eyebrow="Find us" title="Above the old print works" />
          <OpeningHours days={HOURS} className="mt-6" />
        </div>
        <LocationCard
          className="self-start"
          name="Aurora Yoga"
          address="5 Mill Lane, Bristol BS1 4EQ"
          note="First floor, above the bakery. Bike racks outside, no dedicated parking."
        />
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-20">
        <CtaBand
          title="There's almost always a mat free tonight"
          description="Book in under a minute — we'll confirm by email."
          action={{ label: "Book now", href: "#/book" }}
        />
      </section>
    </SiteChrome>
  );
}
