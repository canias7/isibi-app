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

function courseOrder(course: string | null): number {
  if (!course) return 99;
  const order = ["Starters", "Mains", "Sides", "Desserts", "Drinks"];
  const i = order.indexOf(course);
  return i === -1 ? 50 : i;
}

function Home() {
  const dishes = useRows<Dish>("dishes", { order: "course", dir: "asc" });
  const chefs = useRows<Chef>("chefs", { order: "name", dir: "asc" });
  const hours = useRows<HourRow>("hours", { order: "day", dir: "asc" });

  const groups = dishes.data
    ? Object.entries(
        dishes.data.reduce<Record<string, Dish[]>>((acc, d) => {
          const key = d.course ?? "On the menu";
          if (!acc[key]) acc[key] = [];
          acc[key].push(d);
          return acc;
        }, {}),
      )
        .sort((a, b) => courseOrder(a[0]) - courseOrder(b[0]))
        .map(([name, items]) => ({
          name,
          items: items.map((d) => ({
            name: d.name,
            description: d.description,
            price: d.price,
          })),
        }))
    : [];

  const dayHours: DayHours[] = hours.data
    ? [...hours.data]
        .sort((a, b) => (DAY_INDEX[a.day] ?? 9) - (DAY_INDEX[b.day] ?? 9))
        .map((h) => ({
          day: DAY_INDEX[h.day] ?? 0,
          label: h.day,
          open: h.opens,
          close: h.closes,
        }))
    : [];

  const openNowHours = dayHours
    .filter((h) => h.open && h.close)
    .map((h) => ({ day: h.day, open: h.open!, close: h.close! }));

  return (
    <SiteChrome {...CHROME}>
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-4xl px-6 py-16 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Pell Street · neighbourhood cooking
          </p>
          <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">Pell Street Kitchen</h1>
          <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
            No booking line, no online order form — just come by, or ring if you want to check a table's free.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <a className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" href="#menu">
              See the menu
            </a>
            <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="#find-us">
              Find us
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
          description="Everything's made to order, so a busy Friday might mean a short wait — worth it."
        />
        {dishes.isPending && <Skeleton className="mt-8 h-64 rounded-xl" />}
        {dishes.isError && (
          <p className="mt-8 text-sm text-destructive">Couldn't load the menu. Refresh and try again.</p>
        )}
        {dishes.data?.length === 0 && (
          <Empty className="mt-8" title="The menu isn't listed yet" description="Check back soon, or give us a ring." />
        )}
        {!!dishes.data?.length && <MenuSection className="mt-10" groups={groups} currency="£" />}
      </section>

      <section id="kitchen" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-4xl px-6 py-20">
          <SectionHeader
            eyebrow="Who cooks"
            title="The kitchen"
            description="Small team, same faces most nights."
          />
          {chefs.isPending && <Skeleton className="mt-8 h-40 rounded-xl" />}
          {chefs.isError && (
            <p className="mt-8 text-sm text-destructive">Couldn't load the team. Refresh and try again.</p>
          )}
          {chefs.data?.length === 0 && (
            <Empty className="mt-8" title="Nobody listed yet" description="The kitchen will be introduced here soon." />
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

      <section id="find-us" className="mx-auto max-w-4xl px-6 py-20">
        <div className="grid gap-10 sm:grid-cols-2">
          <div>
            <SectionHeader eyebrow="Find us" title="On Pell Street" />
            <LocationCard
              className="mt-6"
              name="Pell Street Kitchen"
              address="22 Pell Street, Sheffield S3 8GA"
              note="Two minutes' walk from the tram stop. No bookings — we hold no tables."
            />
          </div>
          <div>
            <h3 className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">Opening hours</h3>
            {hours.isPending && <Skeleton className="mt-5 h-40 rounded-xl" />}
            {hours.isError && (
              <p className="mt-5 text-sm text-destructive">Couldn't load our hours. Refresh and try again.</p>
            )}
            {hours.data?.length === 0 && (
              <Empty className="mt-5" title="Hours not listed yet" description="Give us a ring to check we're open." />
            )}
            {!!hours.data?.length && <OpeningHours className="mt-5" days={dayHours} />}
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-muted/40">
        <div className="mx-auto max-w-4xl px-6 py-16">
          <CtaBand
            title="We don't take bookings"
            description="Walk in, or ring ahead if you want to check how busy we are."
            action={{ label: "Get directions", href: "#find-us" }}
          />
        </div>
      </section>
    </SiteChrome>
  );
}
