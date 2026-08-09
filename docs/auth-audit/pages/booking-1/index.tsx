import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRows, type Row } from "@/lib/rows";
import { SiteChrome } from "@/components/ui/site-chrome";
import { AvailabilityGrid } from "@/components/ui/availability-grid";
import { CtaBand } from "@/components/ui/cta-band";
import { LocationCard } from "@/components/ui/location-card";
import { OpenNow } from "@/components/ui/open-now";
import { OpeningHours, type DayHours } from "@/components/ui/opening-hours";
import { PriceList } from "@/components/ui/price-list";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { StatsBand } from "@/components/ui/stats-band";
import { TeamGrid } from "@/components/ui/team-grid";
import { Testimonial } from "@/components/ui/testimonial";
import { TrustStrip } from "@/components/ui/trust-strip";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty } from "@/components/ui/empty";

export const Route = createFileRoute("/")({ component: Home });

type Teacher = Row & { name: string; bio: string | null; photo_url: string | null };

const HOURS: DayHours[] = [
  { day: 1, label: "Monday", open: "07:00", close: "20:00" },
  { day: 2, label: "Tuesday", open: "07:00", close: "20:00" },
  { day: 3, label: "Wednesday", open: "07:00", close: "20:00" },
  { day: 4, label: "Thursday", open: "07:00", close: "20:00" },
  { day: 5, label: "Friday", open: "07:00", close: "18:00" },
  { day: 6, label: "Saturday", open: "08:00", close: "14:00" },
  { day: 0, label: "Sunday", open: "08:00", close: "12:00" },
];

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A calm room, a good floor, teachers who remember your name.",
  links: [
    { label: "Classes", href: "#prices" },
    { label: "Teachers", href: "#teachers" },
    { label: "The work", href: "/work" },
    { label: "Find us", href: "#find-us" },
    { label: "Account", href: "/account" },
  ],
  action: { label: "Book now", href: "/book" },
};

function Home() {
  const teachers = useRows<Teacher>("teachers", { order: "name", dir: "asc" });
  const navigate = useNavigate();
  const [slot, setSlot] = useState<string | null>(null);

  return (
    <SiteChrome {...CHROME}>
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Studio · Riverside</p>
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">Aurora Yoga</h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                Small classes, a warm floor, and teachers who notice when your knee is complaining. Check today's slots and book straight in.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link to="/book" className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground">Book now</Link>
                <Link to="/work" className="rounded-md border border-border px-5 py-2.5 text-sm font-medium">See the studio</Link>
                <OpenNow hours={HOURS.map((h) => ({ day: h.day, open: h.open!, close: h.close! }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <SafeImage src={null} alt="Morning flow class, full mats" ratio="1/1" fallbackSeed="a" />
              <SafeImage src={null} alt="A restorative class, low light" ratio="1/1" fallbackSeed="b" />
              <SafeImage src={null} alt="Teacher adjusting a student's pose" ratio="1/1" fallbackSeed="c" />
              <SafeImage src={null} alt="The studio floor, empty before opening" ratio="1/1" fallbackSeed="d" />
            </div>
          </div>
          <div className="mt-14 border-t border-border pt-10">
            <StatsBand items={[
              { value: "12", label: "Classes a week, across all levels" },
              { value: "4.9", label: "Average rating from our members" },
              { value: "16", label: "Mats — small enough for real attention" },
              { value: "7 yrs", label: "Teaching on this floor" },
            ]} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <TrustStrip items={[
          { title: "Small classes", description: "Sixteen mats, never squeezed" },
          { title: "All levels welcome", description: "First class is always guided one-to-one on request" },
          { title: "Mats and props provided", description: "Turn up empty-handed" },
        ]} />
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <SectionHeader eyebrow="Today" title="Today's slots" description="Pick a time — we hold it for ten minutes while you finish booking." />
          <div className="mt-8 grid gap-8 lg:grid-cols-[1.35fr_1fr]">
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <AvailabilityGrid
                slots={["07:00", "08:00", "09:15", "12:00", "17:30", "18:30", "19:30"]}
                taken={["08:00", "18:30"]}
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
            <SafeImage src={null} alt="The studio, mats laid out for class" ratio="4/3" fallbackSeed="today" />
          </div>
        </div>
      </section>

      <section id="prices" className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeader eyebrow="The timetable" title="Classes and prices" description="Drop in to any class, or ask about a class card at the studio." />
        <PriceList
          className="mt-8"
          items={[
            { name: "Morning Flow", description: "A steady vinyasa to start the day", price: 14, meta: "60 min" },
            { name: "Restorative", description: "Slow, supported, mostly on the floor", price: 14, meta: "60 min" },
            { name: "Strong Vinyasa", description: "Building heat, for a steady practice", price: 16, meta: "75 min" },
            { name: "Beginners", description: "The fundamentals, no experience needed", price: 12, meta: "45 min" },
            { name: "Yin", description: "Long holds, deep and quiet", price: 14, meta: "60 min" },
          ]}
          action={{ label: "Book", onSelect: (r) => navigate({ to: "/book", search: { service: r.name } }) }}
        />
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <SectionHeader eyebrow="The studio" title="A look inside" />
            <Link to="/work" className="text-sm font-medium underline underline-offset-4">The full gallery →</Link>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <SafeImage src={null} alt="Sun salutations, full room" ratio="4/3" fallbackSeed="g1" />
            <SafeImage src={null} alt="A quiet Yin class" ratio="4/3" fallbackSeed="g2" />
            <SafeImage src={null} alt="Props stacked and ready" ratio="4/3" fallbackSeed="g3" />
          </div>
        </div>
      </section>

      <section id="teachers" className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeader eyebrow="Who teaches" title="Meet the teachers" description="Ask for whoever suits your practice — it's noted on your booking either way." />
        {teachers.isPending && (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-56 rounded-xl" />
            ))}
          </div>
        )}
        {teachers.isError && (
          <p className="mt-8 text-sm text-destructive">Couldn't load the teachers. Refresh and try again.</p>
        )}
        {teachers.data?.length === 0 && (
          <div className="mt-8">
            <Empty title="No teachers listed yet" description="Check back soon — the team is being added." />
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
            <Testimonial item={{ quote: "The Yin class undid a year of desk-shoulders. I go every Thursday now.", name: "Priya Shah", role: "Yin, weekly" }} />
            <Testimonial item={{ quote: "Never more than a handful of us on the mats. Feels like actual teaching, not a class you're squeezed into.", name: "Owen Fairclough", role: "Morning Flow regular" }} />
          </div>
        </div>
      </section>

      <section id="find-us" className="mx-auto grid max-w-6xl gap-10 px-6 py-16 sm:grid-cols-2">
        <div>
          <SectionHeader eyebrow="Find us" title="By the river" />
          <div className="mt-6 max-w-sm"><OpeningHours days={HOURS} /></div>
        </div>
        <LocationCard className="self-start" name="Aurora Yoga" address="4 Millrace Walk, Bristol BS1 6XN" note="Above the boat house — the door is round the side, up one flight." />
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <CtaBand title="A mat is usually free today" description="Book in thirty seconds — we confirm by email." action={{ label: "Book now", href: "/book" }} />
      </section>
    </SiteChrome>
  );
}
