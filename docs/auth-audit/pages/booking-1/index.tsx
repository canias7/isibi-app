import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { useRows, type Row } from "@/lib/rows";
import { CtaBand } from "@/components/ui/cta-band";
import { Gallery } from "@/components/ui/gallery";
import { LocationCard } from "@/components/ui/location-card";
import { OpenNow } from "@/components/ui/open-now";
import { OpeningHours, type DayHours } from "@/components/ui/opening-hours";
import { PriceList } from "@/components/ui/price-list";
import { SectionHeader } from "@/components/ui/section-header";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Skeleton } from "@/components/ui/skeleton";
import { TeamGrid } from "@/components/ui/team-grid";
import { Testimonial } from "@/components/ui/testimonial";
import { TrustStrip } from "@/components/ui/trust-strip";
import { Empty } from "@/components/ui/empty";

export const Route = createFileRoute("/")({ component: Home });

type Teacher = Row & { name: string; bio: string | null; photo_url: string | null };

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A calm room, a mat, and a class that starts on time.",
  links: [
    { label: "Classes", href: "#prices" },
    { label: "Teachers", href: "#team" },
    { label: "The studio", href: "#/work" },
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
  { day: 6, label: "Saturday", open: "08:30", close: "14:00" },
  { day: 0, label: "Sunday", open: "09:00", close: "13:00" },
];

const CLASSES = [
  { name: "Morning Flow", description: "A gentle vinyasa to open the day", price: 14, meta: "60 min" },
  { name: "Vinyasa", description: "Breath-led, building through the week", price: 16, meta: "60 min" },
  { name: "Restorative", description: "Long holds, low light, props provided", price: 14, meta: "75 min" },
  { name: "Hot Yoga", description: "Heated room, stronger practice", price: 18, meta: "60 min" },
  { name: "Beginners' Course", description: "Six weeks, the whole foundation", price: 85, meta: "6 wks" },
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
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Studio · Riverside Walk
              </p>
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">Aurora Yoga</h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                A calm room by the river, classes for every level, and a timetable that runs
                on time. Book a mat and come as you are.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <a className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground motion-press" href="#/book">
                  Check availability
                </a>
                <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="#prices">
                  See the timetable
                </a>
                <OpenNow
                  hours={HOURS.filter((h) => h.open && h.close).map((h) => ({
                    day: h.day,
                    open: h.open!,
                    close: h.close!,
                  }))}
                />
              </div>
</div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <TrustStrip
          items={[
            { title: "Small classes", description: "Capped so the teacher actually sees you" },
            { title: "Every level welcome", description: "Beginners' course runs monthly" },
            { title: "Mats and props included", description: "Just bring water and yourself" },
          ]}
        />
      </section>

      <section id="prices" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <SectionHeader
            eyebrow="The timetable"
            title="Classes and prices"
            description="Drop in any time, or book ahead to be sure of a mat."
          />
          <PriceList
            className="mt-8"
            items={CLASSES}
            action={{
              label: "Book",
              onSelect: (c) => navigate({ to: "/book", search: { service: c.name } }),
            }}
          />
        </div>
      </section>

      <section id="team" className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeader
          eyebrow="The teachers"
          title="Who's holding class"
          description="Every teacher here trained for years before we let them near a timetable."
        />
        {teachers.isPending && (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        )}
        {teachers.isError && (
          <p className="mt-8 text-sm text-destructive">Couldn't load the teachers. Refresh and try again.</p>
        )}
        {teachers.data?.length === 0 && (
          <Empty className="mt-8" title="No teachers listed yet" description="Check back soon — we're adding profiles." />
        )}
        {!!teachers.data?.length && (
          <TeamGrid
            className="mt-8"
            items={teachers.data.map((t) => ({
              name: t.name,
              role: t.bio ?? "",
              photo: t.photo_url ?? null,
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
                quote: "I was terrified of my first class. Nobody made me feel like I didn't belong.",
                name: "Roisin Farrell",
                role: "Beginners' course, now weekly",
              }}
            />
            <Testimonial
              item={{
                quote: "The restorative class on a Sunday is the best hour of my week.",
                name: "Ben Okafor",
                role: "Restorative regular",
              }}
            />
          </div>
          <div className="mt-10 flex flex-wrap items-end justify-between gap-3">
            <p className="text-sm text-muted-foreground">Want to see the room before you book?</p>
            <a className="text-sm font-medium underline underline-offset-4" href="#/work">
              See the studio →
            </a>
          </div>
        </div>
      </section>

      <section id="find-us" className="mx-auto grid max-w-6xl gap-10 px-6 py-16 sm:grid-cols-2">
        <div>
          <SectionHeader eyebrow="Find us" title="On Riverside Walk" />
          <div className="mt-6 max-w-sm">
            <OpeningHours days={HOURS} />
          </div>
        </div>
        <LocationCard
          className="self-start"
          name="Aurora Yoga"
          address="9 Riverside Walk, Bristol BS1 6RB"
          note="Above the bike shop, up the outside stairs. Bike racks at street level."
        />
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <CtaBand
          title="There's a mat free most days"
          description="Book in thirty seconds — we'll confirm by email."
          action={{ label: "Book now", href: "#/book" }}
        />
      </section>
    </SiteChrome>
  );
}
