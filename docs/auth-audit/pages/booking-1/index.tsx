import { createFileRoute, Link } from "@tanstack/react-router";
import { useRows, type Row } from "@/lib/rows";
import { SiteChrome } from "@/components/ui/site-chrome";
import { OpenNow } from "@/components/ui/open-now";
import { OpeningHours, type DayHours } from "@/components/ui/opening-hours";
import { PriceList } from "@/components/ui/price-list";
import { TeamGrid } from "@/components/ui/team-grid";
import { LocationCard } from "@/components/ui/location-card";
import { SectionHeader } from "@/components/ui/section-header";
import { CtaBand } from "@/components/ui/cta-band";
import { Testimonial } from "@/components/ui/testimonial";
import { TrustStrip } from "@/components/ui/trust-strip";
import { SafeImage } from "@/components/ui/safe-image";
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
  tagline: "A quiet studio for a steady practice.",
  links: [
    { label: "Timetable", href: "#timetable" },
    { label: "Teachers", href: "#teachers" },
    { label: "The studio", href: "/work" },
    { label: "Find us", href: "#find-us" },
  ],
  action: { label: "Book now", href: "/book" },
};

const CLASSES = [
  { name: "Morning Flow", description: "Vinyasa to wake the body up, mixed levels", price: 14, meta: "7:15am · 45 min" },
  { name: "Slow & Steady", description: "Hatha-paced, good for a first class", price: 14, meta: "10:00am · 60 min" },
  { name: "Power Hour", description: "Stronger flow, some experience helpful", price: 16, meta: "6:00pm · 60 min" },
  { name: "Restorative", description: "Long holds, blankets and bolsters", price: 14, meta: "7:30pm · 60 min" },
  { name: "Weekend Flow", description: "An easier pace to start the weekend", price: 14, meta: "Sat 9:00am · 60 min" },
];

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
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">A steady practice, close to home</h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                Small classes, proper mats, no mirrors. Book a class in thirty seconds — we hold your spot.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link to="/book" className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground motion-press">
                  Book now
                </Link>
                <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="#timetable">
                  See the timetable
                </a>
                <OpenNow hours={HOURS.map((h) => ({ day: h.day, open: h.open!, close: h.close! }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <SafeImage src={null} alt="A quiet studio room, mats laid out" ratio="1/1" fallbackSeed="studio-1" />
              <SafeImage src={null} alt="Morning light across the floor" ratio="1/1" fallbackSeed="studio-2" />
              <SafeImage src={null} alt="A class mid-flow" ratio="1/1" fallbackSeed="studio-3" />
              <SafeImage src={null} alt="Blankets and bolsters, ready" ratio="1/1" fallbackSeed="studio-4" />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <TrustStrip
          items={[
            { title: "Small classes", description: "Capped so a teacher can actually see you" },
            { title: "All levels welcome", description: "First class is on us — ask when you book" },
            { title: "Mats provided", description: "Bring nothing but yourself" },
          ]}
        />
      </section>

      <section id="timetable" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <SectionHeader eyebrow="This week" title="The timetable" description="Pick a class below — it carries straight into the booking form." />
          <PriceList
            className="mt-8"
            items={CLASSES}
            action={{ label: "Book", onSelect: (r) => navigate({ to: "/book", search: { class: r.name } }) }}
          />
        </div>
      </section>

      <section id="teachers" className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeader eyebrow="The teachers" title="Who's leading class" description="Every teacher trained 200+ hours; most have taught here for years." />
        {teachers.isPending && (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
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
          <SectionHeader eyebrow="Kind words" title="What people say" />
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            <Testimonial
              item={{
                quote: "I'd never done yoga before. Nobody made me feel behind — I go twice a week now.",
                name: "Priya Shah",
                role: "Slow & Steady regular",
              }}
            />
            <Testimonial
              item={{
                quote: "Restorative on a Thursday night undoes the whole week.",
                name: "Tom Delaney",
                role: "Thursday evenings",
              }}
            />
          </div>
        </div>
      </section>

      <section id="find-us" className="mx-auto grid max-w-6xl gap-10 px-6 py-16 sm:grid-cols-2">
        <div>
          <SectionHeader eyebrow="Find us" title="The studio" />
          <div className="mt-6 max-w-sm">
            <OpeningHours days={HOURS} />
          </div>
        </div>
        <LocationCard
          className="self-start"
          name="Aurora Yoga"
          address="22 Mill Lane, Bristol BS6 5TF"
          note="Above the plant shop. Bike racks out front, no car parking on site."
        />
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <CtaBand
          title="Most classes have room this week"
          description="Book in thirty seconds — we'll email your confirmation."
          action={{ label: "Book now", href: "/book" }}
        />
      </section>
    </SiteChrome>
  );
}
