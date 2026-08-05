import { createFileRoute } from "@tanstack/react-router";

import { useRows, type Row } from "@/lib/rows";
import { CtaBand } from "@/components/ui/cta-band";
import { LocationCard } from "@/components/ui/location-card";
import { MenuSection } from "@/components/ui/menu-section";
import { OpenNow } from "@/components/ui/open-now";
import { OpeningHours, type DayHours } from "@/components/ui/opening-hours";
import { SectionHeader } from "@/components/ui/section-header";
import { Skeleton } from "@/components/ui/skeleton";
import { TeamGrid } from "@/components/ui/team-grid";
import { SiteChrome } from "@/components/ui/site-chrome";

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
    { label: "Kitchen", href: "#kitchen" },
    { label: "Find us", href: "#find-us" },
  ],
  action: { label: "Directions", href: "#find-us" },
};

const DAY_INDEX: Record<string, number> = {
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
  return Number.isFinite(n) ? n : price;
}

function Home() {
  const dishes = useRows<Dish>("dishes", { order: "course", dir: "asc" });
  const chefs = useRows<Chef>("chefs", { order: "name", dir: "asc" });
  const hours = useRows<HourRow>("hours", { order: "day", dir: "asc" });

  const dayHours: DayHours[] = (hours.data ?? []).map((h) => ({
    day: DAY_INDEX[h.day] ?? 0,
    label: h.day,
    open: h.opens,
    close: h.closes,
  }));

  const openNowHours = dayHours
    .filter((d) => d.open && d.close)
    .map((d) => ({ day: d.day, open: d.open as string, close: d.close as string }));

  const groups = Object.entries(
    (dishes.data ?? []).reduce<Record<string, Dish[]>>((acc, d) => {
      const key = d.course ?? "Menu";
      acc[key] = acc[key] ?? [];
      acc[key].push(d);
      return acc;
    }, {}),
  ).map(([name, items]) => ({
    name,
    items: items.map((d) => ({
      name: d.name,
      description: d.description,
      price: toPrice(d.price),
    })),
  }));

  return (
    <SiteChrome {...CHROME}>
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Pell Street · Neighbourhood kitchen
          </p>
          <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">
            Pell Street Kitchen
          </h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">
            No booking line, no maître d' — just a table if you've got the time and a menu that
            barely changes because it doesn't need to.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <a
              className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground motion-press"
              href="#find-us"
            >
              Directions
            </a>
            <a
              className="rounded-md border border-border px-5 py-2.5 text-sm font-medium motion-press"
              href="#menu"
            >
              See the menu
            </a>
            {openNowHours.length > 0 && <OpenNow hours={openNowHours} />}
          </div>
        </div>
      </section>

      <section id="menu" className="mx-auto max-w-5xl px-6 py-20">
        <SectionHeader
          eyebrow="The menu"
          title="What's on tonight"
          description="We phone the orders that need it — everything else is on the table."
        />
        {dishes.isPending && <Skeleton className="mt-8 h-72 rounded-xl" />}
        {dishes.isError && (
          <p className="mt-8 text-sm text-destructive">
            Couldn't load the menu right now. Refresh and try again, or give us a call.
          </p>
        )}
        {dishes.data?.length === 0 && (
          <p className="mt-8 text-sm text-muted-foreground">
            The menu isn't listed yet — ring us and we'll tell you what's cooking.
          </p>
        )}
        {!!dishes.data?.length && <MenuSection className="mt-8" groups={groups} />}
      </section>

      <section id="kitchen" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <SectionHeader
            eyebrow="Who cooks"
            title="The kitchen"
            description="Small team, long hours, food that tastes like somebody meant it."
          />
          {chefs.isPending && <Skeleton className="mt-8 h-40 rounded-xl" />}
          {chefs.isError && (
            <p className="mt-8 text-sm text-destructive">Couldn't load the team right now.</p>
          )}
          {chefs.data?.length === 0 && (
            <p className="mt-8 text-sm text-muted-foreground">
              We haven't listed the team yet — ask whoever answers the phone.
            </p>
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
            {hours.isPending && <Skeleton className="mt-6 h-48 rounded-xl" />}
            {hours.isError && (
              <p className="mt-6 text-sm text-destructive">Couldn't load our hours right now.</p>
            )}
            {hours.data?.length === 0 && (
              <p className="mt-6 text-sm text-muted-foreground">
                Hours aren't listed yet — give us a call to check we're open.
              </p>
            )}
            {!!hours.data?.length && <OpeningHours className="mt-6" days={dayHours} />}
          </div>
          <LocationCard
            className="self-start"
            name="Pell Street Kitchen"
            address="22 Pell Street"
            note="No bookings taken — we phone through any large orders, otherwise just come by."
          />
        </div>
      </section>

      <section className="border-t border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <CtaBand
            title="No online booking — phone ahead"
            description="Ring us if you'd like to check a table's free, or just come by. We keep a few open most evenings."
            action={{ label: "Get directions", href: "#find-us" }}
          />
        </div>
      </section>
    </SiteChrome>
  );
}
