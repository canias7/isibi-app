import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

import { useRows, type Row } from "@/lib/rows";
import { SiteChrome } from "@/components/ui/site-chrome";
import { AvailabilityGrid } from "@/components/ui/availability-grid";
import { CtaBand } from "@/components/ui/cta-band";
import { LocationCard } from "@/components/ui/location-card";
import { OpenNow } from "@/components/ui/open-now";
import { OpeningHours, type DayHours } from "@/components/ui/opening-hours";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { StatsBand } from "@/components/ui/stats-band";
import { TeamGrid } from "@/components/ui/team-grid";
import { TrustStrip } from "@/components/ui/trust-strip";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty } from "@/components/ui/empty";

export const Route = createFileRoute("/")({ component: Home });

type Teacher = Row & { name: string; bio: string | null; photo_url: string | null };

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A calm, well-lit studio — every class ends on time.",
  links: [
    { label: "Timetable", href: "#timetable" },
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
  { day: 6, label: "Saturday", open: "08:30", close: "13:00" },
  { day: 0, label: "Sunday", open: "08:30", close: "13:00" },
];

const SLOTS = ["07:30", "09:00", "10:30", "12:00", "17:30", "18:45"];

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
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Aurora Yoga</p>
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">Come as you are, leave a little steadier</h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                Vinyasa, restorative and everything between. Mats provided, no experience needed for our morning classes.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <a className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground motion-press" href="/book">Check availability</a>
                <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="#timetable">See today's classes</a>
                <OpenNow hours={HOURS.map((h) => ({ day: h.day, open: h.open!, close: h.close! }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <SafeImage src={null} alt="" fallbackSeed="studio-1" ratio="1/1" />
              <SafeImage src={null} alt="" fallbackSeed="studio-2" ratio="1/1" />
              <SafeImage src={null} alt="" fallbackSeed="studio-3" ratio="1/1" />
              <SafeImage src={null} alt="" fallbackSeed="studio-4" ratio="1/1" />
            </div>
          </div>
          <div className="mt-14 border-t border-border pt-10">
            <StatsBand
              items={[
                { value: "12", label: "Classes a week, from sunrise flow to evening restore" },
                { value: "4.9", label: "Average rating across 240 reviews" },
                { value: "18", label: "Mat spaces, so a full class is still spacious" },
                { value: "5 yr", label: "Running on the same corner of the high street" },
              ]}
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <TrustStrip
          items={[
            { title: "Beginners welcome", description: "Every morning class opens with the basics" },
            { title: "Small groups", description: "Eighteen mats, never packed wall to wall" },
            { title: "Props provided", description: "Blocks, straps and bolsters — just bring yourself" },
          ]}
        />
      </section>

      <section id="timetable" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <SectionHeader
            eyebrow="Today"
            title="Today's slots"
            description="Pick a time — we hold it for ten minutes while you finish booking."
          />
          <div className="mt-8 grid gap-8 lg:grid-cols-[1.35fr_1fr]">
            <div className="rounded-xl border bg-card p-6 shadow-sm motion-reveal">
              <AvailabilityGrid slots={SLOTS} taken={["09:00"]} value={slot} onSelect={setSlot} />
              <p className="mt-4 text-sm text-muted-foreground">
                {slot ? `Holding ${slot} — pick a class on the booking page.` : "Tap a time to hold it."}
              </p>
              {slot && (
                <a className="mt-2 inline-block text-sm font-medium underline underline-offset-4" href="/book">
                  Continue to book {slot} →
                </a>
              )}
            </div>
            <SafeImage src={null} alt="" fallbackSeed="studio-morning" ratio="4/3" />
          </div>
          <div className="mt-10 flex justify-center">
            <a className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground motion-press" href="/book">
              Book now
            </a>
          </div>
        </div>
      </section>

      <section id="teachers" className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeader eyebrow="Who's teaching" title="Our teachers" description="Ask for a class by teacher when you book — it's on the form." />
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
          <Empty className="mt-8" title="No teachers listed yet" description="Check back soon — our teachers will appear here." />
        )}
        {!!teachers.data?.length && (
          <TeamGrid
            className="mt-8"
            items={teachers.data.map((t) => ({ name: t.name, role: t.bio, photo: t.photo_url, fallbackSeed: t.name }))}
          />
        )}
        <div className="mt-10 flex justify-center">
          <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="/book">
            Book now
          </a>
        </div>
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <SectionHeader eyebrow="The work" title="Inside the studio" />
            <Link to="/work" className="text-sm font-medium underline underline-offset-4">
              The whole gallery →
            </Link>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <SafeImage src={null} alt="" fallbackSeed="gallery-home-1" ratio="4/3" />
            <SafeImage src={null} alt="" fallbackSeed="gallery-home-2" ratio="4/3" />
            <SafeImage src={null} alt="" fallbackSeed="gallery-home-3" ratio="4/3" />
          </div>
        </div>
      </section>

      <section id="find-us" className="mx-auto grid max-w-6xl gap-10 px-6 py-16 sm:grid-cols-2">
        <div>
          <SectionHeader eyebrow="Find us" title="On the high street" />
          <div className="mt-6 max-w-sm">
            <OpeningHours days={HOURS} />
          </div>
        </div>
        <LocationCard
          className="self-start"
          name="Aurora Yoga"
          address="22 Middle Street, Brighton BN1 4AB"
          note="Upstairs above the bookshop. Bike racks outside, no parking on Middle Street itself."
        />
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <CtaBand
          title="There's usually a mat free this week"
          description="Book in thirty seconds — we confirm by email."
          action={{ label: "Book now", href: "/book" }}
        />
      </section>
    </SiteChrome>
  );
}
