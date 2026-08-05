import { createFileRoute } from "@tanstack/react-router";
import { useRows, type Row } from "@/lib/rows";
import { SiteChrome } from "@/components/ui/site-chrome";
import { CtaBand } from "@/components/ui/cta-band";
import { LocationCard } from "@/components/ui/location-card";
import { MenuSection } from "@/components/ui/menu-section";
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
const DAY_INDEX: Record<string, number> = {
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

  const dayHours: DayHours[] = DAY_ORDER.map((label) => {
    const row = hours.data?.find((h) => h.day === label);
    return {
      day: DAY_INDEX[label],
      label,
      open: row?.opens ?? null,
      close: row?.closes ?? null,
    };
  });

  const openNowHours = dayHours
    .filter((d) => d.open && d.close)
    .map((d) => ({ day: d.day, open: d.open!, close: d.close! }));

  const groupsMap = new Map<string, Dish[]>();
  for (const d of dishes.data ?? []) {
    const key = d.course ?? "Menu";
    const list = groupsMap.get(key) ?? [];
    list.push(d);
    groupsMap.set(key, list);
  }
  const groups = Array.from(groupsMap.entries()).map(([name, items]) => ({
    name,
    items: items.map((d) => ({
      name: d.name,
      description: d.description,
      price: parsePrice(d.price),
    })),
  }));

  return (
    <SiteChrome {...CHROME}>
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Pell Street · Neighbourhood cooking
          </p>
          <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">
            Pell Street Kitchen
          </h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">
            A small room, a short menu, and a kitchen that changes it when the market does. No online
            booking — ring us and we'll hold you a table.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <a
              className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground motion-press"
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
            {hours.isPending && <Skeleton className="h-8 w-40 rounded-md" />}
            {!hours.isPending && !hours.isError && hours.data && hours.data.length > 0 && (
              <OpenNow hours={openNowHours} />
            )}
          </div>
        </div>
      </section>

      <section id="menu" className="mx-auto max-w-5xl px-6 py-20">
        <SectionHeader
          eyebrow="The menu"
          title="What we're cooking"
          description="Short, seasonal, and priced plainly. Ask what's changed this week."
        />
        <div className="mt-10">
          {dishes.isPending && (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          )}
          {dishes.isError && (
            <p className="text-sm text-destructive">
              Couldn't load the menu. Refresh and try again.
            </p>
          )}
          {!dishes.isPending && !dishes.isError && (dishes.data?.length ?? 0) === 0 && (
            <Empty
              title="The menu isn't up yet"
              description="Check back soon, or give us a ring for what's on today."
            />
          )}
          {!!dishes.data?.length && <MenuSection groups={groups} currency="£" />}
        </div>
      </section>

      <section id="kitchen" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <SectionHeader
            eyebrow="Who cooks"
            title="The kitchen"
            description="A small team, cooking a short menu properly."
          />
          <div className="mt-10">
            {chefs.isPending && (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <Skeleton className="h-48 rounded-xl" />
                <Skeleton className="h-48 rounded-xl" />
                <Skeleton className="h-48 rounded-xl" />
                <Skeleton className="h-48 rounded-xl" />
              </div>
            )}
            {chefs.isError && (
              <p className="text-sm text-destructive">
                Couldn't load the team. Refresh and try again.
              </p>
            )}
            {!chefs.isPending && !chefs.isError && (chefs.data?.length ?? 0) === 0 && (
              <Empty
                title="Team page coming soon"
                description="We're introducing the kitchen here shortly."
              />
            )}
            {!!chefs.data?.length && (
              <TeamGrid
                items={chefs.data.map((c) => ({
                  name: c.name,
                  role: c.role ?? undefined,
                  photo: c.photo_url ?? undefined,
                }))}
              />
            )}
          </div>
        </div>
      </section>

      <section id="find-us" className="mx-auto max-w-5xl px-6 py-20">
        <SectionHeader eyebrow="Find us" title="On Pell Street" />
        <div className="mt-10 grid gap-10 sm:grid-cols-2">
          <div>
            <LocationCard
              name="Pell Street Kitchen"
              address="22 Pell Street"
              note="No online booking — call ahead and we'll hold you a table."
            />
          </div>
          <div>
            <h3 className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Opening hours
            </h3>
            {hours.isPending && <Skeleton className="mt-5 h-48 rounded-xl" />}
            {hours.isError && (
              <p className="mt-5 text-sm text-destructive">
                Couldn't load our hours. Refresh and try again.
              </p>
            )}
            {!hours.isPending && !hours.isError && (hours.data?.length ?? 0) === 0 && (
              <p className="mt-5 text-sm text-muted-foreground">
                Hours coming soon — give us a call.
              </p>
            )}
            {!!hours.data?.length && <OpeningHours className="mt-5" days={dayHours} />}
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <CtaBand
            title="We don't take bookings online"
            description="Give us a ring and we'll hold you a table, or just walk in — we'll find you a seat."
            action={{ label: "Get directions", href: "#find-us" }}
          />
        </div>
      </section>
    </SiteChrome>
  );
}
