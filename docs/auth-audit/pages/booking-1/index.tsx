import { createFileRoute, Link } from "@tanstack/react-router";
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
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: Home });

type Teacher = Row & { name: string; bio: string | null; photo_url: string | null };

const HOURS: DayHours[] = [
  { day: 1, label: "Monday", open: "07:00", close: "20:30" },
  { day: 2, label: "Tuesday", open: "07:00", close: "20:30" },
  { day: 3, label: "Wednesday", open: "07:00", close: "20:30" },
  { day: 4, label: "Thursday", open: "07:00", close: "20:30" },
  { day: 5, label: "Friday", open: "07:00", close: "19:00" },
  { day: 6, label: "Saturday", open: "08:30", close: "14:00" },
  { day: 0, label: "Sunday", open: "09:00", close: "13:00" },
];

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A quiet studio, a full timetable.",
  links: [
    { label: "Classes", href: "#classes" },
    { label: "Teachers", href: "#teachers" },
    { label: "The studio", href: "/work" },
    { label: "Find us", href: "#find-us" },
  ],
  action: { label: "Book now", href: "/book" },
};

function Home() {
  const teachers = useRows<Teacher>("teachers", { order: "name", dir: "asc" });
  const navigate = useNavigate();

  return (
    <SiteChrome {...CHROME}>
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Aurora Yoga</p>
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">Check today's availability</h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                Vinyasa, restorative and everything in between. Pick a class below, or book straight from the timetable.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <a className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground motion-press" href="/book">Book now</a>
                <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="#classes">See the timetable</a>
                <OpenNow hours={HOURS.map((h) => ({ day: h.day, open: h.open!, close: h.close! }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <SafeImage src="@@IMG:a sunlit yoga studio with mats laid out in rows@@" alt="" ratio="1/1" fallbackSeed="studio-1" />
              <SafeImage src="@@IMG:a teacher demonstrating a standing yoga pose@@" alt="" ratio="1/1" fallbackSeed="studio-2" />
              <SafeImage src="@@IMG:close-up of folded yoga mats and blocks@@" alt="" ratio="1/1" fallbackSeed="studio-3" />
              <SafeImage src="@@IMG:a small group class mid-pose, calm lighting@@" alt="" ratio="1/1" fallbackSeed="studio-4" />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <TrustStrip
          items={[
            { title: "Small classes", description: "Capped at fourteen, so you get looked at" },
            { title: "All levels welcome", description: "Every class marked by pace, not just name" },
            { title: "Mats provided", description: "Turn up in whatever you'd move in" },
          ]}
        />
      </section>

      <section id="classes" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <SectionHeader eyebrow="Today" title="Today's classes" description="Times shown are this evening's — book to hold your mat." />
          <div className="mt-8 grid gap-8 lg:grid-cols-[1.35fr_1fr]">
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <AvailabilityGrid
                slots={["07:00", "09:00", "12:15", "17:30", "18:30", "19:45"]}
                taken={["09:00", "18:30"]}
              />
              <p className="mt-4 text-sm text-muted-foreground">Tap a class on the booking page to hold your spot.</p>
              <a className="mt-2 inline-block text-sm font-medium underline underline-offset-4" href="/book">
                Continue to book →
              </a>
            </div>
            <SafeImage src="@@IMG:rows of yoga mats in a warmly lit studio, empty before class@@" alt="" ratio="4/3" fallbackSeed="studio-5" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeader eyebrow="The classes" title="What's on" description="Every class is 60 minutes unless noted. Drop-ins welcome; regulars save with a pass." />
        <PriceList
          className="mt-8"
          items={[
            { name: "Vinyasa Flow", description: "Breath-led, building through the week", price: 14, meta: "60 min" },
            { name: "Restorative", description: "Slow, supported, mostly on the floor", price: 14, meta: "60 min" },
            { name: "Hatha Foundations", description: "Steady postures, good for beginners", price: 14, meta: "60 min" },
            { name: "Power Hour", description: "Faster pace, more heat, no chanting", price: 15, meta: "45 min" },
            { name: "Prenatal", description: "Gentle and specific, small numbers", price: 15, meta: "50 min" },
            { name: "Drop-in class pass, 5 classes", description: "Use across any class, three-month expiry", price: 60, meta: "pass" },
          ]}
          action={{ label: "Book", onSelect: (r) => navigate({ to: "/book", search: { service: r.name } }) }}
        />
      </section>

      <section id="teachers" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <SectionHeader eyebrow="Who teaches" title="Meet the teachers" description="Each brings their own pace and focus — the timetable notes who's leading which class." />
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
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeader eyebrow="Kind words" title="From the mats" />
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          <Testimonial item={{ quote: "The restorative class on a Tuesday is the best hour of my week. Never overbooked, never rushed.", name: "Priya Shah", role: "Regular, Tuesdays" }} />
          <Testimonial item={{ quote: "Started with Hatha Foundations knowing nothing. Six months on I've never missed a Thursday.", name: "Tom Fairweather", role: "Thursday Flow" }} />
        </div>
      </section>

      <section id="find-us" className="border-y border-border bg-muted/40">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 sm:grid-cols-2">
          <div>
            <SectionHeader eyebrow="Find us" title="The studio" />
            <div className="mt-6 max-w-sm">
              <OpeningHours days={HOURS} />
            </div>
          </div>
          <LocationCard className="self-start" name="Aurora Yoga" address="22 Meadow Lane, Bristol BS1 4ND" note="Above the health-food shop. Bikes round the back, no car park." />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <CtaBand title="Your mat is usually free tonight" description="Book in thirty seconds — we confirm by email." action={{ label: "Book now", href: "/book" }} />
      </section>
    </SiteChrome>
  );
}
