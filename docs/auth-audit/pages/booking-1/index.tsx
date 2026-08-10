import { createFileRoute, Link } from "@tanstack/react-router";
import { useRows, type Row } from "@/lib/rows";
import { SiteChrome } from "@/components/ui/site-chrome";
import { CtaBand } from "@/components/ui/cta-band";
import { LocationCard } from "@/components/ui/location-card";
import { OpenNow } from "@/components/ui/open-now";
import { OpeningHours, type DayHours } from "@/components/ui/opening-hours";
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
  tagline: "A calm room, a good floor, and a class most evenings.",
  links: [
    { label: "Classes", href: "#classes" },
    { label: "Teachers", href: "#teachers" },
    { label: "Find us", href: "#find-us" },
    { label: "The work", href: "/work" },
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
  { name: "Sunrise Flow", time: "07:00", day: "Mon, Wed, Fri", level: "All levels" },
  { name: "Vinyasa", time: "09:30", day: "Tue, Thu", level: "Intermediate" },
  { name: "Slow & Restorative", time: "18:00", day: "Mon, Wed", level: "All levels" },
  { name: "Power Hour", time: "18:30", day: "Tue, Thu", level: "Experienced" },
  { name: "Candlelit Yin", time: "20:00", day: "Wed, Fri", level: "All levels" },
  { name: "Saturday Stretch", time: "09:00", day: "Sat", level: "All levels" },
];

function Home() {
  const teachers = useRows<Teacher>("teachers", { order: "name", dir: "asc" });

  return (
    <SiteChrome {...CHROME}>
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Studio classes, every day
              </p>
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">
                Aurora Yoga
              </h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                A quiet room off the high street, a good floor underfoot, and a class
                running most evenings. Book a mat in under a minute.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link
                  to="/book"
                  className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground motion-press"
                >
                  Book now
                </Link>
                <Link to="/work" className="rounded-md border border-border px-5 py-2.5 text-sm font-medium">
                  See the studio
                </Link>
                <OpenNow hours={HOURS.map((h) => ({ day: h.day, open: h.open!, close: h.close! }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <SafeImage src={null} alt="" ratio="1/1" fallbackSeed="a" />
              <SafeImage src={null} alt="" ratio="1/1" fallbackSeed="b" />
              <SafeImage src={null} alt="" ratio="1/1" fallbackSeed="c" />
              <SafeImage src={null} alt="" ratio="1/1" fallbackSeed="d" />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <TrustStrip
          items={[
            { title: "Beginner-friendly", description: "Every class welcomes a first-timer" },
            { title: "Small groups", description: "We cap classes so teachers can actually see you" },
            { title: "Mats provided", description: "Turn up empty-handed if you like" },
          ]}
        />
      </section>

      <section id="classes" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <SectionHeader
            eyebrow="The timetable"
            title="This week's classes"
            description="Every class takes a booking; walk-ins are welcome if there's space left on the mat."
          />
          <ul className="mt-8 grid gap-3 sm:grid-cols-2 motion-stagger">
            {CLASSES.map((c) => (
              <li
                key={c.name}
                className="flex items-center justify-between rounded-xl border border-border bg-card p-5 shadow-sm"
              >
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {c.day} · {c.time} · {c.level}
                  </p>
                </div>
                <Link
                  to="/book"
                  search={{ class: c.name }}
                  className="rounded-md border border-border px-4 py-2 text-sm font-medium"
                >
                  Book
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="teachers" className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeader
          eyebrow="Who teaches"
          title="Meet the teachers"
          description="Every class is led by one of us — ask for whoever suits your pace."
        />
        {teachers.isPending && <Skeleton className="mt-8 h-48 rounded-xl" />}
        {teachers.isError && (
          <p className="mt-8 text-sm text-destructive">
            Couldn't load the teachers. Refresh and try again.
          </p>
        )}
        {teachers.data?.length === 0 && (
          <Empty className="mt-8" title="No teachers listed yet" description="Check back soon." />
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
                quote:
                  "I was terrified of my first class. Nobody made me feel behind — I've been back every week since.",
                name: "Freya Holt",
                role: "Sunrise Flow regular",
              }}
            />
            <Testimonial
              item={{
                quote: "The Wednesday Yin class is the best hour of my week, full stop.",
                name: "Priya Chandra",
                role: "Candlelit Yin",
              }}
            />
          </div>
        </div>
      </section>

      <section id="find-us" className="mx-auto grid max-w-6xl gap-10 px-6 py-16 sm:grid-cols-2">
        <div>
          <SectionHeader eyebrow="Find us" title="Come and try a class" />
          <div className="mt-6 max-w-sm">
            <OpeningHours days={HOURS} />
          </div>
        </div>
        <LocationCard
          className="self-start"
          name="Aurora Yoga"
          address="22 Meadow Lane, Bristol BS6 5RT"
          note="Above the health food shop. Bikes welcome inside; parking on Meadow Lane after 6pm."
        />
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <CtaBand
          title="There's usually a mat free tonight"
          description="Book in thirty seconds — we'll confirm by email."
          action={{ label: "Book now", href: "/book" }}
        />
      </section>
    </SiteChrome>
  );
}
