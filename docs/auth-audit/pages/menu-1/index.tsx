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
  tagline: "A neighbourhood kitchen on Pell Street.",
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

function toDayHours(rows: Hour[]): DayHours[] {
  return rows
    .map((h) => ({
      day: DAY_ORDER[h.day.toLowerCase()] ?? 0,
      label: h.day,
      open: h.opens,
      close: h.closes,
    }))
    .sort((a, b) => {
      const order = (d: number) => (d === 0 ? 7 : d);
      return order(a.day) - order(b.day);
    });
}

function Home() {
  const dishes = useRows<Dish>("dishes", { order: "course", dir: "asc" });
  const chefs = useRows<Chef>("chefs", { order: "name", dir: "asc" });
  const hours = useRows<Hour>("hours", { order: "id", dir: "asc" });

  const dayHours = hours.data ? toDayHours(hours.data) : [];
  const openNowHours = dayHours
    .filter((d) => d.open && d.close)
    .map((d) => ({ day: d.day, open: d.open!, close: d.close! }));

  const groups = (() => {
    if (!dishes.data) return [];
    const byCourse = new Map<string, Dish[]>();
    for (const d of dishes.data) {
      const key = d.course?.trim() || "On the menu";
      if (!byCourse.has(key)) byCourse.set(key, []);
      byCourse.get(key)!.push(d);
    }
    return Array.from(byCourse.entries()).map(([name, items]) => ({
      name,
      items: items.map((d) => ({
        name: d.name,
        description: d.description,
        price: d.price,
      })),
    }));
  })();

  return (
    <SiteChrome {...CHROME}>
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-4xl px-6 py-14">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Pell Street · neighbourhood kitchen
          </p>
          <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">
            Pell Street Kitchen
          </h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Honest cooking, a short menu that changes with what's good, and a table
            for you most nights without a booking.
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
            {!hours.isPending && !hours.isError && openNowHours.length > 0 && (
              <OpenNow hours={openNowHours} />
            )}
          </div>
        </div>
      </section>

      <section id="menu" className="mx-auto max-w-4xl px-6 py-20">
        <SectionHeader
          eyebrow="The menu"
          title="What we're cooking"
          description="No phone bookings needed to see it — just what's on, priced plainly."
        />
        <div className="mt-10">
          {dishes.isPending && <Skeleton className="h-64 rounded-xl" />}
          {dishes.isError && (
            <p className="text-sm text-destructive">
              Couldn't load the menu just now. Refresh and try again.
            </p>
          )}
          {dishes.data?.length === 0 && (
            <Empty
              title="Menu coming soon"
              description="We're putting the finishing touches on the menu — check back shortly."
            />
          )}
          {!!dishes.data?.length && <MenuSection groups={groups} currency="£" />}
        </div>
      </section>

      <section id="kitchen" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-4xl px-6 py-20">
          <SectionHeader
            eyebrow="Who cooks"
            title="The kitchen"
            description="The people behind the pass, most nights of the week."
          />
          <div className="mt-10">
            {chefs.isPending && <Skeleton className="h-40 rounded-xl" />}
            {chefs.isError && (
              <p className="text-sm text-destructive">
                Couldn't load the team just now.
              </p>
            )}
            {chefs.data?.length === 0 && (
              <Empty
                title="Meet the team soon"
                description="We'll be introducing the kitchen here shortly."
              />
            )}
            {!!chefs.data?.length && (
              <TeamGrid
                items={chefs.data.map((c) => ({
                  name: c.name,
                  role: c.role,
                  photo: c.photo_url,
                  fallbackSeed: c.name,
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
              address="22 Pell Street"
              note="No bookings — walk in, and if we're full we'll pour you something while you wait."
            />
          </div>
          <div>
            <h3 className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Opening hours
            </h3>
            {hours.isPending && <Skeleton className="mt-5 h-48 rounded-xl" />}
            {hours.isError && (
              <p className="mt-5 text-sm text-destructive">Couldn't load our hours right now.</p>
            )}
            {hours.data?.length === 0 && (
              <p className="mt-5 text-sm text-muted-foreground">
                Hours will be posted here shortly — call ahead for now.
              </p>
            )}
            {!!hours.data?.length && <OpeningHours className="mt-5" days={dayHours} />}
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-muted/40">
        <div className="mx-auto max-w-4xl px-6 py-16">
          <CtaBand
            title="We don't take bookings online"
            description="Come by, or give us a ring if you want to check we've got room."
            action={{ label: "Get directions", href: "#find-us" }}
          />
        </div>
      </section>
    </SiteChrome>
  );
}
