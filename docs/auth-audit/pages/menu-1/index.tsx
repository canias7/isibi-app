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
    { label: "Menu", href: "#menu" },
    { label: "The kitchen", href: "#kitchen" },
    { label: "Find us", href: "#find-us" },
  ],
  action: { label: "Directions", href: "#find-us" },
};

const DAY_ORDER: Record<string, number> = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 0,
};

function dayOrderIndex(day: string) {
  const key = day.trim().toLowerCase();
  return DAY_ORDER[key] ?? 7;
}

function toPrice(price: string | null): number | string | null {
  if (price == null) return null;
  const n = Number(price);
  return Number.isFinite(n) ? n : price;
}

function groupDishes(dishes: Dish[]) {
  const groups = new Map<string, Dish[]>();
  for (const d of dishes) {
    const key = d.course && d.course.trim() ? d.course : "On the menu";
    const list = groups.get(key) ?? [];
    list.push(d);
    groups.set(key, list);
  }
  return Array.from(groups.entries()).map(([name, items]) => ({
    name,
    items: items.map((d) => ({
      name: d.name,
      description: d.description,
      price: toPrice(d.price),
    })),
  }));
}

function Home() {
  const dishes = useRows<Dish>("dishes", { order: "course", dir: "asc" });
  const chefs = useRows<Chef>("chefs", { order: "name", dir: "asc" });
  const hours = useRows<HourRow>("hours", { order: "day", dir: "asc" });

  const sortedHours = hours.data
    ? [...hours.data].sort((a, b) => dayOrderIndex(a.day) - dayOrderIndex(b.day))
    : undefined;

  const dayHours: DayHours[] | undefined = sortedHours?.map((h, i) => ({
    day: dayOrderIndex(h.day),
    label: h.day,
    open: h.opens,
    close: h.closes,
  }));

  const openNowHours =
    sortedHours
      ?.filter((h) => h.opens && h.closes)
      .map((h) => ({ day: dayOrderIndex(h.day), open: h.opens as string, close: h.closes as string })) ?? [];

  return (
    <SiteChrome {...CHROME}>
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Pell Street · neighbourhood cooking
          </p>
          <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">
            Pell Street Kitchen
          </h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">
            A small room, an open kitchen, and a menu that changes with what came in this morning.
            No online booking — ring the number below and we'll hold you a table.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <a
              className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
              href="#find-us"
            >
              Directions
            </a>
            <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="#menu">
              See the menu
            </a>
            {openNowHours.length > 0 && <OpenNow hours={openNowHours} />}
          </div>
        </div>
      </section>

      <section id="menu" className="mx-auto max-w-4xl px-6 py-20">
        <SectionHeader
          eyebrow="The menu"
          title="What we're cooking"
          description="Prices as they stand today. Ask about anything not on the list — it's usually still in the kitchen."
        />
        {dishes.isPending && <Skeleton className="mt-8 h-72 rounded-xl" />}
        {dishes.isError && (
          <p className="mt-8 text-sm text-destructive">
            Couldn't load the menu. Refresh and try again.
          </p>
        )}
        {dishes.data?.length === 0 && (
          <Empty
            className="mt-8"
            title="The menu isn't listed yet"
            description="Check back soon, or give us a ring to hear what's cooking today."
          />
        )}
        {!!dishes.data?.length && (
          <MenuSection className="mt-8" groups={groupDishes(dishes.data)} />
        )}
      </section>

      <section id="kitchen" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <SectionHeader
            eyebrow="Who cooks"
            title="The kitchen"
            description="A small team, cooking the same menu every service."
          />
          {chefs.isPending && <Skeleton className="mt-8 h-40 rounded-xl" />}
          {chefs.isError && (
            <p className="mt-8 text-sm text-destructive">
              Couldn't load the team. Refresh and try again.
            </p>
          )}
          {chefs.data?.length === 0 && (
            <Empty
              className="mt-8"
              title="Nothing to show yet"
              description="The kitchen team will appear here soon."
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
            {hours.isPending && <Skeleton className="mt-6 h-48 rounded-xl" />}
            {hours.isError && (
              <p className="mt-6 text-sm text-destructive">
                Couldn't load our hours. Refresh and try again.
              </p>
            )}
            {hours.data?.length === 0 && (
              <Empty
                className="mt-6"
                title="Hours not listed yet"
                description="Give us a call to check when we're open."
              />
            )}
            {!!dayHours?.length && <OpeningHours className="mt-6" days={dayHours} />}
          </div>
          <LocationCard
            className="self-start"
            name="Pell Street Kitchen"
            address="22 Pell Street"
            note="No online booking — call ahead on a Friday or Saturday and we'll hold you a table."
          />
        </div>
      </section>

      <section className="border-t border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <SafeImage src={null} alt="The dining room at Pell Street Kitchen" ratio="21/9" />
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <CtaBand
          title="We don't take bookings online"
          description="Ring us and we'll hold you a table — we're a phone call away, not a form."
          action={{ label: "Get directions", href: "#find-us" }}
        />
      </section>
    </SiteChrome>
  );
}
