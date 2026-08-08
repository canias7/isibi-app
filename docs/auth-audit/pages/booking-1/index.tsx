import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
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

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A quiet studio for a steady practice.",
  links: [
    { label: "Classes", href: "#classes" },
    { label: "Teachers", href: "#teachers" },
    { label: "Find us", href: "#find-us" },
    { label: "The studio", href: "#/work" },
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

const CLASSES = [
  { name: "Sunrise Flow", description: "A moving warm-up into a full vinyasa sequence", price: 16, meta: "60 min" },
  { name: "Slow Hatha", description: "Held postures, close attention to alignment", price: 15, meta: "60 min" },
  { name: "Restorative", description: "Props, blankets, long holds — the wind-down class", price: 14, meta: "55 min" },
  { name: "Power Vinyasa", description: "Stronger pace, for an established practice", price: 17, meta: "60 min" },
  { name: "Beginners' Foundations", description: "The postures and the breath, explained properly", price: 15, meta: "75 min" },
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
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Aurora Yoga</p>
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">A steady practice, on a mat that's yours for the hour</h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                Small classes, proper instruction, and a room that stays quiet. Book a class below or check what's free today.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <a className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground motion-press" href="#/book">Book now</a>
                <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="#/work">See the studio</a>
                <OpenNow hours={HOURS.map((h) => ({ day: h.day, open: h.open!, close: h.close! }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <SafeImage src="@@IMG:a bright yoga studio room with mats laid out in rows and morning light@@" alt="" ratio="1/1" fallbackSeed="a" />
              <SafeImage src="@@IMG:a yoga teacher demonstrating a standing pose to a small class@@" alt="" ratio="1/1" fallbackSeed="b" />
              <SafeImage src="@@IMG:close up of hands in a seated meditation pose@@" alt="" ratio="1/1" fallbackSeed="c" />
              <SafeImage src="@@IMG:a row of neatly stacked yoga blocks and folded blankets@@" alt="" ratio="1/1" fallbackSeed="d" />
            </div>
          </div>
          <div className="mt-14 border-t border-border pt-10">
            <StatsBand items={[
              { value: "14", label: "Classes on the timetable each week" },
              { value: "12", label: "Mats per room, so nobody's crowded" },
              { value: "4.9", label: "Average rating from regulars" },
              { value: "5 yr", label: "How long the studio has been on this street" },
            ]} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <TrustStrip items={[
          { title: "Small classes", description: "Capped so there's room for hands-on correction" },
          { title: "Mats provided", description: "Bring nothing but yourself" },
          { title: "Beginners welcome", description: "Every class notes who it suits" },
        ]} />
      </section>

      <section id="classes" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <SectionHeader eyebrow="Today" title="Check availability" description="Pick a time — we hold it for ten minutes while you finish booking." />
          <div className="mt-8 grid gap-8 lg:grid-cols-[1.35fr_1fr]">
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <AvailabilityGrid
                slots={["07:00", "08:00", "09:15", "12:00", "17:30", "18:30", "19:30"]}
                taken={["08:00", "18:30"]}
                value={slot}
                onSelect={setSlot}
              />
              <p className="mt-4 text-sm text-muted-foreground">{slot ? `Holding ${slot} — finish up on the booking page.` : "Tap a time to hold it."}</p>
              {slot && <a className="mt-2 inline-block text-sm font-medium underline underline-offset-4" href="#/book">Continue to book {slot} →</a>}
            </div>
            <SafeImage src="@@IMG:a calm empty yoga studio room ready for a class, mats rolled out" alt="" ratio="4/3" fallbackSeed="room" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeader eyebrow="The timetable" title="Classes and prices" description="Drop in to any class, or ask about a ten-class pass at the desk." />
        <PriceList
          className="mt-8"
          items={CLASSES}
          action={{ label: "Book", onSelect: (r) => { location.hash = `#/book?service=${encodeURIComponent(r.name)}`; } }}
        />
      </section>

      <section id="teachers" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <SectionHeader eyebrow="Who teaches" title="Meet the teachers" description="Every class lists who's leading it on the timetable." />
          {teachers.isPending && (
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
            </div>
          )}
          {teachers.isError && (
            <p className="mt-8 text-sm text-destructive">Couldn't load the teachers. Refresh and try again.</p>
          )}
          {teachers.data?.length === 0 && (
            <Empty className="mt-8" title="No teachers listed yet" description="Check back soon — we're adding profiles." />
          )}
          {!!teachers.data?.length && (
            <TeamGrid
              className="mt-8"
              items={teachers.data.map((t) => ({ name: t.name, role: t.bio, photo: t.photo_url }))}
            />
          )}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeader eyebrow="Kind words" title="From the mats" />
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          <Testimonial item={{ quote: "The Slow Hatha class fixed a knot in my shoulder no amount of stretching at home ever touched.", name: "Priya Shah", role: "Tuesday regular" }} />
          <Testimonial item={{ quote: "Started at Foundations knowing nothing. A year on I'm in Power Vinyasa twice a week.", name: "Callum Doyle", role: "Beginner, a year ago" }} />
        </div>
      </section>

      <section id="find-us" className="border-y border-border bg-muted/40">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 sm:grid-cols-2">
          <div>
            <SectionHeader eyebrow="Find us" title="In the old chapel hall" />
            <div className="mt-6 max-w-sm"><OpeningHours days={HOURS} /></div>
          </div>
          <LocationCard className="self-start" name="Aurora Yoga" address="22 Chapel Walk, Bristol BS6 5QT" note="Up the side alley, door on the left. Bikes can go in the rack by the gate." />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <CtaBand title="There's usually a spot on the mat tonight" description="Book in thirty seconds — we confirm by email." action={{ label: "Book now", href: "#/book" }} />
      </section>
    </SiteChrome>
  );
}
