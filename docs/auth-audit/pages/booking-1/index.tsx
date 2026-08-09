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
  tagline: "A quiet studio, six mats to a class.",
  links: [
    { label: "Today's classes", href: "#classes" },
    { label: "Prices", href: "#prices" },
    { label: "Teachers", href: "#teachers" },
    { label: "Find us", href: "#find-us" },
    { label: "The work", href: "#/work" },
    { label: "Account", href: "#/account" },
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
  { day: 0, label: "Sunday", open: "09:00", close: "12:00" },
];

function Home() {
  const [slot, setSlot] = useState<string | null>(null);
  const teachers = useRows<Teacher>("teachers", { order: "name", dir: "asc" });

  return (
    <SiteChrome {...CHROME}>
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Studio classes · six mats
          </p>
          <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">Aurora Yoga</h1>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
            Slow mornings, strong evenings. Book a mat below and we'll hold it — no membership needed to try a class.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <a className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground motion-press" href="#/book">
              Book now
            </a>
            <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium motion-press" href="#prices">
              See prices
            </a>
            <OpenNow hours={HOURS.map((h) => ({ day: h.day, open: h.open!, close: h.close! }))} />
          </div>

          <div id="classes" className="mt-12 rounded-xl border bg-card p-6 shadow-sm">
            <SectionHeader eyebrow="Today" title="Today's mats" description="Tap a time to hold it, then finish on the booking page." />
            <div className="mt-6">
              <AvailabilityGrid
                slots={["07:00", "08:00", "09:15", "12:00", "17:30", "18:30", "19:30"]}
                taken={["08:00", "18:30"]}
                value={slot}
                onSelect={setSlot}
              />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              {slot ? `Holding ${slot} — continue on the booking page.` : "Tap a time to hold it."}
            </p>
            {slot && (
              <Link to="/book" search={{ time: slot }} className="mt-2 inline-block text-sm font-medium underline underline-offset-4">
                Continue to book {slot} →
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-10">
        <TrustStrip
          items={[
            { title: "Six mats to a class", description: "Small enough that the teacher knows your name" },
            { title: "All levels welcome", description: "Every class is taught with options in either direction" },
            { title: "No membership to start", description: "Drop in, then decide" },
          ]}
        />
      </section>

      <section id="prices" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <SectionHeader
            eyebrow="Classes"
            title="What it costs"
            description="Pay as you go, or ask about the monthly unlimited once you know it's for you."
          />
          <PriceList
            className="mt-8"
            items={[
              { name: "Slow Flow", description: "Gentle, breath-led, good for stiff mornings", price: 14, meta: "60 min" },
              { name: "Vinyasa", description: "Moving with the breath, builds heat", price: 16, meta: "60 min" },
              { name: "Restorative", description: "Props, stillness, long holds", price: 14, meta: "60 min" },
              { name: "Beginners' course", description: "Six weeks, the same small group throughout", price: 75, meta: "6 weeks" },
            ]}
            action={{ label: "Book", onSelect: (r) => { location.hash = "#/book"; } }}
          />
        </div>
      </section>

      <section id="teachers" className="mx-auto max-w-5xl px-6 py-16">
        <SectionHeader eyebrow="Who teaches" title="Meet the teachers" description="Every class names its teacher on the timetable, so you know who you're getting." />
        {teachers.isPending && (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
          </div>
        )}
        {teachers.isError && (
          <p className="mt-8 text-sm text-destructive">Couldn't load the teachers. Refresh and try again.</p>
        )}
        {teachers.data?.length === 0 && (
          <Empty className="mt-8" title="No teachers listed yet" description="Check back soon — the timetable is on its way." />
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
          <SectionHeader eyebrow="Kind words" title="From the mats" />
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            <Testimonial item={{ quote: "Started with the beginners' course terrified I'd be the stiffest person in the room. Nobody was watching — everyone's just breathing.", name: "Priya Shah", role: "Tuesday evenings" }} />
            <Testimonial item={{ quote: "Six mats means the teacher actually corrects you. I've learned more here in a month than a year at the big chain.", name: "Tom Sackville", role: "Slow Flow regular" }} />
          </div>
        </div>
      </section>

      <section id="find-us" className="mx-auto grid max-w-5xl gap-10 px-6 py-16 sm:grid-cols-2">
        <div>
          <SectionHeader eyebrow="Find us" title="The studio" />
          <div className="mt-6 max-w-sm"><OpeningHours days={HOURS} /></div>
        </div>
        <LocationCard
          className="self-start"
          name="Aurora Yoga"
          address="22 Mill Lane, Bristol BS1 6EF"
          note="Above the bakery — buzz for Aurora. Bring a mat or borrow one at the desk."
        />
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-20">
        <CtaBand title="A mat is usually free today" description="Book in thirty seconds — we confirm by email." action={{ label: "Book now", href: "#/book" }} />
      </section>
    </SiteChrome>
  );
}
