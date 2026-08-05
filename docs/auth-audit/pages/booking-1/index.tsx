import { createFileRoute, Link } from "@tanstack/react-router";
import { useRows, type Row } from "@/lib/rows";
import { SiteChrome } from "@/components/ui/site-chrome";
import { AvailabilityGrid } from "@/components/ui/availability-grid";
import { CtaBand } from "@/components/ui/cta-band";
import { LocationCard } from "@/components/ui/location-card";
import { OpenNow } from "@/components/ui/open-now";
import { OpeningHours, type DayHours } from "@/components/ui/opening-hours";
import { PriceList } from "@/components/ui/price-list";
import { SectionHeader } from "@/components/ui/section-header";
import { TeamGrid } from "@/components/ui/team-grid";
import { TrustStrip } from "@/components/ui/trust-strip";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty } from "@/components/ui/empty";

export const Route = createFileRoute("/")({ component: Home });

type Teacher = Row & { name: string; bio: string | null; photo_url: string | null };

const HOURS: DayHours[] = [
  { day: 1, label: "Monday", open: "07:00", close: "20:00" },
  { day: 2, label: "Tuesday", open: "07:00", close: "20:00" },
  { day: 3, label: "Wednesday", open: "07:00", close: "20:30" },
  { day: 4, label: "Thursday", open: "07:00", close: "20:30" },
  { day: 5, label: "Friday", open: "07:00", close: "18:00" },
  { day: 6, label: "Saturday", open: "08:30", close: "14:00" },
  { day: 0, label: "Sunday", open: "09:00", close: "13:00" },
];

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A quiet studio for a steady practice.",
  links: [
    { label: "Classes", href: "#classes" },
    { label: "Teachers", href: "#teachers" },
    { label: "Find us", href: "#find-us" },
    { label: "Members", href: "#/members" },
  ],
  action: { label: "Book now", href: "#/book" },
};

const TODAY_SLOTS = ["07:00", "09:00", "10:30", "12:15", "17:30", "18:45", "19:30"];

function Home() {
  const teachers = useRows<Teacher>("teachers", { order: "name", dir: "asc" });

  return (
    <SiteChrome {...CHROME}>
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Aurora Yoga
              </p>
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">
                Aurora Yoga
              </h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                Small classes, proper attention, and a mat waiting for you most mornings and
                every evening. Check what's free today, or book straight in.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link
                  to="/book"
                  className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground motion-press"
                >
                  Book now
                </Link>
                <OpenNow
                  hours={HOURS.map((h) => ({ day: h.day, open: h.open!, close: h.close! }))}
                />
              </div>
            </div>
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <p className="text-sm font-medium">Today's slots</p>
              <AvailabilityGrid slots={TODAY_SLOTS} taken={["09:00", "18:45"]} />
              <Link
                to="/book"
                className="mt-4 inline-block text-sm font-medium underline underline-offset-4"
              >
                Check availability and book →
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <TrustStrip
          items={[
            { title: "Small classes", description: "Capped so every teacher can actually see you" },
            { title: "All levels welcome", description: "First class is never the hardest one" },
            { title: "Mats provided", description: "Turn up empty-handed if you like" },
          ]}
        />
      </section>

      <section id="classes" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <SectionHeader
            eyebrow="The timetable"
            title="Classes and drop-in prices"
            description="Pay as you go, or ask about a class card at the desk. Every price includes a mat if you need one."
          />
          <PriceList
            className="mt-8"
            items={[
              { name: "Morning Flow", description: "A gentle vinyasa to start the day", price: 14, meta: "60 min" },
              { name: "Hatha Fundamentals", description: "Slower, held postures — good for beginners", price: 14, meta: "60 min" },
              { name: "Power Vinyasa", description: "Strength and sweat, faster pace", price: 16, meta: "75 min" },
              { name: "Restorative & Yin", description: "Long holds, blankets and bolsters", price: 15, meta: "75 min" },
              { name: "Candlelit Slow Flow", description: "Our Friday evening wind-down", price: 16, meta: "60 min" },
            ]}
            action={{
              label: "Book",
              onSelect: (r) => {
                window.location.hash = `#/book?service=${encodeURIComponent(r.name)}`;
              },
            }}
          />
        </div>
      </section>

      <section id="teachers" className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeader
          eyebrow="Your teachers"
          title="Who's on the mat with you"
          description="Every class is led by one of these teachers — their names are on the timetable at the studio."
        />
        {teachers.isPending && (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          </div>
        )}
        {teachers.isError && (
          <p className="mt-8 text-sm text-destructive">
            Couldn't load the teachers. Refresh and try again.
          </p>
        )}
        {teachers.data?.length === 0 && (
          <Empty
            className="mt-8"
            title="No teachers listed yet"
            description="Check back soon — the team will be here shortly."
          />
        )}
        {!!teachers.data?.length && (
          <TeamGrid
            className="mt-8"
            items={teachers.data.map((t) => ({
              name: t.name,
              role: t.bio,
              photo: t.photo_url,
            }))}
          />
        )}
      </section>

      <section id="find-us" className="border-y border-border bg-muted/40">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 sm:grid-cols-2">
          <div>
            <SectionHeader eyebrow="Find us" title="In the studio" />
            <div className="mt-6 max-w-sm">
              <OpeningHours days={HOURS} />
            </div>
          </div>
          <LocationCard
            className="self-start"
            name="Aurora Yoga"
            address="22 Meadow Lane, Bristol BS1 4QT"
            note="Above the flower shop — buzz for Aurora and come up the stairs."
          />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <CtaBand
          title="There's usually space this week"
          description="Book a class in under a minute — no account needed."
          action={{ label: "Book now", href: "#/book" }}
        />
      </section>
    </SiteChrome>
  );
}
