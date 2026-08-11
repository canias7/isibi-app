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

const COURSES = ["Starters", "Mains", "Sides", "Puddings"];

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

function toMinutes(t: string | null): number | null {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function Home() {
  const dishes = useRows<Dish>("dishes", { order: "course", dir: "asc" });
  const chefs = useRows<Chef>("chefs", { order: "name", dir: "asc" });
  const hours = useRows<Hour>("hours");

  const grouped = dishes.data
    ? (() => {
        const known = COURSES.map((name) => ({
          name,
          rows: (dishes.data ?? []).filter((d) => d.course === name),
        })).filter((g) => g.rows.length);
        const knownSet = new Set(COURSES);
        const leftovers = (dishes.data ?? []).filter((d) => !d.course || !knownSet.has(d.course));
        if (leftovers.length) known.push({ name: "More", rows: leftovers });
        return known;
      })()
    : [];

  const openHoursDays: DayHours[] = DAY_ORDER.map((label) => {
    const row = hours.data?.find((h) => h.day === label);
    return {
      day: DAY_INDEX[label],
      label,
      open: row?.opens ?? null,
      close: row?.closes ?? null,
    };
  });

  const openNowHours = (hours.data ?? [])
    .filter((h) => h.opens && h.closes)
    .map((h) => ({ day: DAY_INDEX[h.day] ?? 0, open: h.opens!, close: h.closes! }));

  return (
    <SiteChrome {...CHROME}>
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Pell Street · Neighbourhood kitchen
          </p>
          <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">Pell Street Kitchen</h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">
            No booking system, no fuss — just call and we'll hold you a table. Home cooking, a short
            menu that changes with the season, and the door open on Pell Street six days a week.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <a
              className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground motion-press"
              href="#find-us"
            >
              Directions
            </a>
            <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="#menu">
              See the menu
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
          description="Short, seasonal, and made to order. Ask us about anything with an allergy in mind."
        />

        {dishes.isPending && <Skeleton className="mt-8 h-64 rounded-xl" />}

        {dishes.isError && (
          <p className="mt-8 text-sm text-destructive">
            Couldn't load the menu. Refresh and try again.
          </p>
        )}

        {dishes.data?.length === 0 && (
          <Empty
            className="mt-8"
            title="Menu coming soon"
            description="We're setting the menu — check back shortly, or give us a call."
          />
        )}

        {!!dishes.data?.length && (
          <MenuSection
            className="mt-8"
            groups={grouped.map((g) => ({
              name: g.name,
              items: g.rows.map((d) => ({
                name: d.name,
                description: d.description,
                price: d.price,
              })),
            }))}
          />
        )}
      </section>

      <section id="kitchen" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <SectionHeader
            eyebrow="Who cooks"
            title="The kitchen"
            description="A small team, most of us here since the doors opened."
          />

          {chefs.isPending && <Skeleton className="mt-8 h-40 rounded-xl" />}

          {chefs.isError && (
            <p className="mt-8 text-sm text-destructive">Couldn't load the team. Refresh and try again.</p>
          )}

          {chefs.data?.length === 0 && (
            <Empty
              className="mt-8"
              title="Nothing here yet"
              description="The team's photos and roles will appear here soon."
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
            {hours.isPending && <Skeleton className="mt-6 h-32 rounded-xl" />}
            {hours.isError && (
              <p className="mt-6 text-sm text-destructive">Couldn't load our hours right now.</p>
            )}
            {hours.data?.length === 0 && (
              <p className="mt-6 text-sm text-muted-foreground">Hours coming soon — give us a call.</p>
            )}
            {!!hours.data?.length && <OpeningHours className="mt-6" days={openHoursDays} />}
          </div>
          <LocationCard
            className="self-start"
            name="Pell Street Kitchen"
            address="22 Pell Street"
            note="No booking system — call ahead and we'll hold you a table, especially at weekends."
          />
        </div>
      </section>

      <section className="border-t border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <div className="mb-10 grid gap-4 sm:grid-cols-2">
            <SafeImage src={null} alt="" ratio="4/3" fallbackSeed="pell-street-dining" />
            <SafeImage src={null} alt="" ratio="4/3" fallbackSeed="pell-street-kitchen" />
          </div>
          <CtaBand
            title="We don't take bookings online"
            description="Give us a ring and we'll sort you a table — we're usually good for a table before seven."
            action={{ label: "Get directions", href: "#find-us" }}
          />
        </div>
      </section>
    </SiteChrome>
  );
}
