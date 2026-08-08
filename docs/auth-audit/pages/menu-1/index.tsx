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

type Hour = Row & {
  day: string;
  opens: string | null;
  closes: string | null;
};

const CHROME = {
  name: "Pell Street Kitchen",
  tagline: "A neighbourhood kitchen on Pell Street.",
  links: [
    { label: "The menu", href: "#menu" },
    { label: "Who cooks", href: "#kitchen" },
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

function Home() {
  const dishes = useRows<Dish>("dishes", { order: "course", dir: "asc" });
  const chefs = useRows<Chef>("chefs", { order: "name", dir: "asc" });
  const hours = useRows<Hour>("hours", { order: "day", dir: "asc" });

  const openNowHours = (hours.data ?? [])
    .filter((h) => h.opens && h.closes && DAY_INDEX[h.day] !== undefined)
    .map((h) => ({ day: DAY_INDEX[h.day], open: h.opens!, close: h.closes! }));

  const dayHours: DayHours[] = DAY_ORDER.map((label) => {
    const row = hours.data?.find((h) => h.day === label);
    return {
      day: DAY_INDEX[label],
      label,
      open: row?.opens ?? null,
      close: row?.closes ?? null,
    };
  });

  const groups = groupDishes(dishes.data ?? []);

  return (
    <SiteChrome {...CHROME}>
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Pell Street · No bookings — just phone or walk in
          </p>
          <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">
            Pell Street Kitchen
          </h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Simple, honest cooking for whoever's on the street. We don't take bookings — ring
            ahead if you're a big table, otherwise just come in.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <a
              className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground motion-press"
              href="#find-us"
            >
              Directions
            </a>
            <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="#menu">
              See the menu
            </a>
            {hours.data && hours.data.length > 0 && <OpenNow hours={openNowHours} />}
          </div>
        </div>
      </section>

      <section id="menu" className="mx-auto max-w-4xl px-6 py-20">
        <SectionHeader
          eyebrow="The menu"
          title="What's cooking"
          description="Everything made to order, priced honestly."
        />

        {dishes.isPending && (
          <div className="mt-10 space-y-3">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        )}

        {dishes.isError && (
          <p className="mt-10 text-sm text-destructive">
            Couldn't load the menu right now. Refresh and try again.
          </p>
        )}

        {dishes.data?.length === 0 && (
          <Empty
            className="mt-10"
            title="Menu coming soon"
            description="We're setting the menu up — check back shortly, or give us a ring."
          />
        )}

        {!!dishes.data?.length && (
          <MenuSection
            className="mt-10"
            groups={groups.map((g) => ({
              name: g.name,
              items: g.items.map((d) => ({
                name: d.name,
                description: d.description,
                price: d.price,
              })),
            }))}
          />
        )}
      </section>

      <section id="kitchen" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <SectionHeader
            eyebrow="Who cooks"
            title="The kitchen"
            description="The people behind the pass, most days of the week."
          />

          {chefs.isPending && (
            <div className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-40 rounded-xl" />
              ))}
            </div>
          )}

          {chefs.isError && (
            <p className="mt-8 text-sm text-destructive">Couldn't load the team. Refresh and try again.</p>
          )}

          {chefs.data?.length === 0 && (
            <Empty
              className="mt-8"
              title="Team coming soon"
              description="We haven't added the kitchen team here yet."
            />
          )}

          {!!chefs.data?.length && (
            <TeamGrid
              className="mt-8"
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
            {hours.data && hours.data.length > 0 && (
              <OpenNow className="mt-6" hours={openNowHours} />
            )}
            {hours.isPending && <Skeleton className="mt-6 h-48 rounded-xl" />}
            {hours.isError && (
              <p className="mt-6 text-sm text-destructive">Couldn't load our hours right now.</p>
            )}
            {hours.data?.length === 0 && (
              <p className="mt-6 text-sm text-muted-foreground">Hours coming soon — give us a ring.</p>
            )}
            {!!hours.data?.length && <OpeningHours className="mt-4" days={dayHours} />}
          </div>
          <div className="flex flex-col gap-6">
            <LocationCard
              name="Pell Street Kitchen"
              address="22 Pell Street"
              note="No bookings taken — phone ahead for larger groups, otherwise just walk in."
            />
            <SafeImage src={null} alt="" ratio="4/3" fallbackSeed="pell-street-front" />
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <CtaBand
            title="No bookings — just come in, or give us a ring"
            description="We seat first come, first served. Big group? Call ahead and we'll do our best."
            action={{ label: "Get directions", href: "#find-us" }}
          />
        </div>
      </section>
    </SiteChrome>
  );
}

function groupDishes(dishes: Dish[]) {
  const map = new Map<string, Dish[]>();
  for (const d of dishes) {
    const key = d.course && d.course.trim().length > 0 ? d.course : "Menu";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(d);
  }
  return Array.from(map.entries()).map(([name, items]) => ({ name, items }));
}
