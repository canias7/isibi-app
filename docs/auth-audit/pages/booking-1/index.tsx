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
import { Skeleton } from "@/components/ui/skeleton";
import { TeamGrid } from "@/components/ui/team-grid";
import { Testimonial } from "@/components/ui/testimonial";
import { TrustStrip } from "@/components/ui/trust-strip";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: Home });

type Teacher = Row & { name: string; bio: string | null; photo_url: string | null };

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A calm, well-taught practice — every level, every day.",
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

function Home() {
  const navigate = useNavigate();
  const teachers = useRows<Teacher>("teachers", { order: "name", dir: "asc" });

  return (
    <SiteChrome {...CHROME}>
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Studio &amp; online</p>
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">Aurora Yoga</h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                Slow mornings, strong flows, and a studio that remembers your name. Book a mat in thirty seconds.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground motion-press" to="/book">
                  Book now
                </Link>
                <Link className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" to="/work">
                  See the studio
                </Link>
                <OpenNow hours={HOURS.map((h) => ({ day: h.day, open: h.open!, close: h.close! }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <SafeImage src={null} alt="" fallbackSeed="aurora-hero-1" ratio="1/1" />
              <SafeImage src={null} alt="" fallbackSeed="aurora-hero-2" ratio="1/1" />
              <SafeImage src={null} alt="" fallbackSeed="aurora-hero-3" ratio="1/1" />
              <SafeImage src={null} alt="" fallbackSeed="aurora-hero-4" ratio="1/1" />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <TrustStrip
          items={[
            { title: "Every level welcome", description: "From absolute beginner to daily practitioner" },
            { title: "Small classes", description: "We cap at eighteen mats so teachers can actually teach" },
            { title: "No membership lock-in", description: "Drop in, or book a block — your call" },
          ]}
        />
      </section>

      <section id="classes" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <SectionHeader
            eyebrow="Today"
            title="Today's mats"
            description="Pick a time on the booking page — slots already taken are greyed out."
          />
          <div className="mt-8 grid gap-8 lg:grid-cols-[1.35fr_1fr]">
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <AvailabilityGrid
                slots={["07:00", "09:00", "12:15", "17:30", "18:30", "19:45"]}
                taken={[]}
                value={null}
                onSelect={() => navigate({ to: "/book" })}
              />
              <p className="mt-4 text-sm text-muted-foreground">Tap a time to start your booking.</p>
            </div>
            <SafeImage src={null} alt="" fallbackSeed="aurora-studio" ratio="4/3" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeader
          eyebrow="Classes"
          title="What we teach"
          description="Every class ends with proper savasana — never rushed for the next slot."
        />
        <PriceList
          className="mt-8"
          items={[
            { name: "Vinyasa Flow", description: "Breath-led, building through the hour", price: 14, meta: "60 min" },
            { name: "Slow & Restorative", description: "Long holds, blankets and blocks", price: 12, meta: "60 min" },
            { name: "Hatha Fundamentals", description: "Alignment-first, ideal to start with", price: 12, meta: "75 min" },
            { name: "Power Yoga", description: "Strength-built sequences, a proper sweat", price: 15, meta: "55 min" },
            { name: "Yin", description: "Deep tissue and stillness, candlelit", price: 12, meta: "75 min" },
          ]}
          action={{ label: "Book", onSelect: (row) => navigate({ to: "/book", search: { service: row.name } }) }}
        />
      </section>

      <section id="teachers" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <SectionHeader eyebrow="Who teaches" title="Meet the teachers" description="Ask for whoever you loved last time — it's on your booking either way." />
          {teachers.isPending && (
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-56 rounded-xl" />
              ))}
            </div>
          )}
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
          <Testimonial
            item={{
              quote: "Three years in and I still leave every class a little lighter. The teaching is properly good.",
              name: "Priya Shah",
              role: "Tuesday regular",
            }}
          />
          <Testimonial
            item={{
              quote: "Started terrified I'd be the worst in the room. Nobody made me feel that way once.",
              name: "Owen Fitzgerald",
              role: "Hatha Fundamentals",
            }}
          />
        </div>
      </section>

      <section id="find-us" className="border-y border-border bg-muted/40">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 sm:grid-cols-2">
          <div>
            <SectionHeader eyebrow="Find us" title="Where we practise" />
            <div className="mt-6 max-w-sm">
              <OpeningHours days={HOURS} />
            </div>
          </div>
          <LocationCard
            className="self-start"
            name="Aurora Yoga Studio"
            address="18 Meadow Lane, Bristol BS1 4ND"
            note="Above the deli, first floor. Mats provided; bring your own if you have a favourite."
          />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <CtaBand
          title="There's usually a mat free today"
          description="Book in thirty seconds — we'll confirm by email."
          action={{ label: "Book now", href: "/book" }}
        />
      </section>
    </SiteChrome>
  );
}
