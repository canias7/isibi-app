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

function toDayHours(rows: Hour[]): DayHours[] {
  return rows
    .map((h) => ({
      day: DAY_ORDER[h.day.toLowerCase()] ?? 0,
      label: h.day,
      open: h.opens,
      close: h.closes,
    }))
    .sort((a, b) => {
      const an = a.day === 0 ? 7 : a.day;
      const bn = b.day === 0 ? 7 : b.day;
      return an - bn;
    });
}

function parsePrice(price: string | null): number | undefined {
  if (!price) return undefined;
  const n = Number(price.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

function Home() {
  const dishes = useRows<Dish>("dishes", { order: "course", dir: "asc" });
  const chefs = useRows<Chef>("chefs", { order: "name", dir: "asc" });
  const hours = useRows<Hour>("hours");

  const groups = (() => {
    if (!dishes.data) return [];
    const byCourse = new Map<string, Dish[]>();
    for (const d of dishes.data) {
      const course = d.course ?? "On the menu";
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

  const dayHours = hours.data ? toDayHours(hours.data) : [];
  const openNowHours = dayHours
    .filter((h) => h.open && h.close)
    .map((h) => ({ day: h.day, open: h.open!, close: h.close! }));

  return (
    <SiteChrome {...CHROME}>
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Pell Street · a table kept for you
          </p>
          <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">
            Pell Street Kitchen
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
            No booking system, no online order — ring the kitchen or walk down and take a
            table. We cook what's good that week and write the price next to it.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <a
              className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
              href="#find-us"
            >
              Directions
            </a>
            <a
              className="rounded-md border border-border px-5 py-2.5 text-sm font-medium"
              href="tel:+441142700123"
            >
              Call to reserve
            </a>
            {!hours.isPending && !hours.isError && openNowHours.length > 0 && (
              <OpenNow hours={openNowHours} />
            )}
          </div>
        </div>
      </section>

      <section id="menu" className="mx-auto max-w-5xl px-6 py-20">
        <SectionHeader
          eyebrow="The menu"
          title="What's cooking"
          description="Short menu, changed often. Ask what's off if something's sold out — it happens on the good nights."
        />
        <div className="mt-10">
          {dishes.isPending && <Skeleton className="h-72 rounded-xl" />}
          {dishes.isError && (
            <p className="text-sm text-destructive">
              Couldn't load the menu. Refresh and try again.
            </p>
          )}
          {dishes.data?.length === 0 && (
            <Empty
              title="Menu coming soon"
              description="We're setting the menu — check back shortly or give us a ring."
            />
          )}
          {groups.length > 0 && <MenuSection groups={groups} />}
        </div>
      </section>

      <section id="kitchen" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <SectionHeader
            eyebrow="The kitchen"
            title="Who cooks"
            description="A small team, most of them here since we opened."
          />
          <div className="mt-8">
            {chefs.isPending && (
              <div className="grid gap-6 sm:grid-cols-3">
                <Skeleton className="h-40 rounded-xl" />
                <Skeleton className="h-40 rounded-xl" />
                <Skeleton className="h-40 rounded-xl" />
              </div>
            )}
            {chefs.isError && (
              <p className="text-sm text-destructive">
                Couldn't load the team. Refresh and try again.
              </p>
            )}
            {chefs.data?.length === 0 && (
              <Empty
                title="Introductions coming soon"
                description="We're putting names to faces here shortly."
              />
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

      <section id="find-us" className="mx-auto max-w-5xl px-6 py-20">
        <SectionHeader eyebrow="Find us" title="On Pell Street" />
        <div className="mt-8 grid gap-10 sm:grid-cols-2">
          <div>
            {hours.isPending && <Skeleton className="h-56 rounded-xl" />}
            {hours.isError && (
              <p className="text-sm text-destructive">
                Couldn't load our hours. Refresh and try again.
              </p>
            )}
            {hours.data?.length === 0 && (
              <Empty title="Hours coming soon" description="Give us a call to check we're open." />
            )}
            {dayHours.length > 0 && <OpeningHours days={dayHours} />}
          </div>
          <LocationCard
            className="self-start"
            name="Pell Street Kitchen"
            address="22 Pell Street, Sheffield S3 8GB"
            note="Look for the green door, two along from the launderette. Street parking after 6pm."
          />
        </div>
      </section>

      <section className="border-t border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <CtaBand
            title="We don't take online bookings"
            description="Give the kitchen a ring to reserve a table, or just come by — it's Pell Street, we're easy to find."
            action={{ label: "Call 0114 270 0123", href: "tel:+441142700123" }}
          />
        </div>
      </section>
    </SiteChrome>
  );
}
