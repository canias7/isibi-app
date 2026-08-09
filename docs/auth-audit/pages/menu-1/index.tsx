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

type Chef = Row & { name: string; role: string | null; photo_url: string | null };

type HourRow = Row & { day: string; opens: string | null; closes: string | null };

const CHROME = {
  name: "Pell Street Kitchen",
  tagline: "A neighbourhood table, cooked properly.",
  links: [
    { label: "Menu", href: "#menu" },
    { label: "The kitchen", href: "#kitchen" },
    { label: "Find us", href: "#find-us" },
  ],
  action: { label: "Directions", href: "#find-us" },
};

const DAY_ORDER: Record<string, number> = {
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
  Sunday: 0,
};

function toHHMM(t: string | null): string | null {
  if (!t) return null;
  return t.length >= 5 ? t.slice(0, 5) : t;
}

function parsePrice(p: string | null): number | string | null {
  if (!p) return null;
  const n = Number(p.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : p;
}

function Home() {
  const dishes = useRows<Dish>("dishes", { order: "course", dir: "asc" });
  const chefs = useRows<Chef>("chefs", { order: "name", dir: "asc" });
  const hours = useRows<HourRow>("hours", { order: "day", dir: "asc" });

  const dayHours: DayHours[] = (hours.data ?? [])
    .slice()
    .sort((a, b) => (DAY_ORDER[a.day] ?? 9) - (DAY_ORDER[b.day] ?? 9))
    .map((h) => ({
      day: DAY_ORDER[h.day] ?? 0,
      label: h.day,
      open: toHHMM(h.opens),
      close: toHHMM(h.closes),
    }));

  const openNowHours = dayHours
    .filter((d) => d.open && d.close)
    .map((d) => ({ day: d.day, open: d.open as string, close: d.close as string }));

  const groupsMap = new Map<string, Dish[]>();
  for (const d of dishes.data ?? []) {
    const course = d.course ?? "Other";
    if (!groupsMap.has(course)) groupsMap.set(course, []);
    groupsMap.get(course)!.push(d);
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
            Neighbourhood kitchen, no bookings
          </p>
          <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">
            Pell Street Kitchen
          </h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Honest cooking on the corner of Pell Street. Come as you are — we don't take
            bookings, but there's usually room.
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
              href="#menu"
            >
              See the menu
            </a>
            {openNowHours.length > 0 && <OpenNow hours={openNowHours} />}
          </div>
        </div>
      </section>

      <section id="menu" className="mx-auto max-w-4xl px-6 py-20">
        <SectionHeader
          eyebrow="The menu"
          title="What's on"
          description="Everything made to order — ask if something's off tonight."
        />
        {dishes.isPending && (
          <div className="mt-8 space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        )}
        {dishes.isError && (
          <p className="mt-8 text-sm text-destructive">
            Couldn't load the menu. Refresh and try again.
          </p>
        )}
        {dishes.data?.length === 0 && (
          <Empty
            className="mt-8"
            title="Menu coming soon"
            description="We're setting the menu up — check back shortly."
          />
        )}
        {!!dishes.data?.length && <MenuSection groups={groups} className="mt-8" />}
      </section>

      <section id="kitchen" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <SectionHeader eyebrow="The kitchen" title="Who cooks" />
          {chefs.isPending && (
            <div className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-4">
              <Skeleton className="h-40 rounded-lg" />
              <Skeleton className="h-40 rounded-lg" />
              <Skeleton className="h-40 rounded-lg" />
              <Skeleton className="h-40 rounded-lg" />
            </div>
          )}
          {chefs.isError && (
            <p className="mt-8 text-sm text-destructive">
              Couldn't load the team. Refresh and try again.
            </p>
          )}
          {chefs.data?.length === 0 && (
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

      <section id="find-us" className="mx-auto max-w-5xl px-6 py-20">
        <div className="grid gap-10 sm:grid-cols-2">
          <div>
            <SectionHeader eyebrow="Find us" title="On Pell Street" />
            <LocationCard
              className="mt-6"
              name="Pell Street Kitchen"
              address="12 Pell Street"
              note="No bookings — walk in, and there's usually a table."
            />
            <SafeImage
              className="mt-6"
              src={null}
              alt=""
              ratio="4/3"
              fallbackSeed="pell-street-front"
            />
          </div>
          <div>
            <h3 className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Opening hours
            </h3>
            {hours.isPending && <Skeleton className="mt-5 h-56 rounded-lg" />}
            {hours.isError && (
              <p className="mt-5 text-sm text-destructive">
                Couldn't load our hours. Refresh and try again.
              </p>
            )}
            {hours.data?.length === 0 && (
              <Empty
                className="mt-5"
                title="Hours coming soon"
                description="We're finalising our hours."
              />
            )}
            {!!hours.data?.length && <OpeningHours className="mt-5" days={dayHours} />}
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <CtaBand
            title="We don't take bookings"
            description="Walk in — there's usually a table, and if not, it's never a long wait."
            action={{ label: "Get directions", href: "#find-us" }}
          />
        </div>
      </section>
    </SiteChrome>
  );
}
