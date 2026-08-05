import { createFileRoute } from "@tanstack/react-router";

import { useRows, type Row } from "@/lib/rows";
import { CtaBand } from "@/components/ui/cta-band";
import { LocationCard } from "@/components/ui/location-card";
import { MenuSection } from "@/components/ui/menu-section";
import { OpenNow } from "@/components/ui/open-now";
import { OpeningHours, type DayHours } from "@/components/ui/opening-hours";
import { SafeImage } from "@/components/ui/safe-image";
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
  tagline: "A neighbourhood table on Pell Street.",
  links: [
    { label: "The menu", href: "#menu" },
    { label: "Who cooks", href: "#kitchen" },
    { label: "Find us", href: "#find-us" },
  ],
  action: { label: "Directions", href: "#find-us" },
};

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

function toPrice(price: string | null): number | string | null {
  if (price == null) return null;
  const n = Number(price);
  return Number.isNaN(n) ? price : n;
}

function Home() {
  const dishes = useRows<Dish>("dishes", { order: "course", dir: "asc" });
  const chefs = useRows<Chef>("chefs", { order: "name", dir: "asc" });
  const hours = useRows<HourRow>("hours", { order: "day", dir: "asc" });

  const groups = (() => {
    if (!dishes.data?.length) return [];
    const byCourse = new Map<string, Dish[]>();
    for (const d of dishes.data) {
      const course = d.course ?? "On the menu";
      if (!byCourse.has(course)) byCourse.set(course, []);
      byCourse.get(course)!.push(d);
    }
    return Array.from(byCourse.entries()).map(([name, items]) => ({
      name,
      items: items.map((d) => ({
        name: d.name,
        description: d.description,
        price: toPrice(d.price),
      })),
    }));
  })();

  const sortedHours = hours.data
    ? [...hours.data].sort(
        (a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day),
      )
    : [];

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
        <div className="mx-auto max-w-5xl px-6 py-14">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Pell Street · Neighbourhood cooking
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Pell Street Kitchen
          </h1>
          <p className="mt-4 max-w-lg text-lg leading-relaxed text-muted-foreground">
            Honest plates, a short menu, and a table for you if you can get down here. We don't take
            bookings online — ring the kitchen and we'll hold you a spot.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <a
              className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
              href="tel:+441142700123"
            >
              Call to reserve
            </a>
            <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="#menu">
              See the menu
            </a>
            <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="#find-us">
              Find us
            </a>
            {openNowHours.length > 0 && <OpenNow hours={openNowHours} />}
          </div>
        </div>
      </section>

      <section id="menu" className="mx-auto max-w-4xl px-6 py-20">
        <SectionHeader
          eyebrow="The menu"
          title="What we're cooking"
          description="Short, seasonal, and the prices are the prices — nothing added at the table."
        />
        {dishes.isPending && <Skeleton className="mt-8 h-64 rounded-xl" />}
        {dishes.isError && (
          <p className="mt-8 text-sm text-destructive">
            Couldn't load the menu. Refresh and try again.
          </p>
        )}
        {!dishes.isPending && !dishes.isError && dishes.data?.length === 0 && (
          <Empty
            className="mt-8"
            title="Menu coming soon"
            description="We're putting the finishing touches on it — check back shortly."
          />
        )}
        {groups.length > 0 && <MenuSection className="mt-8" groups={groups} />}
      </section>

      <section id="kitchen" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <SectionHeader
            eyebrow="Who cooks"
            title="The people behind the pass"
            description="A small kitchen, and everyone in it has a hand in what lands on your table."
          />
          {chefs.isPending && (
            <div className="mt-8 grid gap-6 sm:grid-cols-3">
              <Skeleton className="h-48 rounded-xl" />
              <Skeleton className="h-48 rounded-xl" />
              <Skeleton className="h-48 rounded-xl" />
            </div>
          )}
          {chefs.isError && (
            <p className="mt-8 text-sm text-destructive">
              Couldn't load the team. Refresh and try again.
            </p>
          )}
          {!chefs.isPending && !chefs.isError && chefs.data?.length === 0 && (
            <Empty
              className="mt-8"
              title="Introductions coming soon"
              description="We'll be putting names and faces to the kitchen shortly."
            />
          )}
          {!!chefs.data?.length && (
            <TeamGrid
              className="mt-8"
              columns={chefs.data.length >= 4 ? 4 : (chefs.data.length as 1 | 2 | 3)}
              items={chefs.data.map((c) => ({
                name: c.name,
                role: c.role,
                photo: c.photo_url,
              }))}
            />
          )}
        </div>
      </section>

      <section id="find-us" className="mx-auto max-w-5xl px-6 py-20">
        <div className="grid gap-10 sm:grid-cols-2">
          <div>
            <SectionHeader eyebrow="Find us" title="On Pell Street" />
            <LocationCard
              className="mt-6"
              name="Pell Street Kitchen"
              address="22 Pell Street, Sheffield S3 8GG"
              note="Street parking after 6pm, or the tram stops two minutes away."
            />
          </div>
          <div>
            <h3 className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Opening hours
            </h3>
            {hours.isPending && <Skeleton className="mt-5 h-56 rounded-xl" />}
            {hours.isError && (
              <p className="mt-5 text-sm text-destructive">
                Couldn't load our hours. Refresh and try again.
              </p>
            )}
            {!hours.isPending && !hours.isError && hours.data?.length === 0 && (
              <Empty
                className="mt-5"
                title="Hours coming soon"
                description="Give us a call and we'll tell you when we're open."
              />
            )}
            {dayHours.length > 0 && <OpeningHours className="mt-5" days={dayHours} />}
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <CtaBand
            title="We don't take bookings online"
            description="Ring the kitchen and we'll find you a table — we always try."
            action={{ label: "Call to reserve", href: "tel:+441142700123" }}
          />
        </div>
      </section>
    </SiteChrome>
  );
}
