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
    { label: "Kitchen", href: "#kitchen" },
    { label: "Find us", href: "#find-us" },
  ],
  action: { label: "Directions", href: "#find-us" },
};

const COURSES = ["Starters", "Mains", "Sides", "Puddings"];

const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const DAY_NUMBER: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

function parsePrice(price: string | null): number | string | null {
  if (!price) return null;
  const n = Number(price.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : price;
}

function Home() {
  const dishes = useRows<Dish>("dishes", { order: "name", dir: "asc" });
  const chefs = useRows<Chef>("chefs", { order: "name", dir: "asc" });
  const hours = useRows<Hour>("hours", { order: "day", dir: "asc" });

  const grouped = COURSES.map((name) => ({
    name,
    rows: (dishes.data ?? []).filter((d) => d.course === name),
  })).filter((g) => g.rows.length);

  const knownCourses = new Set(COURSES);
  const leftovers = (dishes.data ?? []).filter((d) => !knownCourses.has(d.course ?? ""));
  if (leftovers.length) grouped.push({ name: "Also on the table", rows: leftovers });

  const orderedHours = [...(hours.data ?? [])].sort(
    (a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day),
  );

  const dayHours: DayHours[] = orderedHours.map((h) => ({
    day: DAY_NUMBER[h.day] ?? 0,
    label: h.day,
    open: h.opens,
    close: h.closes,
  }));

  const openNowHours = dayHours
    .filter((d) => d.open && d.close)
    .map((d) => ({ day: d.day, open: d.open as string, close: d.close as string }));

  return (
    <SiteChrome {...CHROME}>
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-4xl px-6 py-16 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Pell Street · neighbourhood kitchen
          </p>
          <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">
            Pell Street Kitchen
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
            A short menu, cooked properly, at the tables round the corner from where you live.
            We don't take bookings online — ring us and we'll hold you a table.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <a
              className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
              href="#menu"
            >
              See the menu
            </a>
            <a
              className="rounded-md border border-border px-5 py-2.5 text-sm font-medium"
              href="#find-us"
            >
              Get directions
            </a>
          </div>
          {!hours.isPending && !hours.isError && openNowHours.length > 0 && (
            <div className="mt-6 flex justify-center">
              <OpenNow hours={openNowHours} />
            </div>
          )}
        </div>
      </section>

      <section id="menu" className="mx-auto max-w-4xl px-6 py-20">
        <SectionHeader
          eyebrow="The menu"
          title="What we're cooking"
          description="Short, seasonal, and it changes when the market does."
        />

        {dishes.isPending && (
          <div className="mt-10 grid gap-3">
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-16 rounded-lg" />
          </div>
        )}

        {dishes.isError && (
          <p className="mt-10 text-sm text-destructive">
            Couldn't load the menu. Refresh and try again.
          </p>
        )}

        {!dishes.isPending && !dishes.isError && dishes.data?.length === 0 && (
          <Empty
            className="mt-10"
            title="Menu coming soon"
            description="We're setting the menu — check back shortly."
          />
        )}

        {!!grouped.length && (
          <div className="mt-10">
            <MenuSection
              groups={grouped.map((g) => ({
                name: g.name,
                items: g.rows.map((d) => ({
                  name: d.name,
                  description: d.description,
                  price: parsePrice(d.price),
                })),
              }))}
            />
          </div>
        )}
      </section>

      <section id="kitchen" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-4xl px-6 py-20">
          <SectionHeader
            eyebrow="Who cooks"
            title="The kitchen"
            description="The people behind the pass, most nights of the week."
          />

          {chefs.isPending && (
            <div className="mt-10 grid grid-cols-2 gap-6 sm:grid-cols-4">
              <Skeleton className="h-40 rounded-lg" />
              <Skeleton className="h-40 rounded-lg" />
              <Skeleton className="h-40 rounded-lg" />
              <Skeleton className="h-40 rounded-lg" />
            </div>
          )}

          {chefs.isError && (
            <p className="mt-10 text-sm text-destructive">
              Couldn't load the team. Refresh and try again.
            </p>
          )}

          {!chefs.isPending && !chefs.isError && chefs.data?.length === 0 && (
            <Empty
              className="mt-10"
              title="Team coming soon"
              description="We'll introduce the kitchen here shortly."
            />
          )}

          {!!chefs.data?.length && (
            <TeamGrid
              className="mt-10"
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
        <div className="mt-10 grid gap-10 sm:grid-cols-2">
          <div>
            <h3 className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Opening hours
            </h3>
            {hours.isPending && <Skeleton className="mt-5 h-48 rounded-lg" />}
            {hours.isError && (
              <p className="mt-5 text-sm text-destructive">Couldn't load our hours.</p>
            )}
            {!hours.isPending && !hours.isError && dayHours.length === 0 && (
              <p className="mt-5 text-sm text-muted-foreground">Hours coming soon.</p>
            )}
            {dayHours.length > 0 && <OpeningHours className="mt-5" days={dayHours} />}
          </div>
          <LocationCard
            className="self-start"
            name="Pell Street Kitchen"
            address="Pell Street, and a short walk from wherever you're coming from"
            note="No bookings online — give us a ring and we'll hold you a table."
          />
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-16">
        <CtaBand
          title="We don't take bookings online"
          description="Ring the kitchen and we'll hold you a table."
          action={{ label: "Get directions", href: "#find-us" }}
        />
      </section>
    </SiteChrome>
  );
}
