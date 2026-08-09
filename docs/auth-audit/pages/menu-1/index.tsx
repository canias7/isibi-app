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
  tagline: "A neighbourhood restaurant on Pell Street.",
  links: [
    { label: "Menu", href: "#menu" },
    { label: "Who cooks", href: "#kitchen" },
    { label: "Find us", href: "#find-us" },
  ],
  action: { label: "Get directions", href: "#find-us" },
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

function toDayHours(rows: HourRow[]): DayHours[] {
  return [...rows]
    .sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day))
    .map((r) => ({
      day: DAY_NUMBER[r.day] ?? 0,
      label: r.day,
      open: r.opens,
      close: r.closes,
    }));
}

function Home() {
  const dishes = useRows<Dish>("dishes", { order: "course", dir: "asc" });
  const chefs = useRows<Chef>("chefs", { order: "name", dir: "asc" });
  const hours = useRows<HourRow>("hours", { order: "id", dir: "asc" });

  const groups = (() => {
    if (!dishes.data?.length) return [];
    const byCourse = new Map<string, Dish[]>();
    for (const d of dishes.data) {
      const key = d.course ?? "On the menu";
      if (!byCourse.has(key)) byCourse.set(key, []);
      byCourse.get(key)!.push(d);
    }
    return Array.from(byCourse.entries()).map(([name, items]) => ({
      name,
      items: items.map((d) => ({
        name: d.name,
        description: d.description,
        price: d.price,
      })),
    }));
  })();

  const openHours = (hours.data ?? [])
    .filter((h) => h.opens && h.closes)
    .map((h) => ({ day: DAY_NUMBER[h.day] ?? 0, open: h.opens!, close: h.closes! }));

  return (
    <SiteChrome {...CHROME}>
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-4xl px-6 py-16 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Pell Street
          </p>
          <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">
            Pell Street Kitchen
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            No online booking here — give us a ring and we'll hold you a table.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {hours.data && openHours.length > 0 && <OpenNow hours={openHours} />}
            <a
              className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
              href="#find-us"
            >
              Directions
            </a>
            <a
              className="rounded-md border border-border px-5 py-2.5 text-sm font-medium"
              href="#menu"
            >
              See the menu
            </a>
          </div>
        </div>
      </section>

      <section id="menu" className="mx-auto max-w-4xl px-6 py-20">
        <SectionHeader
          eyebrow="The menu"
          title="What we cook"
          description="Everything made to order, in a kitchen you can see from most tables."
        />
        {dishes.isPending && <Skeleton className="mt-8 h-64 rounded-xl" />}
        {dishes.isError && (
          <p className="mt-8 text-sm text-destructive">
            Couldn't load the menu. Refresh and try again.
          </p>
        )}
        {dishes.data?.length === 0 && (
          <p className="mt-8 text-sm text-muted-foreground">
            The menu isn't listed yet — call us and we'll talk you through it.
          </p>
        )}
        {groups.length > 0 && <MenuSection className="mt-8" groups={groups} currency="£" />}
      </section>

      <section id="kitchen" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-4xl px-6 py-20">
          <SectionHeader
            eyebrow="Who cooks"
            title="The kitchen"
            description="The people behind the pass most nights."
          />
          {chefs.isPending && <Skeleton className="mt-8 h-40 rounded-xl" />}
          {chefs.isError && (
            <p className="mt-8 text-sm text-destructive">
              Couldn't load the team. Refresh and try again.
            </p>
          )}
          {chefs.data?.length === 0 && (
            <p className="mt-8 text-sm text-muted-foreground">
              We'll introduce the kitchen here soon.
            </p>
          )}
          {!!chefs.data?.length && (
            <TeamGrid
              className="mt-8"
              columns={chefs.data.length >= 4 ? 4 : (chefs.data.length as 1 | 2 | 3)}
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
            <LocationCard
              className="mt-6"
              name="Pell Street Kitchen"
              address="22 Pell Street, Sheffield S3 8GG"
              note="No online booking — call the kitchen and we'll hold you a table."
            />
            <SafeImage
              src={null}
              alt=""
              ratio="4/3"
              className="mt-6"
              fallbackSeed="pell-street-front"
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
            {hours.data?.length === 0 && (
              <p className="mt-5 text-sm text-muted-foreground">
                Give us a call for today's hours.
              </p>
            )}
            {hours.data && hours.data.length > 0 && (
              <OpeningHours className="mt-5" days={toDayHours(hours.data)} />
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-16">
        <CtaBand
          title="We don't take bookings online"
          description="Give us a call and we'll sort you a table."
          action={{ label: "Get directions", href: "#find-us" }}
        />
      </section>
    </SiteChrome>
  );
}
