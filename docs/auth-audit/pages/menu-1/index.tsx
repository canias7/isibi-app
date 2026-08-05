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

const DAY_ORDER: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
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

function toDayHours(rows: HourRow[]): DayHours[] {
  return rows
    .filter((r) => r.day)
    .map((r) => ({
      day: DAY_ORDER[r.day.toLowerCase()] ?? 0,
      label: r.day,
      open: r.opens,
      close: r.closes,
    }))
    .sort((a, b) => (a.day === 0 ? 7 : a.day) - (b.day === 0 ? 7 : b.day));
}

function Home() {
  const dishes = useRows<Dish>("dishes", { order: "course", dir: "asc" });
  const chefs = useRows<Chef>("chefs", { order: "name", dir: "asc" });
  const hours = useRows<HourRow>("hours", { order: "id", dir: "asc" });

  const dayHours = hours.data ? toDayHours(hours.data) : [];
  const openNowHours = dayHours
    .filter((h) => h.open && h.close)
    .map((h) => ({ day: h.day, open: h.open!, close: h.close! }));

  const groupsMap = new Map<string, Dish[]>();
  for (const d of dishes.data ?? []) {
    const key = d.course ?? "Menu";
    if (!groupsMap.has(key)) groupsMap.set(key, []);
    groupsMap.get(key)!.push(d);
  }
  const groups = Array.from(groupsMap.entries()).map(([name, items]) => ({
    name,
    items: items.map((d) => ({
      name: d.name,
      description: d.description,
      price: d.price,
    })),
  }));

  return (
    <SiteChrome {...CHROME}>
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-4xl px-6 py-14 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Pell Street · neighbourhood kitchen
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Pell Street Kitchen
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            Honest cooking, a short menu, and a table if you can find one. No online booking here — ring
            us and we'll hold you a seat.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <a
              className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground motion-press"
              href="tel:+441142700123"
            >
              Call to reserve
            </a>
            <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="#find-us">
              Directions
            </a>
            {hours.isPending && <Skeleton className="h-9 w-40 rounded-md" />}
            {!hours.isPending && !hours.isError && dayHours.length > 0 && (
              <OpenNow hours={openNowHours} />
            )}
          </div>
        </div>
      </section>

      <section id="menu" className="mx-auto max-w-3xl px-6 py-20">
        <SectionHeader
          eyebrow="The menu"
          title="What we're cooking"
          description="Short, seasonal, and it changes when the market does. Ask about tonight's specials."
        />

        {dishes.isPending && (
          <div className="mt-8 space-y-3">
            <Skeleton className="h-8 w-full rounded-md" />
            <Skeleton className="h-8 w-full rounded-md" />
            <Skeleton className="h-8 w-full rounded-md" />
            <Skeleton className="h-8 w-full rounded-md" />
          </div>
        )}

        {dishes.isError && (
          <p className="mt-8 text-sm text-destructive">
            Couldn't load the menu. Refresh and try again.
          </p>
        )}

        {!dishes.isPending && !dishes.isError && dishes.data?.length === 0 && (
          <Empty
            className="mt-8"
            title="Menu coming soon"
            description="We're setting the table. Check back shortly, or give us a call."
          />
        )}

        {!!dishes.data?.length && <MenuSection className="mt-8" groups={groups} />}
      </section>

      <section id="kitchen" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <SectionHeader
            eyebrow="Who cooks"
            title="The kitchen"
            description="A small team, a short menu, and everything made from scratch."
          />

          {chefs.isPending && (
            <div className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-4">
              <Skeleton className="h-40 rounded-xl" />
              <Skeleton className="h-40 rounded-xl" />
              <Skeleton className="h-40 rounded-xl" />
              <Skeleton className="h-40 rounded-xl" />
            </div>
          )}

          {chefs.isError && (
            <p className="mt-8 text-sm text-destructive">
              Couldn't load the team. Refresh and try again.
            </p>
          )}

          {!chefs.isPending && !chefs.isError && chefs.data?.length === 0 && (
            <Empty
              className="mt-8"
              title="Introductions to follow"
              description="We'll add the team here soon."
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
            <LocationCard
              className="mt-6"
              name="Pell Street Kitchen"
              address="22 Pell Street, Sheffield S3 8GT"
              note="Street parking after 6pm. No bookings taken online — call ahead on a Friday or Saturday."
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
            {!hours.isPending && !hours.isError && dayHours.length === 0 && (
              <Empty
                className="mt-5"
                title="Hours coming soon"
                description="Give us a call to check when we're open."
              />
            )}
            {dayHours.length > 0 && <OpeningHours className="mt-5" days={dayHours} />}
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <CtaBand
            title="We don't take bookings online"
            description="Give us a ring and we'll hold you a table — we're a small room, so it helps to call ahead on weekends."
            action={{ label: "Call to reserve", href: "tel:+441142700123" }}
          />
        </div>
      </section>
    </SiteChrome>
  );
}
