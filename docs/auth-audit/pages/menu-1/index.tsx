import { createFileRoute } from "@tanstack/react-router";
import { useRows, type Row } from "@/lib/rows";
import { SiteChrome } from "@/components/ui/site-chrome";
import { CtaBand } from "@/components/ui/cta-band";
import { LocationCard } from "@/components/ui/location-card";
import { MenuSection, type MenuGroup } from "@/components/ui/menu-section";
import { OpenNow } from "@/components/ui/open-now";
import { OpeningHours, type DayHours } from "@/components/ui/opening-hours";
import { SectionHeader } from "@/components/ui/section-header";
import { TeamGrid } from "@/components/ui/team-grid";
import { Skeleton } from "@/components/ui/skeleton";
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
    { label: "Menu", href: "#menu" },
    { label: "The kitchen", href: "#kitchen" },
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

function parsePrice(price: string | null): number | undefined {
  if (!price) return undefined;
  const n = Number(price.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

function Home() {
  const dishes = useRows<Dish>("dishes", { order: "course", dir: "asc" });
  const chefs = useRows<Chef>("chefs", { order: "name", dir: "asc" });
  const hours = useRows<HourRow>("hours", { order: "day", dir: "asc" });

  const groups: MenuGroup[] = [];
  if (dishes.data?.length) {
    const byCourse = new Map<string, Dish[]>();
    for (const d of dishes.data) {
      const key = d.course ?? "On the menu";
      if (!byCourse.has(key)) byCourse.set(key, []);
      byCourse.get(key)!.push(d);
    }
    for (const [course, items] of byCourse) {
      groups.push({
        name: course,
        items: items.map((d) => ({
          name: d.name,
          description: d.description,
          price: parsePrice(d.price),
        })),
      });
    }
  }

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

  const openNowHours = sortedHours
    .filter((h) => h.opens && h.closes)
    .map((h) => ({ day: DAY_NUMBER[h.day] ?? 0, open: h.opens!, close: h.closes! }));

  return (
    <SiteChrome {...CHROME}>
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-4xl px-6 py-16 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Pell Street · a neighbourhood kitchen
          </p>
          <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">
            Pell Street Kitchen
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Honest plates, a short menu that changes with the season, and a table
            for you most nights without a booking. We don't take reservations
            online — ring us and we'll hold you a seat.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <a
              className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground motion-press"
              href="#menu"
            >
              See the menu
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

      <section id="menu" className="mx-auto max-w-3xl px-6 py-20">
        <SectionHeader
          eyebrow="The menu"
          title="What we're cooking"
          description="Short and seasonal — everything on it is here because it's worth making well."
          align="center"
        />
        {dishes.isPending && <Skeleton className="mt-10 h-64 rounded-xl" />}
        {dishes.isError && (
          <p className="mt-10 text-sm text-destructive">
            Couldn't load the menu right now. Refresh and try again.
          </p>
        )}
        {dishes.data?.length === 0 && (
          <Empty
            className="mt-10"
            title="The menu isn't up yet"
            description="Check back soon, or give us a call to hear what's cooking tonight."
          />
        )}
        {!!dishes.data?.length && <MenuSection groups={groups} currency="£" />}
      </section>

      <section id="kitchen" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <SectionHeader
            eyebrow="The kitchen"
            title="Who's cooking"
            description="A small team, most of whom have been here since we opened."
            align="center"
          />
          {chefs.isPending && (
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-56 rounded-xl" />
              ))}
            </div>
          )}
          {chefs.isError && (
            <p className="mt-10 text-sm text-destructive">
              Couldn't load the team right now.
            </p>
          )}
          {chefs.data?.length === 0 && (
            <Empty
              className="mt-10"
              title="Team page coming soon"
              description="We're putting names to the faces — check back shortly."
            />
          )}
          {!!chefs.data?.length && (
            <TeamGrid
              className="mt-10"
              items={chefs.data.map((c) => ({
                name: c.name,
                role: c.role ?? undefined,
                photo: c.photo_url ?? undefined,
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
              address="22 Pell Street, Manchester, M4 1JQ"
              note="Two doors from the old post office. Street parking after 6pm, or the NCP on Turner Street."
            />
          </div>
          <div>
            <h3 className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Opening hours
            </h3>
            {hours.isPending && <Skeleton className="mt-5 h-56 rounded-xl" />}
            {hours.isError && (
              <p className="mt-5 text-sm text-destructive">
                Couldn't load our hours right now — do call if you're unsure.
              </p>
            )}
            {hours.data?.length === 0 && (
              <Empty
                className="mt-5"
                title="Hours not listed yet"
                description="Give us a ring and we'll tell you when we're open."
              />
            )}
            {!!hours.data?.length && <OpeningHours className="mt-5" days={dayHours} />}
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-muted/40">
        <div className="mx-auto max-w-4xl px-6 py-16">
          <CtaBand
            title="We don't take bookings online"
            description="Give us a call and we'll hold you a table — walk-ins always welcome too."
            action={{ label: "Get directions", href: "#find-us" }}
          />
        </div>
      </section>
    </SiteChrome>
  );
}
