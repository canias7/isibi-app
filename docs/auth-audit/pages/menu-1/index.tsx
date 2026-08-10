import { createFileRoute } from "@tanstack/react-router";
import { useRows, type Row } from "@/lib/rows";
import { SiteChrome } from "@/components/ui/site-chrome";
import { CtaBand } from "@/components/ui/cta-band";
import { LocationCard } from "@/components/ui/location-card";
import { MenuSection } from "@/components/ui/menu-section";
import { OpenNow } from "@/components/ui/open-now";
import { OpeningHours, type DayHours } from "@/components/ui/opening-hours";
import { SafeImage } from "@/components/ui/safe-image";
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
    { label: "0114 270 8811", href: "tel:+441142708811" },
  ],
  action: { label: "Call to reserve", href: "tel:+441142708811" },
};

const COURSES = ["Starters", "Mains", "Sides", "Desserts", "Drinks"];

const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_INDEX: Record<string, number> = {
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
  Sunday: 0,
};

function Home() {
  const dishes = useRows<Dish>("dishes", { order: "price", dir: "asc" });
  const chefs = useRows<Chef>("chefs", { order: "name", dir: "asc" });
  const hours = useRows<HourRow>("hours");

  const grouped = (() => {
    const rows = dishes.data ?? [];
    const known = COURSES
      .map((name) => ({ name, rows: rows.filter((r) => r.course === name) }))
      .filter((g) => g.rows.length);
    const rest = rows.filter((r) => !r.course || !COURSES.includes(r.course));
    if (rest.length) known.push({ name: "More", rows: rest });
    return known;
  })();

  const orderedDays: DayHours[] = (() => {
    const rows = hours.data ?? [];
    return DAY_ORDER.map((label) => {
      const row = rows.find((r) => r.day === label);
      return {
        day: DAY_INDEX[label],
        label,
        open: row?.opens ?? null,
        close: row?.closes ?? null,
      };
    });
  })();

  const openNowHours = orderedDays
    .filter((d) => d.open && d.close)
    .map((d) => ({ day: d.day, open: d.open!, close: d.close! }));

  return (
    <SiteChrome {...CHROME}>
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Pell Street · neighbourhood kitchen
          </p>
          <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">Pell Street Kitchen</h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
            A dozen tables, a short menu that changes with the season, and a kitchen you can see
            from most of them. We don't take bookings online — ring us and we'll hold you a table.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <a
              className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground motion-press"
              href="tel:+441142708811"
            >
              Call to reserve
            </a>
            <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="#find-us">
              Directions
            </a>
            {openNowHours.length > 0 && <OpenNow hours={openNowHours} />}
          </div>
        </div>
      </section>

      <section id="menu" className="mx-auto max-w-4xl px-6 py-20">
        <SectionHeader
          eyebrow="The menu"
          title="What's on"
          description="Short by choice — everything on it is something the kitchen wants to be judged on."
        />
        {dishes.isPending && (
          <div className="mt-8 space-y-3">
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-48 w-full rounded-md" />
          </div>
        )}
        {dishes.isError && (
          <p className="mt-8 text-sm text-destructive">
            Couldn't load the menu. Refresh and try again.
          </p>
        )}
        {!dishes.isPending && !dishes.isError && grouped.length === 0 && (
          <Empty
            className="mt-8"
            title="Nothing on the menu yet"
            description="Check back soon — we're putting the season's dishes up shortly."
          />
        )}
        {grouped.length > 0 && (
          <MenuSection
            className="mt-10"
            groups={grouped.map((g) => ({
              name: g.name,
              items: g.rows.map((r) => ({
                name: r.name,
                description: r.description,
                price: r.price,
              })),
            }))}
          />
        )}
      </section>

      <section id="kitchen" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-4xl px-6 py-20">
          <SectionHeader
            eyebrow="The kitchen"
            title="Who cooks"
            description="Small brigade, long hours, and every plate goes past the same pass."
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
              title="No one listed yet"
              description="The team will be up here shortly."
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
            {hours.isPending && <Skeleton className="mt-6 h-48 rounded-xl" />}
            {hours.isError && (
              <p className="mt-6 text-sm text-destructive">
                Couldn't load our hours. Refresh and try again.
              </p>
            )}
            {!hours.isPending && !hours.isError && (
              <>
                {openNowHours.length > 0 && <div className="mt-6"><OpenNow hours={openNowHours} /></div>}
                <OpeningHours className="mt-4" days={orderedDays} />
              </>
            )}
          </div>
          <SafeImage src={null} alt="" ratio="4/3" fallbackSeed="pell-street-frontage" className="self-start" />
        </div>
        <LocationCard
          className="mt-10"
          name="Pell Street Kitchen"
          address="22 Pell Street, off the market square"
          note="On-street parking after 6pm, or the multi-storey two minutes up the hill. No bookings taken online — ring ahead and we'll hold your table."
        />
      </section>

      <section className="border-t border-border bg-muted/40">
        <div className="mx-auto max-w-4xl px-6 py-16">
          <CtaBand
            title="We take reservations by phone"
            description="Ring 0114 270 8811 and we'll hold you a table — busiest Friday and Saturday from 7."
            action={{ label: "Call 0114 270 8811", href: "tel:+441142708811" }}
          />
        </div>
      </section>
    </SiteChrome>
  );
}
