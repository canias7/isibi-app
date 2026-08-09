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

type HourRow = Row & {
  day: string;
  opens: string | null;
  closes: string | null;
};

const CHROME = {
  name: "Pell Street Kitchen",
  tagline: "Neighbourhood cooking, phone to book a table.",
  links: [
    { label: "Menu", href: "#menu" },
    { label: "The kitchen", href: "#kitchen" },
    { label: "Find us", href: "#find-us" },
  ],
  action: { label: "Call to reserve", href: "tel:+441142700100" },
};

const COURSES = ["Starters", "Mains", "Sides", "Desserts", "Drinks"];

const DAY_ORDER = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const DAY_NUMBER: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

function parsePrice(p: string | null): number | string | null {
  if (p == null) return null;
  const n = Number(p.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : p;
}

function Home() {
  const dishes = useRows<Dish>("dishes", { order: "name", dir: "asc" });
  const chefs = useRows<Chef>("chefs", { order: "name", dir: "asc" });
  const hours = useRows<HourRow>("hours", { order: "day", dir: "asc" });

  const grouped = (() => {
    const rows = dishes.data ?? [];
    const named = COURSES.map((name) => ({
      name,
      rows: rows.filter((r) => r.course === name),
    })).filter((g) => g.rows.length);
    const known = new Set(COURSES);
    const leftover = rows.filter((r) => !r.course || !known.has(r.course));
    if (leftover.length) named.push({ name: "More", rows: leftover });
    return named;
  })();

  const sortedHours = (() => {
    const rows = hours.data ?? [];
    return DAY_ORDER.map((day) => rows.find((r) => r.day === day)).filter(
      (r): r is HourRow => !!r,
    );
  })();

  const dayHours: DayHours[] = sortedHours.map((h) => ({
    day: DAY_NUMBER[h.day] ?? 0,
    label: h.day,
    open: h.opens,
    close: h.closes,
  }));

  const openNowHours = dayHours
    .filter((h) => h.open && h.close)
    .map((h) => ({ day: h.day, open: h.open as string, close: h.close as string }));

  return (
    <SiteChrome {...CHROME}>
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-4xl px-6 py-14 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            A neighbourhood table
          </p>
          <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">
            Pell Street Kitchen
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            No booking online — ring us and we'll hold you a table.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <a
              className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground motion-press"
              href="tel:+441142700100"
            >
              Call to reserve
            </a>
            <a
              className="rounded-md border border-border px-5 py-2.5 text-sm font-medium motion-press"
              href="#find-us"
            >
              Directions
            </a>
            {openNowHours.length > 0 && <OpenNow hours={openNowHours} />}
          </div>
        </div>
      </section>

      <section id="menu" className="mx-auto max-w-4xl px-6 py-20">
        <SectionHeader
          eyebrow="The menu"
          title="What we're cooking"
          description="Everything made in the kitchen you can see from the door."
        />

        {dishes.isPending && (
          <div className="mt-8 space-y-3">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </div>
        )}

        {dishes.isError && (
          <p className="mt-8 text-sm text-destructive">
            Couldn't load the menu. Refresh and try again.
          </p>
        )}

        {!dishes.isPending && !dishes.isError && dishes.data?.length === 0 && (
          <div className="mt-8">
            <Empty
              title="Menu coming soon"
              description="We're putting the dishes together — check back shortly, or give us a call."
            />
          </div>
        )}

        {!dishes.isPending && !dishes.isError && !!dishes.data?.length && (
          <MenuSection
            className="mt-10"
            groups={grouped.map((g) => ({
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
            eyebrow="Who cooks"
            title="The kitchen"
            description="Small team, everything made from scratch."
          />

          {chefs.isPending && (
            <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Skeleton className="h-40 rounded-xl" />
              <Skeleton className="h-40 rounded-xl" />
              <Skeleton className="h-40 rounded-xl" />
              <Skeleton className="h-40 rounded-xl" />
            </div>
          )}

          {chefs.isError && (
            <p className="mt-8 text-sm text-destructive">
              Couldn't load the team. Refresh and try again.
            </p>
          )}

          {!chefs.isPending && !chefs.isError && chefs.data?.length === 0 && (
            <div className="mt-8">
              <Empty
                title="Team coming soon"
                description="We'll introduce the kitchen here shortly."
              />
            </div>
          )}

          {!chefs.isPending && !chefs.isError && !!chefs.data?.length && (
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
        <div className="grid gap-10 sm:grid-cols-2">
          <div>
            <SectionHeader eyebrow="Find us" title="On Pell Street" />
            {hours.isPending && <Skeleton className="mt-6 h-48 rounded-xl" />}
            {hours.isError && (
              <p className="mt-6 text-sm text-destructive">
                Couldn't load opening hours. Refresh and try again.
              </p>
            )}
            {!hours.isPending && !hours.isError && hours.data?.length === 0 && (
              <p className="mt-6 text-sm text-muted-foreground">
                Hours coming soon — call ahead.
              </p>
            )}
            {!hours.isPending && !hours.isError && !!hours.data?.length && (
              <OpeningHours className="mt-6" days={dayHours} />
            )}
          </div>
          <LocationCard
            className="self-start"
            name="Pell Street Kitchen"
            address="22 Pell Street, Sheffield S3 8GG"
            note="Street parking after 6pm. Tables held for fifteen minutes past booking time."
          />
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-16">
        <CtaBand
          title="Ring us to book a table"
          description="We don't take bookings online — call and we'll sort you a table."
          action={{ label: "Call 0114 270 0100", href: "tel:+441142700100" }}
        />
      </section>
    </SiteChrome>
  );
}
