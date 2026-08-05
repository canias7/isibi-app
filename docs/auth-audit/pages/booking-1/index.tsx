import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRows, type Row } from "@/lib/rows";
import { AvailabilityGrid } from "@/components/ui/availability-grid";
import { CtaBand } from "@/components/ui/cta-band";
import { LocationCard } from "@/components/ui/location-card";
import { OpenNow } from "@/components/ui/open-now";
import { OpeningHours, type DayHours } from "@/components/ui/opening-hours";
import { PriceList } from "@/components/ui/price-list";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { Skeleton } from "@/components/ui/skeleton";
import { SiteChrome } from "@/components/ui/site-chrome";
import { TeamGrid } from "@/components/ui/team-grid";
import { Testimonial } from "@/components/ui/testimonial";
import { TrustStrip } from "@/components/ui/trust-strip";
import { Empty } from "@/components/ui/empty";

export const Route = createFileRoute("/")({ component: Home });

type Teacher = Row & { name: string; bio: string | null; photo_url: string | null };

const CHROME = {
  name: "Aurora Yoga",
  tagline: "Slow mornings, strong practice — a studio on the high street.",
  links: [
    { label: "Classes", href: "#classes" },
    { label: "Teachers", href: "#teachers" },
    { label: "Find us", href: "#find-us" },
  ],
  action: { label: "Book now", href: "#/book" },
};

const HOURS: DayHours[] = [
  { day: 1, label: "Monday", open: "07:00", close: "20:00" },
  { day: 2, label: "Tuesday", open: "07:00", close: "20:00" },
  { day: 3, label: "Wednesday", open: "07:00", close: "20:00" },
  { day: 4, label: "Thursday", open: "07:00", close: "20:00" },
  { day: 5, label: "Friday", open: "07:00", close: "19:00" },
  { day: 6, label: "Saturday", open: "08:30", close: "14:00" },
  { day: 0, label: "Sunday", open: "09:00", close: "13:00" },
];

const SLOTS = ["07:00", "08:15", "09:30", "12:00", "17:30", "18:45"];

function Home() {
  const teachers = useRows<Teacher>("teachers", { order: "name", dir: "asc" });
  const navigate = useNavigate();

  return (
    <SiteChrome {...CHROME}>
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_1fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                The high street studio
              </p>
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">
                Aurora Yoga
              </h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                Vinyasa, slow flow and restorative classes, six days a week. Mats provided —
                just bring yourself.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <a
                  className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground motion-press"
                  href="#/book"
                >
                  Book now
                </a>
                <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="#/work">
                  See the studio
                </a>
                <OpenNow
                  hours={HOURS.map((h) => ({ day: h.day, open: h.open!, close: h.close! }))}
                />
              </div>
            </div>
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <SectionHeader eyebrow="Today" title="Check availability" align="left" />
              <AvailabilityGrid slots={SLOTS} taken={["08:15", "17:30"]} />
              <a
                className="mt-4 inline-block text-sm font-medium underline underline-offset-4"
                href="#/book"
              >
                Continue to book →
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <TrustStrip
          items={[
            { title: "Small classes", description: "Capped at fourteen so everyone gets adjusted" },
            { title: "All levels welcome", description: "Modifications offered, never assumed" },
            { title: "Mats and props included", description: "Arrive as you are" },
          ]}
        />
      </section>

      <section id="classes" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <SectionHeader
            eyebrow="The timetable"
            title="This week's classes"
            description="Every class is drop-in — no membership needed to book one."
          />
          <PriceList
            className="mt-8"
            items={[
              { name: "Sunrise Vinyasa", description: "A moving practice to start the day", price: 14, meta: "Mon, Wed, Fri · 07:00" },
              { name: "Slow Flow", description: "Gentle, breath-led movement", price: 12, meta: "Tue, Thu · 09:30" },
              { name: "Power Hour", description: "Strength and sweat, one hour", price: 15, meta: "Mon, Wed · 18:45" },
              { name: "Restorative", description: "Long holds, props, low light", price: 13, meta: "Sun · 09:00" },
              { name: "Beginners' Flow", description: "The fundamentals, no rush", price: 12, meta: "Sat · 08:30" },
            ]}
            action={{
              label: "Book",
              onSelect: (r) => navigate({ to: "/book", search: { class: r.name } }),
            }}
          />
        </div>
      </section>

      <section id="teachers" className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeader
          eyebrow="The teachers"
          title="Who's on the mat"
          description="Ask which class suits you when you book — we're happy to point you the right way."
        />
        {teachers.isPending && <Skeleton className="mt-8 h-40 rounded-xl" />}
        {teachers.isError && (
          <p className="mt-8 text-sm text-destructive">Couldn't load the teachers. Refresh and try again.</p>
        )}
        {teachers.data?.length === 0 && (
          <div className="mt-8">
            <Empty title="No teachers listed yet" description="Check back soon for the team behind the mats." />
          </div>
        )}
        {!!teachers.data?.length && (
          <TeamGrid
            className="mt-8"
            items={teachers.data.map((t) => ({ name: t.name, role: t.bio, photo: t.photo_url }))}
          />
        )}
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <SectionHeader eyebrow="Kind words" title="From the mats" />
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            <Testimonial
              item={{
                quote:
                  "Started with Beginners' Flow terrified I'd be the least flexible person in the room. Nobody was watching but me.",
                name: "Priya Shah",
                role: "Saturday regular",
              }}
            />
            <Testimonial
              item={{
                quote: "Sunrise Vinyasa before work changed my whole week. Small class, always a mat free.",
                name: "Tom Ridley",
                role: "Three mornings a week",
              }}
            />
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
          address="27 Fore Street, Bristol BS1 4HA"
          note="Above the bookshop — buzz for Aurora. Bike racks out front, no dedicated parking."
        />
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <CtaBand
          title="There's usually a mat free this week"
          description="Book in thirty seconds — we'll see you on the mat."
          action={{ label: "Book now", href: "#/book" }}
        />
      </section>
    </SiteChrome>
  );
}
