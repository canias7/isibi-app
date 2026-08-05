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
  tagline: "A calm, well-lit room for whatever your practice needs today.",
  links: [
    { label: "Classes", href: "#classes" },
    { label: "Teachers", href: "#teachers" },
    { label: "Find us", href: "#find-us" },
    { label: "The work", href: "/work" },
  ],
  action: { label: "Book now", href: "/book" },
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

const CLASSES = [
  { name: "Slow Flow", description: "A gentle, breath-led hour to start or end a day", price: 14, meta: "60 min" },
  { name: "Vinyasa", description: "Stronger, faster, a proper sweat", price: 16, meta: "60 min" },
  { name: "Restorative", description: "Bolsters and blankets — mostly held, mostly still", price: 14, meta: "75 min" },
  { name: "Beginners' Foundations", description: "No experience needed, small class size", price: 12, meta: "45 min" },
  { name: "Private session", description: "One to one, tailored to what you're working on", price: 55, meta: "60 min" },
];

function Home() {
  const teachers = useRows<Teacher>("teachers", { order: "name", dir: "asc" });
  const navigate = useNavigate();
  const [slot, setSlot] = useState<string | null>(null);

  return (
    <SiteChrome {...CHROME}>
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Aurora Yoga</p>
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">Check today's availability</h1>
              <p className="mt-4 max-w-lg text-lg leading-relaxed text-muted-foreground">
                Small classes, a quiet room, and a slot that's usually free the same day.
              </p>
            </div>
            <OpenNow hours={HOURS.map((h) => ({ day: h.day, open: h.open!, close: h.close! }))} />
          </div>

          <div className="mt-8 rounded-xl border bg-card p-6 shadow-sm">
            <AvailabilityGrid
              slots={["07:00", "08:00", "09:30", "11:00", "12:30", "17:30", "18:30", "19:30"]}
              taken={["09:30", "18:30"]}
              value={slot}
              onSelect={setSlot}
            />
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <p className="text-sm text-muted-foreground">
                {slot ? `Holding ${slot} — pick a class on the booking page.` : "Tap a time to hold it."}
              </p>
              <a
                className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground motion-press"
                href="/book"
              >
                {slot ? `Continue to book ${slot}` : "Book now"}
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-10">
        <TrustStrip
          items={[
            { title: "Small classes", description: "Never more than fourteen on the mat" },
            { title: "All levels welcome", description: "Every class notes who it suits" },
            { title: "Mats provided", description: "Turn up empty-handed, we've got you" },
          ]}
        />
      </section>

      <section id="classes" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <SectionHeader
            eyebrow="The timetable"
            title="Classes and prices"
            description="Drop in to any class — no membership required, though regulars usually settle on two a week."
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
          description="Every teacher trained at least 200 hours; most of us keep training long after."
        />
        {teachers.isPending && <Skeleton className="mt-8 h-40 rounded-xl" />}
        {teachers.isError && (
          <p className="mt-8 text-sm text-destructive">Couldn't load the teachers. Refresh and try again.</p>
        )}
        {teachers.data?.length === 0 && (
          <Empty className="mt-8" title="No teachers listed yet" description="Check back soon — the team page is being put together." />
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
          <SectionHeader eyebrow="Kind words" title="What the room says" />
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            <Testimonial
              item={{
                quote: "I came for the beginners' class terrified and stayed for the restorative one. Both are exactly as advertised.",
                name: "Naomi Clarke",
                role: "Twice a week",
              }}
            />
            <Testimonial
              item={{
                quote: "Booked a slot on my phone in the lift up. Turned up, mat was waiting.",
                name: "Priya Shah",
                role: "Vinyasa regular",
              }}
            />
          </div>
        </div>
      </section>

      <section id="find-us" className="mx-auto grid max-w-5xl gap-10 px-6 py-16 sm:grid-cols-2">
        <div>
          <SectionHeader eyebrow="Find us" title="In the old print works" />
          <div className="mt-6 max-w-sm">
            <OpeningHours days={HOURS} />
          </div>
        </div>
        <LocationCard
          className="self-start"
          name="Aurora Yoga"
          address="Unit 4, The Print Works, 22 Foundry Lane"
          note="Up the stairs at the back. Bike racks outside, no on-site parking."
        />
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-20">
        <CtaBand
          title="There's usually a slot today"
          description="Book in thirty seconds — we confirm by email."
          action={{ label: "Book now", href: "/book" }}
        />
      </section>
    </SiteChrome>
  );
}
