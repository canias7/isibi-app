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

const DAY_NUMBERS: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

function dayNumber(day: string): number {
  const key = day.trim().toLowerCase();
  return DAY_NUMBERS[key] ?? 0;
}

function courseOrder(course: string | null): number {
  const order = ["starters", "mains", "sides", "desserts", "drinks"];
  const key = (course ?? "").trim().toLowerCase();
  const idx = order.indexOf(key);
  return idx === -1 ? order.length : idx;
}

function Home() {
  const dishes = useRows<Dish>("dishes", { order: "course", dir: "asc", limit: 100 });
  const chefs = useRows<Chef>("chefs", { order: "name", dir: "asc" });
  const hours = useRows<HourRow>("hours", { order: "day", dir: "asc" });

  const groupedMenu = (() => {
    if (!dishes.data?.length) return [];
    const groups = new Map<string, Dish[]>();
    for (const d of dishes.data) {
      const key = d.course ?? "Other";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(d);
    }
    return Array.from(groups.entries())
      .sort((a, b) => courseOrder(a[0]) - courseOrder(b[0]))
      .map(([name, items]) => ({
        name,
        items: items.map((d) => ({
          name: d.name,
          description: d.description,
          price: d.price,
        })),
      }));
  })();

  const dayHours: DayHours[] = (hours.data ?? []).map((h) => ({
    day: dayNumber(h.day),
    label: h.day,
    open: h.opens,
    close: h.closes,
  }));

  const openNowInput = dayHours
    .filter((h) => h.open && h.close)
    .map((h) => ({ day: h.day, open: h.open!, close: h.close! }));

  return (
    <SiteChrome {...CHROME}>
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-4xl px-6 py-14">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Pell Street · neighbourhood kitchen
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Pell Street Kitchen
          </h1>
          <p className="mt-4 max-w-lg text-lg leading-relaxed text-muted-foreground">
            No online booking here — ring the kitchen and we'll hold you a table.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
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
            {!hours.isPending && !hours.isError && openNowInput.length > 0 && (
              <OpenNow hours={openNowInput} />
            )}
          </div>
        </div>
      </section>

      <section id="menu" className="mx-auto max-w-4xl px-6 py-20">
        <SectionHeader
          eyebrow="The menu"
          title="What's cooking"
          description="Seasonal, and shortest when the ingredients are best."
        />
        <div className="mt-10">
          {dishes.isPending && <Skeleton className="h-64 rounded-xl" />}
          {dishes.isError && (
            <p className="text-sm text-destructive">
              Couldn't load the menu. Refresh and try again.
            </p>
          )}
          {dishes.data?.length === 0 && (
            <Empty title="Menu coming soon" description="We're setting the menu — check back shortly." />
          )}
          {!!dishes.data?.length && <MenuSection groups={groupedMenu} currency="£" />}
        </div>
      </section>

      <section id="kitchen" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-4xl px-6 py-20">
          <SectionHeader
            eyebrow="Who cooks"
            title="The kitchen"
            description="The hands behind every plate that comes out of that pass."
          />
          <div className="mt-10">
            {chefs.isPending && <Skeleton className="h-40 rounded-xl" />}
            {chefs.isError && (
              <p className="text-sm text-destructive">
                Couldn't load the team. Refresh and try again.
              </p>
            )}
            {chefs.data?.length === 0 && (
              <Empty title="Team coming soon" description="Introductions are on their way." />
            )}
            {!!chefs.data?.length && (
              <TeamGrid
                items={chefs.data.map((c) => ({
                  name: c.name,
                  role: c.role,
                  photo: c.photo_url,
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
            <LocationCard
              className="mt-6"
              name="Pell Street Kitchen"
              address="Pell Street"
              note="No online booking — call ahead and we'll hold you a table."
            />
          </div>
          <div>
            <h3 className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Opening hours
            </h3>
            <div className="mt-5">
              {hours.isPending && <Skeleton className="h-48 rounded-xl" />}
              {hours.isError && (
                <p className="text-sm text-destructive">
                  Couldn't load our hours. Refresh and try again.
                </p>
              )}
              {hours.data?.length === 0 && (
                <Empty title="Hours coming soon" description="We're finalising our opening times." />
              )}
              {!!hours.data?.length && <OpeningHours days={dayHours} />}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-muted/40">
        <div className="mx-auto max-w-4xl px-6 py-16">
          <CtaBand
            title="We don't take bookings online"
            description="Give the kitchen a ring and we'll sort you a table."
            action={{ label: "Get directions", href: "#find-us" }}
          />
        </div>
      </section>
    </SiteChrome>
  );
}
