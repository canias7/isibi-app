import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRows, type Row } from "@/lib/rows";
import { SiteChrome } from "@/components/ui/site-chrome";
import { AvailabilityGrid } from "@/components/ui/availability-grid";
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

const HOURS: DayHours[] = [
  { day: 1, label: "Monday", open: "07:00", close: "20:00" },
  { day: 2, label: "Tuesday", open: "07:00", close: "20:00" },
  { day: 3, label: "Wednesday", open: "07:00", close: "20:00" },
  { day: 4, label: "Thursday", open: "07:00", close: "20:00" },
  { day: 5, label: "Friday", open: "07:00", close: "19:00" },
  { day: 6, label: "Saturday", open: "08:30", close: "13:00" },
  { day: 0, label: "Sunday", open: "09:00", close: "12:00" },
];

const CLASSES = [
  { name: "Sunrise Vinyasa", description: "A flowing, breath-led practice to start the day", price: 14, meta: "60 min" },
  { name: "Slow Hatha", description: "Gentle holds, careful alignment", price: 12, meta: "60 min" },
  { name: "Power Flow", description: "Stronger, faster, sweatier", price: 15, meta: "55 min" },
  { name: "Restorative & Yin", description: "Long holds, blankets and bolsters", price: 13, meta: "75 min" },
  { name: "Beginners' Foundations", description: "The postures explained properly, no rush", price: 12, meta: "50 min" },
];

const SLOTS = ["07:00", "09:00", "10:15", "12:00", "17:30", "18:30", "19:30"];

function Home() {
  const navigate = useNavigate();
  const teachers = useRows<Teacher>("teachers", { order: "name", dir: "asc" });

  return (
    <SiteChrome
      name="Aurora Yoga"
      tagline="A calm, well-lit studio a short walk from the station."
      links={[
        { label: "Classes", href: "#prices" },
        { label: "The work", href: "/work" },
        { label: "Teachers", href: "#teachers" },
        { label: "Find us", href: "#find-us" },
      ]}
      action={{ label: "Check availability", href: "/book" }}
    >
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Studio on Mill Lane
              </p>
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">
                Aurora Yoga
              </h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                Vinyasa, Hatha and Yin, taught by teachers who know your name by
                the third class. Book a mat below.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link
                  className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground motion-press"
                  to="/book"
                >
                  Check availability
                </Link>
                <Link className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" to="/work">
                  See the studio
                </Link>
                <OpenNow
                  hours={HOURS.map((h) => ({ day: h.day, open: h.open!, close: h.close! }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <SafeImage src={null} alt="Mats laid out before sunrise class" ratio="1/1" fallbackSeed="a" />
              <SafeImage src={null} alt="Teacher adjusting a downward dog" ratio="1/1" fallbackSeed="b" />
              <SafeImage src={null} alt="The studio, empty and lit" ratio="1/1" fallbackSeed="c" />
              <SafeImage src={null} alt="Restorative class with bolsters" ratio="1/1" fallbackSeed="d" />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <TrustStrip
          items={[
            { title: "Small classes", description: "Never more than sixteen on a mat" },
            { title: "All levels welcome", description: "Every class marked by pace, not just name" },
            { title: "Mats and blocks provided", description: "Bring water and a towel, nothing else" },
          ]}
        />
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <SectionHeader
            eyebrow="Today"
            title="This morning's mats"
            description="An illustration of a typical day — the booking page checks the date you actually want."
          />
          <div className="mt-8 grid gap-8 lg:grid-cols-[1.35fr_1fr]">
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <AvailabilityGrid slots={SLOTS} taken={["09:00", "18:30"]} />
              <p className="mt-4 text-sm text-muted-foreground">
                Pick a class and date on the booking page — we hold your mat once you submit.
              </p>
              <Link to="/book" className="mt-2 inline-block text-sm font-medium underline underline-offset-4">
                Continue to book →
              </Link>
            </div>
            <SafeImage src={null} alt="A quiet moment before class begins" ratio="4/3" fallbackSeed="e" />
          </div>
        </div>
      </section>

      <section id="prices" className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeader
          eyebrow="The classes"
          title="What's on"
          description="Drop in to any class — no membership required, though regulars usually settle on two a week."
        />
        <PriceList
          className="mt-8"
          items={CLASSES}
          action={{
            label: "Book",
            onSelect: (r) => navigate({ to: "/book", search: { class: r.name } }),
          }}
        />
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <SectionHeader eyebrow="The studio" title="A look inside" />
            <Link className="text-sm font-medium underline underline-offset-4" to="/work">
              The whole gallery →
            </Link>
          </div>
          <Gallery
            className="mt-8"
            columns={3}
            items={[
              { alt: "Sunrise Vinyasa, full room", caption: "Sunrise Vinyasa" },
              { alt: "Yin class with bolsters", caption: "Restorative & Yin" },
              { alt: "A teacher adjusting a pose", caption: "Hands-on adjustment" },
              { alt: "The studio floor, morning light", caption: "Morning light on the floor" },
            ]}
          />
        </div>
      </section>

      <section id="teachers" className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeader eyebrow="Who teaches" title="Meet the teachers" description="Every class names its teacher when you book." />
        {teachers.isPending && (
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
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
                quote: "I'd never done yoga before Foundations. Six months on I'm in Power Flow twice a week.",
                name: "Rosa Fenwick",
                role: "Twice-a-week regular",
              }}
            />
            <Testimonial
              item={{
                quote: "Small classes make the difference — there's always time for an adjustment if you need one.",
                name: "Tom Aldridge",
                role: "Sunrise Vinyasa",
              }}
            />
          </div>
        </div>
      </section>

      <section id="find-us" className="mx-auto grid max-w-6xl gap-10 px-6 py-16 sm:grid-cols-2">
        <div>
          <SectionHeader eyebrow="Find us" title="On Mill Lane" />
          <div className="mt-6 max-w-sm">
            <OpeningHours days={HOURS} />
          </div>
        </div>
        <LocationCard
          className="self-start"
          name="Aurora Yoga"
          address="18 Mill Lane, Bristol BS1 6PN"
          note="Above the bakery. Bike racks out front, no on-site parking."
        />
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <CtaBand
          title="There's usually a mat free tonight"
          description="Book in under a minute — you'll get a confirmation straight away."
          action={{ label: "Check availability", href: "/book" }}
        />
      </section>
    </SiteChrome>
  );
}
