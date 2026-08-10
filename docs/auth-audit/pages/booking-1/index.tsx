import { useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
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
import { TeamGrid } from "@/components/ui/team-grid";
import { Testimonial } from "@/components/ui/testimonial";
import { TrustStrip } from "@/components/ui/trust-strip";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty } from "@/components/ui/empty";

export const Route = createFileRoute("/")({ component: Home });

type Teacher = Row & { name: string; bio: string | null; photo_url: string | null };

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A calm studio room, six classes a day.",
  links: [
    { label: "Classes", href: "#classes" },
    { label: "Teachers", href: "#teachers" },
    { label: "The work", href: "/work" },
    { label: "Find us", href: "#find-us" },
  ],
  action: { label: "Check availability", href: "/book" },
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
  { name: "Morning Flow", description: "A gentle vinyasa to open the day", price: 14, meta: "60 min" },
  { name: "Vinyasa", description: "Stronger pace, breath-led", price: 16, meta: "60 min" },
  { name: "Yin & Restore", description: "Long holds, blankets and blocks", price: 14, meta: "75 min" },
  { name: "Beginners' Foundations", description: "The postures, slowly, with time to ask", price: 12, meta: "45 min" },
  { name: "Prenatal", description: "Safe shapes for every trimester", price: 15, meta: "60 min" },
];

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
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Aurora Yoga</p>
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">A room to slow down in, most mornings and every evening</h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                Small classes, mats and blocks provided. Pick a time below and we'll hold it while you finish booking.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <a className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground motion-press" href="/book">Check availability</a>
                <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="/work">See the studio</a>
                <OpenNow hours={HOURS.map((h) => ({ day: h.day, open: h.open!, close: h.close! }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <SafeImage src="@@IMG:a bright yoga studio room with mats laid out in rows@@" alt="" ratio="1/1" fallbackSeed="studio-1" />
              <SafeImage src="@@IMG:a teacher demonstrating a seated stretch to a small class@@" alt="" ratio="1/1" fallbackSeed="studio-2" />
              <SafeImage src="@@IMG:blocks and blankets stacked neatly by a studio wall@@" alt="" ratio="1/1" fallbackSeed="studio-3" />
              <SafeImage src="@@IMG:morning light through a studio window during a yoga class@@" alt="" ratio="1/1" fallbackSeed="studio-4" />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <TrustStrip items={[
          { title: "Small classes", description: "Capped so there's room to be seen and corrected" },
          { title: "All levels welcome", description: "Every class notes who it best suits" },
          { title: "Mats provided", description: "Turn up as you are" },
        ]} />
      </section>

      <section id="today" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <SectionHeader eyebrow="Today" title="Today's slots" description="Pick a time; we hold it for ten minutes while you choose the class." />
          <div className="mt-8 grid gap-8 lg:grid-cols-[1.35fr_1fr]">
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <AvailabilityGrid
                slots={["07:00", "08:30", "10:00", "12:00", "17:30", "18:45", "19:30"]}
                taken={["08:30", "18:45"]} value={slot} onSelect={setSlot} />
              <p className="mt-4 text-sm text-muted-foreground">{slot ? `Holding ${slot} — finish up on the booking page.` : "Tap a time to hold it."}</p>
              {slot && (
                <a className="mt-2 inline-block text-sm font-medium underline underline-offset-4" href={`/book?time=${encodeURIComponent(slot)}`}>Continue to book {slot} →</a>
              )}
            </div>
            <SafeImage src="@@IMG:an empty studio room ready for the next class, soft morning light@@" alt="" ratio="4/3" fallbackSeed="studio-empty" />
          </div>
        </div>
      </section>

      <section id="classes" className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeader eyebrow="The timetable" title="Classes and prices" description="Drop into any class as a one-off, or ask about a course price once you know what you like." />
        <PriceList className="mt-8" items={CLASSES} action={{ label: "Book", onSelect: (r) => navigate({ to: "/book", search: { class: r.name } }) }} />
        <div className="mt-8"><CtaBand title="Not sure which class?" description="Foundations is the right place to start if you're new." action={{ label: "Check availability", href: "/book" }} /></div>
      </section>

      <section id="teachers" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <SectionHeader eyebrow="Who teaches" title="The teachers" description="Every class names who's leading it — book with someone you like." />
          {teachers.isPending && <Skeleton className="mt-8 h-40 rounded-xl" />}
          {teachers.isError && <p className="mt-8 text-sm text-destructive">Couldn't load the teachers. Refresh and try again.</p>}
          {teachers.data?.length === 0 && (
            <div className="mt-8"><Empty title="No teachers listed yet" description="Check back soon — the studio is adding profiles." /></div>
          )}
          {!!teachers.data?.length && (
            <TeamGrid className="mt-8" items={teachers.data.map((t) => ({ name: t.name, role: t.bio, photo: t.photo_url, fallbackSeed: t.name }))} />
          )}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeader eyebrow="Kind words" title="From the mat" />
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          <Testimonial item={{ quote: "Foundations got me flat-footed in downward dog for the first time in years. No pressure, just patience.", name: "Ruth Adeyemi", role: "Beginners, Tuesdays" }} />
          <Testimonial item={{ quote: "Yin on a Sunday is the best hour of my week. I book it the moment the timetable opens.", name: "Owen Blackwood", role: "Yin & Restore, weekly" }} />
        </div>
      </section>

      <section id="find-us" className="border-y border-border bg-muted/40">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 sm:grid-cols-2">
          <div>
            <SectionHeader eyebrow="Find us" title="On the high street" />
            <div className="mt-6 max-w-sm"><OpeningHours days={HOURS} /></div>
          </div>
          <LocationCard className="self-start" name="Aurora Yoga" address="22 Milton Street, Bristol BS1 4RY" note="Above the health food shop. Bikes can be locked in the courtyard." />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <CtaBand title="There's usually a mat free tonight" description="Check availability and book in under a minute." action={{ label: "Check availability", href: "/book" }} />
      </section>
    </SiteChrome>
  );
}
