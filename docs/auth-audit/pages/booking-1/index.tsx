import { useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useRows, type Row } from "@/lib/rows";
import { SiteChrome } from "@/components/ui/site-chrome";
import { AvailabilityGrid } from "@/components/ui/availability-grid";
import { CtaBand } from "@/components/ui/cta-band";
import { OpenNow } from "@/components/ui/open-now";
import { OpeningHours, type DayHours } from "@/components/ui/opening-hours";
import { PriceList } from "@/components/ui/price-list";
import { SectionHeader } from "@/components/ui/section-header";
import { TeamGrid } from "@/components/ui/team-grid";
import { Testimonial } from "@/components/ui/testimonial";
import { TrustStrip } from "@/components/ui/trust-strip";
import { LocationCard } from "@/components/ui/location-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty } from "@/components/ui/empty";

export const Route = createFileRoute("/")({ component: Home });

type Teacher = Row & { name: string; bio: string | null; photo_url: string | null };

const CHROME = {
  name: "Aurora Yoga",
  tagline: "Slow mornings, strong afternoons — a studio for every kind of practice.",
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
  { day: 6, label: "Saturday", open: "08:30", close: "14:00" },
  { day: 0, label: "Sunday", open: "09:00", close: "13:00" },
];

const SLOTS = ["07:00", "08:15", "09:30", "12:00", "17:30", "18:45", "19:30"];

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
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">Aurora Yoga</h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                Small classes, real teaching, and a mat waiting whether you're new to the room or ten years in.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <a className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground motion-press" href="/book">
                  Book now
                </a>
                <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="/work">
                  See the studio
                </a>
                <OpenNow hours={HOURS.map((h) => ({ day: h.day, open: h.open!, close: h.close! }))} />
              </div>
            </div>
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <SectionHeader eyebrow="Today" title="Today's classes" description="Tap a time to hold your mat." />
              <div className="mt-6">
                <AvailabilityGrid slots={SLOTS} taken={["08:15", "18:45"]} value={slot} onSelect={setSlot} />
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                {slot ? `Holding ${slot} — finish up on the booking page.` : "Pick a time to continue."}
              </p>
              {slot && (
                <a className="mt-2 inline-block text-sm font-medium underline underline-offset-4" href="/book">
                  Continue to book {slot} →
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <TrustStrip
          items={[
            { title: "Small classes", description: "Capped so a teacher can actually see you" },
            { title: "All levels welcome", description: "Every class marked by pace, not just name" },
            { title: "Mats provided", description: "Come as you are — bring water" },
          ]}
        />
      </section>

      <section id="classes" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <SectionHeader
            eyebrow="Classes"
            title="What's on"
            description="Drop into any class, or find your regular slot."
          />
          <PriceList
            className="mt-8"
            items={[
              { name: "Sunrise Flow", description: "Gentle vinyasa to start the day", price: 14, meta: "60 min" },
              { name: "Strong Vinyasa", description: "A faster, sweatier practice", price: 16, meta: "60 min" },
              { name: "Restorative", description: "Slow, supported, mostly on the floor", price: 14, meta: "75 min" },
              { name: "Beginners' Foundations", description: "The postures, properly explained", price: 14, meta: "60 min" },
              { name: "Candlelit Yin", description: "Long holds, low light, Thursday evenings", price: 15, meta: "60 min" },
            ]}
            action={{ label: "Book", onSelect: (r) => navigate({ to: "/book", search: { service: r.name } }) }}
          />
        </div>
      </section>

      <section id="teachers" className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeader eyebrow="The teachers" title="Who you'll practise with" />
        {teachers.isPending && <Skeleton className="mt-8 h-40 rounded-xl" />}
        {teachers.isError && (
          <p className="mt-8 text-sm text-destructive">Couldn't load the teachers. Refresh and try again.</p>
        )}
        {teachers.data?.length === 0 && (
          <div className="mt-8">
            <Empty title="Teachers coming soon" description="We're adding the team here shortly." />
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
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <SectionHeader eyebrow="Kind words" title="From the mats" />
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            <Testimonial
              item={{
                quote: "Started with Beginners' Foundations terrified I'd fall over. A year on I'm in Strong Vinyasa twice a week.",
                name: "Priya Rao",
                role: "Regular, Tuesdays",
              }}
            />
            <Testimonial
              item={{
                quote: "The Thursday Yin class is the best hour of my week, no contest.",
                name: "Owen Marsh",
                role: "Thursday evenings",
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
          address="22 Bellhouse Lane, Bristol BS6 5RT"
          note="Above the deli — the studio entrance is the blue door round the side."
        />
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <CtaBand
          title="Your mat is usually free today"
          description="Book in thirty seconds — we'll confirm by email."
          action={{ label: "Book now", href: "/book" }}
        />
      </section>
    </SiteChrome>
  );
}
