import { createFileRoute } from "@tanstack/react-router";

import { useRows, type Row } from "@/lib/rows";
import { CtaBand } from "@/components/ui/cta-band";
import { LocationCard } from "@/components/ui/location-card";
import { MenuSection } from "@/components/ui/menu-section";
import { OpenNow } from "@/components/ui/open-now";
import { OpeningHours, type DayHours } from "@/components/ui/opening-hours";
import { SectionHeader } from "@/components/ui/section-header";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Skeleton } from "@/components/ui/skeleton";
import { TeamGrid } from "@/components/ui/team-grid";
import { Empty } from "@/components/ui/empty";

export const Route = createFileRoute("/")({ component: Home });

type Dish = Row & {
  name: string;
  description: string | null;
  price: string | null;
  course: string | null;
};

type Chef = Row & {
  name: string;
  role: string | null;
  photo_url: string | null;
};

type Hour = Row & {
  day: string;
  opens: string | null;
  closes: string | null;
};

const CHROME = {
  name: "Pell Street Kitchen",
  tagline: "A neighbourhood table on Pell Street.",
  links: [
    { label: "Menu", href: "#menu" },
    { label: "Our kitchen", href: "#kitchen" },
    { label: "Find us", href: "#find-us" },
  ],
  action: { label: "Directions", href: "#find-us" },
};

const COURSE_ORDER = ["Starters", "Mains", "Sides", "Puddings", "Drinks"];

const DAY_ORDER = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const DAY_INDEX: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

function toMinutes(t: string | null): number | null {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function toHHMM(t: string | null): string | null {
  const mins = toMinutes(t);
  if (mins == null) return null;
  const h = Math.floor(mins / 60)
    .toString()
    .padStart(2, "0");
  const m = (mins % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

function parsePrice(price: string | null): number | string | null {
  if (!price) return null;
  const n = Number(price.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : price;
}

function Home() {
  const dishes = useRows<Dish>("dishes", { order: "name", dir: "asc" });
  const chefs = useRows<Chef>("chefs", { order: "name", dir: "asc" });
  const hours = useRows<Hour>("hours");

  const groupedDishes = COURSE_ORDER.map((name) => ({
    name,
    rows: (dishes.data ?? []).filter((d) => d.course === name),
  })).filter((g) => g.rows.length);

  const knownCourses = new Set(COURSE_ORDER);
  const leftovers = (dishes.data ?? []).filter(
    (d) => !d.course || !knownCourses.has(d.course),
  );
  if (leftovers.length) {
    groupedDishes.push({ name: "More", rows: leftovers });
  }

  const dayHours: DayHours[] = (hours.data ?? [])
    .slice()
    .sort((a, b) => {
      const ai = DAY_INDEX[a.day] ?? 99;
      const bi = DAY_INDEX[b.day] ?? 99;
      return ai - bi;
    })
    .map((h) => ({
      day: DAY_INDEX[h.day] ?? 0,
      label: h.day,
      open: toHHMM(h.opens),
      close: toHHMM(h.closes),
    }));

  const openNowHours = dayHours
    .filter((d) => d.open && d.close)
    .map((d) => ({ day: d.day, open: d.open!, close: d.close! }));

  return (
    <SiteChrome {...CHROME}>
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-4xl px-6 py-14">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Pell Street · a neighbourhood table
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Pell Street Kitchen
          </h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Home cooking, done properly, a few doors from where you live. No booking system —
            ring us and we'll hold you a table.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <a
              className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
              href="#find-us"
            >
              Directions
            </a>
            <a
              className="rounded-md border border-border px-5 py-2.5 text-sm font-medium"
              href="tel:+441142700000"
            >
              Call 0114 270 0000
            </a>
            {!hours.isPending && !hours.isError && openNowHours.length > 0 && (
              <OpenNow hours={openNowHours} />
            )}
          </div>
        </div>
      </section>

      <section id="menu" className="mx-auto max-w-4xl px-6 py-20">
        <SectionHeader
          eyebrow="The menu"
          title="What's on"
          description="Short and changes with what's good this week — ask what's off if something's not there."
        />
        {dishes.isPending && <Skeleton className="mt-8 h-72 rounded-xl" />}
        {dishes.isError && (
          <p className="mt-8 text-sm text-destructive">
            Couldn't load the menu right now. Refresh and try again.
          </p>
        )}
        {!dishes.isPending && !dishes.isError && dishes.data?.length === 0 && (
          <Empty
            className="mt-8"
            title="Menu coming soon"
            description="We're putting the dishes up shortly — check back, or ring us for what's on tonight."
          />
        )}
        {!!groupedDishes.length && (
          <MenuSection
            className="mt-8"
            groups={groupedDishes.map((g) => ({
              name: g.name,
              items: g.rows.map((d) => ({
                name: d.name,
                description: d.description,
                price: parsePrice(d.price),
              })),
            }))}
          />
        )}
      </section>

      <section id="kitchen" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-4xl px-6 py-20">
          <SectionHeader
            eyebrow="Our kitchen"
            title="Who cooks"
            description="A small team, most of whom you'll see if you look through the pass."
          />
          {chefs.isPending && <Skeleton className="mt-8 h-40 rounded-xl" />}
          {chefs.isError && (
            <p className="mt-8 text-sm text-destructive">
              Couldn't load the team right now.
            </p>
          )}
          {!chefs.isPending && !chefs.isError && chefs.data?.length === 0 && (
            <Empty
              className="mt-8"
              title="Team coming soon"
              description="We'll introduce the kitchen here shortly."
            />
          )}
          {!!chefs.data?.length && (
            <TeamGrid
              className="mt-8"
              items={chefs.data.map((c) => ({
                name: c.name,
                role: c.role,
                photo: c.photo_url,
                fallbackSeed: c.name,
              }))}
            />
          )}
        </div>
      </section>

      <section id="find-us" className="mx-auto max-w-4xl px-6 py-20">
        <SectionHeader eyebrow="Find us" title="On Pell Street" />
        <div className="mt-8 grid gap-10 sm:grid-cols-2">
          <LocationCard
            name="Pell Street Kitchen"
            address="22 Pell Street, Sheffield S3 8GF"
            note="Between the launderette and the corner shop. No parking outside, but plenty on Marlow Road."
          />
          <div>
            <h3 className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Opening hours
            </h3>
            {hours.isPending && <Skeleton className="mt-5 h-48 rounded-xl" />}
            {hours.isError && (
              <p className="mt-5 text-sm text-destructive">Couldn't load our hours right now.</p>
            )}
            {!hours.isPending && !hours.isError && dayHours.length === 0 && (
              <p className="mt-5 text-sm text-muted-foreground">
                Hours coming soon — give us a call to check.
              </p>
            )}
            {!!dayHours.length && <OpeningHours className="mt-5" days={dayHours} />}
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-muted/40">
        <div className="mx-auto max-w-4xl px-6 py-16">
          <CtaBand
            title="We don't take bookings online"
            description="Ring 0114 270 0000 and we'll hold you a table, or just walk in."
            action={{ label: "Get directions", href: "#find-us" }}
          />
        </div>
      </section>
    </SiteChrome>
  );
}
