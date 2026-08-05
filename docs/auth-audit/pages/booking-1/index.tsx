import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
import { Testimonial } from "@/components/ui/testimonial";
import { TrustStrip } from "@/components/ui/trust-strip";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty } from "@/components/ui/empty";
import { useState } from "react";

export const Route = createFileRoute("/")({ component: Home });

type Teacher = Row & { name: string; bio: string | null; photo_url: string | null };

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A calm room, a steady practice.",
  links: [
    { label: "Timetable", href: "#timetable" },
    { label: "Prices", href: "#prices" },
    { label: "Teachers", href: "#teachers" },
    { label: "The work", href: "#/work" },
    { label: "Find us", href: "#find-us" },
  ],
  action: { label: "Book now", href: "#/book" },
};

const HOURS: DayHours[] = [
  { day: 1, label: "Monday", open: "07:00", close: "20:30" },
  { day: 2, label: "Tuesday", open: "07:00", close: "20:30" },
  { day: 3, label: "Wednesday", open: "07:00", close: "20:30" },
  { day: 4, label: "Thursday", open: "07:00", close: "20:30" },
  { day: 5, label: "Friday", open: "07:00", close: "19:00" },
  { day: 6, label: "Saturday", open: "09:00", close: "13:00" },
  { day: 0, label: "Sunday", open: "09:00", close: "13:00" },
];

const CLASSES = [
  { name: "Slow Flow", description: "Long holds, careful breath — a good first class", price: 14, meta: "60 min" },
  { name: "Vinyasa", description: "A moving practice, building through the week", price: 16, meta: "60 min" },
  { name: "Restorative", description: "Props, blankets, almost no movement at all", price: 14, meta: "75 min" },
  { name: "Ashtanga (led)", description: "The primary series, called out loud", price: 18, meta: "90 min" },
  { name: "Drop-in single class", description: "Any class, no commitment", price: 16, meta: "per class" },
];

function Home() {
  const teachers = useRows<Teacher>("teachers", { order: "name", dir: "asc" });
  const navigate = useNavigate();
  const [slot, setSlot] = useState<string | null>(null);

  return (
    <SiteChrome {...CHROME}>
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Aurora Yoga</p>
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">A room to slow down in</h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                Small classes, real teaching, mats provided. Book a class below or check today's spaces first.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <a className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground motion-press" href="#/book">Book now</a>
                <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="#timetable">See the timetable</a>
                <OpenNow hours={HOURS.map((h) => ({ day: h.day, open: h.open!, close: h.close! }))} />
              </div>
            </div>
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <SectionHeader eyebrow="Today" title="Check today's spaces" align="left" />
              <AvailabilityGrid
                className="mt-6"
                slots={["07:30", "09:00", "12:15", "17:30", "18:45", "19:45"]}
                taken={["09:00", "18:45"]}
                value={slot}
                onSelect={setSlot}
              />
              <p className="mt-4 text-sm text-muted-foreground">
                {slot ? `Holding ${slot} — pick a class on the booking page.` : "Tap a time to hold it."}
              </p>
              {slot && (
                <a
                  className="mt-2 inline-block text-sm font-medium underline underline-offset-4"
                  href="#/book"
                >
                  Continue to book {slot} →
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <TrustStrip
          items={[
            { title: "Small classes", description: "Capped so the teacher can actually see you" },
            { title: "Mats and props provided", description: "Turn up empty-handed" },
            { title: "No membership required", description: "Drop in whenever suits" },
          ]}
        />
      </section>

      <section id="timetable" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <SectionHeader
            eyebrow="This week"
            title="The timetable"
            description="Classes run most weekday mornings and evenings, with a shorter weekend session. Exact times are confirmed when you book."
          />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { day: "Monday", line: "7:00 Slow Flow · 18:00 Vinyasa" },
              { day: "Tuesday", line: "9:00 Restorative · 19:00 Ashtanga" },
              { day: "Wednesday", line: "7:00 Vinyasa · 18:00 Slow Flow" },
              { day: "Thursday", line: "9:00 Vinyasa · 19:00 Restorative" },
              { day: "Friday", line: "7:00 Slow Flow" },
              { day: "Saturday", line: "9:30 Ashtanga (led)" },
            ].map((d) => (
              <div key={d.day} className="rounded-lg border bg-card p-4">
                <p className="text-sm font-medium">{d.day}</p>
                <p className="mt-1 text-sm text-muted-foreground">{d.line}</p>
              </div>
            ))}
          </div>
          <div className="mt-8">
            <a className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground motion-press" href="#/book">Book a class</a>
          </div>
        </div>
      </section>

      <section id="prices" className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeader eyebrow="Prices" title="Classes and rates" description="Pay as you go, or ask in studio about a class pack." />
        <PriceList
          className="mt-8"
          items={CLASSES}
          action={{
            label: "Book",
            onSelect: (r) => navigate({ to: "/book", search: { class: r.name } }),
          }}
        />
      </section>

      <section id="teachers" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <SectionHeader eyebrow="The teachers" title="Who's teaching" description="Ask for whoever you'd like — it's noted on your booking." />
          {teachers.isPending && (
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-48 rounded-xl" />
              ))}
            </div>
          )}
          {teachers.isError && (
            <p className="mt-8 text-sm text-destructive">Couldn't load the teachers. Refresh and try again.</p>
          )}
          {teachers.data?.length === 0 && (
            <Empty className="mt-8" title="No teachers listed yet" description="Check back soon — our team page is being put together." />
          )}
          {!!teachers.data?.length && (
            <TeamGrid
              className="mt-8"
              items={teachers.data.map((t) => ({
                name: t.name,
                role: t.bio ?? undefined,
                photo: t.photo_url ?? null,
              }))}
            />
          )}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeader eyebrow="Kind words" title="From the mat" />
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          <Testimonial
            item={{
              quote: "First studio where I've actually kept coming back. The Slow Flow class undid my desk-job shoulders.",
              name: "Priya Shah",
              role: "Twice a week",
            }}
          />
          <Testimonial
            item={{
              quote: "Restorative on a Tuesday morning is the best hour of my week.",
              name: "Owen Baxter",
              role: "Regular",
            }}
          />
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
          <LocationCard
            className="self-start"
            name="Aurora Yoga"
            address="18 Riverside Walk, Bristol BS1 6ND"
            note="Above the bakery. Steps down to the towpath if you'd rather walk it off."
          />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <CtaBand
          title="Spaces are usually free this week"
          description="Book a class in thirty seconds — we'll confirm by email."
          action={{ label: "Book now", href: "#/book" }}
        />
      </section>
    </SiteChrome>
  );
}
