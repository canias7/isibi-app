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
    { label: "Who cooks", href: "#kitchen" },
    { label: "Find us", href: "#find-us" },
  ],
  action: { label: "Directions", href: "#find-us" },
};

const DAY_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

function parsePrice(price: string | null): number | undefined {
  if (!price) return undefined;
  const n = Number(price.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

function Home() {
  const dishes = useRows<Dish>("dishes", { order: "course", dir: "asc" });
  const chefs = useRows<Chef>("chefs", { order: "name", dir: "asc" });
  const hours = useRows<Hour>("hours", { order: "day", dir: "asc" });

  const groups = (() => {
    if (!dishes.data?.length) return [];
    const byCourse = new Map<string, Dish[]>();
    for (const d of dishes.data) {
      const course = d.course ?? "Menu";
      const list = byCourse.get(course) ?? [];
      list.push(d);
      byCourse.set(course, list);
    }
    return Array.from(byCourse.entries()).map(([name, items]) => ({
      name,
      items: items.map((d) => ({
        name: d.name,
        description: d.description,
        price: parsePrice(d.price),
      })),
    }));
  })();

  const openNowHours = (hours.data ?? [])
    .filter((h) => h.opens && h.closes)
    .map((h) => ({
      day: DAY_INDEX[h.day.toLowerCase()] ?? 0,
      open: h.opens as string,
      close: h.closes as string,
    }));

  const dayHours: DayHours[] = (hours.data ?? []).map((h, i) => ({
    day: DAY_INDEX[h.day.toLowerCase()] ?? i,
    label: h.day,
    open: h.opens,
    close: h.closes,
  }));

  return (
    <SiteChrome {...CHROME}>
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Pell Street · neighbourhood cooking
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Pell Street Kitchen
          </h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Simple food cooked properly, a short walk from wherever you already are. No booking
            system — ring the number below and we'll hold you a table.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
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
            {!hours.isPending && !hours.isError && openNowHours.length > 0 && (
              <OpenNow hours={openNowHours} />
            )}
          </div>
        </div>
      </section>

      <section id="menu" className="mx-auto max-w-4xl px-6 py-20">
        <SectionHeader
          eyebrow="The menu"
          title="What's on"
          description="Dishes change with what's good this week. Ask what's just come off the pass."
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
            title="Nothing on the menu yet"
            description="The kitchen is putting the list together — check back soon."
          />
        )}
        {!!dishes.data?.length && <MenuSection className="mt-8" groups={groups} />}
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
              title="No team listed yet"
              description="The kitchen line-up will appear here shortly."
            />
          )}
          {!!chefs.data?.length && (
            <TeamGrid
              className="mt-8"
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
                description="Ring ahead and we'll tell you what's open."
              />
            )}
            {!!hours.data?.length && <OpeningHours className="mt-6" days={dayHours} />}
          </div>
          <LocationCard
            className="self-start"
            name="Pell Street Kitchen"
            address="22 Pell Street, Sheffield S3 8GG"
            note="No booking system — give us a ring and we'll hold you a table."
          />
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <CtaBand
          title="We don't take bookings online"
          description="Ring the kitchen and we'll sort you a table — we're usually able to fit you in."
          action={{ label: "Get directions", href: "#find-us" }}
        />
      </section>
    </SiteChrome>
  );
}
