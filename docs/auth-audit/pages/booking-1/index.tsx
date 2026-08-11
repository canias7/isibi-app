import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRows, type Row } from "@/lib/rows";
import { SiteChrome } from "@/components/ui/site-chrome";
import { WeekStrip } from "@/components/ui/week-strip";
import { CtaBand } from "@/components/ui/cta-band";
import { Gallery } from "@/components/ui/gallery";
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

export const Route = createFileRoute("/")({ component: Home });

type Teacher = Row & { name: string; bio: string | null; photo_url: string | null };

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A calm, well-lit studio for every kind of practice.",
  links: [
    { label: "Classes", href: "#classes" },
    { label: "The teachers", href: "#teachers" },
    { label: "The studio", href: "/work" },
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

const CLASSES = [
  { name: "Sunrise Flow", description: "A gentle vinyasa to start the day", price: 16, meta: "60 min" },
  { name: "Power Vinyasa", description: "Strength and breath, a proper sweat", price: 18, meta: "75 min" },
  { name: "Slow & Restorative", description: "Long holds, blankets and blocks", price: 16, meta: "60 min" },
  { name: "Hatha Fundamentals", description: "Alignment-focused, good for beginners", price: 14, meta: "60 min" },
  { name: "Yin & Sound Bath", description: "Deep stretch closing with a gong bath", price: 20, meta: "90 min" },
];

function Home() {
  const teachers = useRows<Teacher>("teachers", { order: "name", dir: "asc" });
  const navigate = useNavigate();
  const [day, setDay] = useState<string | null>(null);
  const start = new Date();
  start.setDate(start.getDate() - start.getDay());

  return (
    <SiteChrome {...CHROME}>
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Aurora Yoga</p>
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">Come as you are, leave a little lighter</h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                Small classes, proper heating in winter, and teachers who remember your name after the first visit.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <a className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground motion-press" href="/book">Book now</a>
                <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="#classes">See classes</a>
                <OpenNow hours={HOURS.map((h) => ({ day: h.day, open: h.open!, close: h.close! }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <SafeImage src="@@IMG:a bright, well-lit yoga studio with mats laid out in rows@@" alt="The main studio floor" ratio="1/1" />
              <SafeImage src="@@IMG:a yoga teacher demonstrating a standing pose to a small class@@" alt="A teacher leading a pose" ratio="1/1" fallbackSeed="teacher" />
              <SafeImage src="@@IMG:rolled yoga mats and blocks stacked neatly on a wooden shelf@@" alt="Mats and props ready for class" ratio="1/1" fallbackSeed="props" />
              <SafeImage src="@@IMG:soft morning light coming through large studio windows onto a wooden floor@@" alt="Morning light in the studio" ratio="1/1" fallbackSeed="light" />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <TrustStrip items={[
          { title: "Small classes", description: "Capped at eighteen, so teachers can actually see you" },
          { title: "All levels welcome", description: "Every class notes who it suits" },
          { title: "Mats provided", description: "Turn up empty-handed if you like" },
        ]} />
      </section>

      <section id="classes" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <SectionHeader eyebrow="This week" title="Pick a day, then a class" description="Availability updates as people book — the exact times are confirmed on the booking page." />
          <div className="mt-8 rounded-xl border bg-card p-6 shadow-sm">
            <WeekStrip start={start} value={day} onSelect={setDay} />
            <p className="mt-4 text-sm text-muted-foreground">
              {day ? `Looking at ${day} — choose a class and time on the booking page.` : "Tap a day to see what fits."}
            </p>
            <a className="mt-3 inline-block text-sm font-medium underline underline-offset-4" href="/book">Continue to book →</a>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeader eyebrow="The timetable" title="Classes and drop-in prices" description="Pay as you go, or ask about our ten-class card at the desk." />
        <PriceList
          className="mt-8"
          items={CLASSES}
          action={{ label: "Book", onSelect: (r) => navigate({ to: "/book", search: { class: r.name } }) }}
        />
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <SectionHeader eyebrow="The studio" title="A look inside" />
            <Link to="/work" className="text-sm font-medium underline underline-offset-4">The whole gallery →</Link>
          </div>
          <Gallery className="mt-8" columns={3} items={[
            { src: "@@IMG:a row of students in a seated meditation pose, eyes closed@@", alt: "A class settling in", fallbackSeed: "g1" },
            { src: "@@IMG:a close-up of bare feet on a yoga mat mid-pose@@", alt: "Mid-flow, feet grounded", fallbackSeed: "g2" },
            { src: "@@IMG:a wide shot of a sunlit studio during a warrior pose sequence@@", alt: "Warrior sequence at sunrise", fallbackSeed: "g3" },
          ]} />
        </div>
      </section>

      <section id="teachers" className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeader eyebrow="Who teaches" title="Meet the teachers" description="Every class page tells you who's leading it — ask at the desk if you'd like to try someone new." />
        {teachers.isPending && <Skeleton className="mt-8 h-40 rounded-xl" />}
        {teachers.isError && (
          <p className="mt-8 text-sm text-destructive">Couldn't load the teachers. Refresh and try again.</p>
        )}
        {teachers.data?.length === 0 && (
          <p className="mt-8 text-sm text-muted-foreground">Teacher profiles are coming soon.</p>
        )}
        {!!teachers.data?.length && (
          <TeamGrid
            className="mt-8"
            items={teachers.data.map((t) => ({ name: t.name, role: t.bio, photo: t.photo_url, fallbackSeed: t.name }))}
          />
        )}
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <SectionHeader eyebrow="Kind words" title="What students say" />
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            <Testimonial item={{ quote: "I was terrified of my first class. Nobody made me feel behind, and now it's the best hour of my week.", name: "Priya Shah", role: "Slow & Restorative, twice weekly" }} />
            <Testimonial item={{ quote: "Small enough that the teacher actually corrects your alignment, not just calls out poses.", name: "Tom Fenwick", role: "Power Vinyasa regular" }} />
          </div>
        </div>
      </section>

      <section id="find-us" className="mx-auto grid max-w-6xl gap-10 px-6 py-16 sm:grid-cols-2">
        <div>
          <SectionHeader eyebrow="Find us" title="Come and visit" />
          <div className="mt-6 max-w-sm"><OpeningHours days={HOURS} /></div>
        </div>
        <LocationCard className="self-start" name="Aurora Yoga" address="48 Millbank Row, Bristol BS6 5TF" note="Above the deli, entrance round the side. Bike racks out front, no dedicated parking." />
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <CtaBand title="There's a class most evenings this week" description="Book now — you'll get a confirmation and a reminder before it starts." action={{ label: "Book now", href: "/book" }} />
      </section>
    </SiteChrome>
  );
}
