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
    { label: "Kitchen", href: "#kitchen" },
    { label: "Find us", href: "#find-us" },
    { label: "0114 233 0000", href: "tel:+441142330000" },
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

function parseTimeToMinutes(t: string | null): number | null {
  if (!t) return null;
  const m = t.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function courseOrder(course: string | null): number {
  if (!course) return 99;
  const key = course.toLowerCase();
  if (key.includes("starter")) return 0;
  if (key.includes("main")) return 1;
  if (key.includes("side")) return 2;
  if (key.includes("dessert") || key.includes("pudding")) return 3;
  if (key.includes("drink")) return 4;
  return 50;
}

function Home() {
  const dishes = useRows<Dish>("dishes", { order: "course", dir: "asc" });
  const chefs = useRows<Chef>("chefs", { order: "name", dir: "asc" });
  const hours = useRows<Hour>("hours", { order: "day", dir: "asc" });

  const groupedDishes = (() => {
    if (!dishes.data) return [];
    const groups = new Map<string, Dish[]>();
    for (const d of dishes.data) {
      const course = d.course ?? "On the menu";
      if (!groups.has(course)) groups.set(course, []);
      groups.get(course)!.push(d);
    }
    return Array.from(groups.entries())
      .sort((a, b) => courseOrder(a[0]) - courseOrder(b[0]))
      .map(([name, items]) => ({
        name,
        items: items.map((d) => ({
          name: d.name,
          description: d.description,
          price: d.price ? parsePrice(d.price) : null,
        })),
      }));
  })();

  const openHours: DayHours[] = (() => {
    if (!hours.data) return [];
    return hours.data
      .map((h) => ({
        day: DAY_ORDER[h.day.toLowerCase()] ?? 0,
        label: h.day.charAt(0).toUpperCase() + h.day.slice(1).toLowerCase(),
        open: h.opens,
        close: h.closes,
      }))
      .sort((a, b) => {
        const rank = (d: number) => (d === 0 ? 7 : d);
        return rank(a.day) - rank(b.day);
      });
  })();

  const openNowHours = openHours
    .filter((h) => h.open && h.close)
    .map((h) => ({ day: h.day, open: h.open!, close: h.close! }));

  return (
    <SiteChrome {...CHROME}>
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-4xl px-6 py-14">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Pell Street · a table when you want one
          </p>
          <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">
            Pell Street Kitchen
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Honest plates, a short menu that changes with the season, and a kitchen you can see
            from most of the tables. No online booking — ring us, or just come in.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <a
              className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
              href="#menu"
            >
              See the menu
            </a>
            <a
              href="tel:+441142330000"
              className="rounded-md border border-border px-5 py-2.5 text-sm font-medium"
            >
              Call 0114 233 0000
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
          title="What's cooking"
          description="Short by design — everything on it is here because it earns its place."
        />
        <div className="mt-10">
          {dishes.isPending && <Skeleton className="h-64 rounded-xl" />}
          {dishes.isError && (
            <p className="text-sm text-destructive">
              Couldn't load the menu. Refresh and try again.
            </p>
          )}
          {dishes.data?.length === 0 && (
            <Empty
              title="Menu coming soon"
              description="We're setting the table — check back shortly for what's cooking."
            />
          )}
          {!!dishes.data?.length && <MenuSection groups={groupedDishes} />}
        </div>
      </section>

      <section id="kitchen" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-4xl px-6 py-20">
          <SectionHeader
            eyebrow="The kitchen"
            title="Who cooks"
            description="Small team, long hours, and every plate leaves the pass looked at twice."
          />
          <div className="mt-8">
            {chefs.isPending && <Skeleton className="h-40 rounded-xl" />}
            {chefs.isError && (
              <p className="text-sm text-destructive">
                Couldn't load the team. Refresh and try again.
              </p>
            )}
            {chefs.data?.length === 0 && (
              <Empty
                title="Introductions soon"
                description="The team's photos and roles will be here shortly."
              />
            )}
            {!!chefs.data?.length && (
              <TeamGrid
                items={chefs.data.map((c) => ({
                  name: c.name,
                  role: c.role ?? "",
                  photo: c.photo_url ?? undefined,
                }))}
              />
            )}
          </div>
        </div>
      </section>

      <section id="find-us" className="mx-auto max-w-4xl px-6 py-20">
        <div className="grid gap-10 sm:grid-cols-2">
          <div>
            <SectionHeader eyebrow="Find us" title="On Pell Street" />
            <div className="mt-6">
              {hours.isPending && <Skeleton className="h-48 rounded-xl" />}
              {hours.isError && (
                <p className="text-sm text-destructive">
                  Couldn't load our hours. Refresh and try again.
                </p>
              )}
              {hours.data?.length === 0 && (
                <Empty
                  title="Hours coming soon"
                  description="We're finalising opening times — ring ahead for now."
                />
              )}
              {!!hours.data?.length && <OpeningHours days={openHours} />}
            </div>
          </div>
          <LocationCard
            className="self-start"
            name="Pell Street Kitchen"
            address="22 Pell Street, Sheffield S3 8GJ"
            note="Street parking after 6pm, or the Pell Street car park two minutes' walk away."
          />
        </div>
      </section>

      <section className="border-t border-border bg-muted/40">
        <div className="mx-auto max-w-4xl px-6 py-16">
          <CtaBand
            title="No online booking — just ring us"
            description="We hold a handful of tables for phone bookings each evening. The rest is first come."
            action={{ label: "Call 0114 233 0000", href: "tel:+441142330000" }}
          />
        </div>
      </section>
    </SiteChrome>
  );
}

function parsePrice(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}
