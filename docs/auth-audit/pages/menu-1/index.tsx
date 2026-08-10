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
  tagline: "A neighbourhood table on Pell Street. No bookings — just come, or ring ahead.",
  links: [
    { label: "Menu", href: "#menu" },
    { label: "Kitchen", href: "#kitchen" },
    { label: "Find us", href: "#find-us" },
  ],
  action: { label: "Directions", href: "#find-us" },
};

const COURSES = ["Starters", "Mains", "Desserts"];

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

function Home() {
  const dishes = useRows<Dish>("dishes", { order: "name", dir: "asc" });
  const chefs = useRows<Chef>("chefs", { order: "name", dir: "asc" });
  const hours = useRows<HourRow>("hours", { order: "day", dir: "asc" });

  const groups = COURSES.map((name) => ({
    name,
    rows: (dishes.data ?? []).filter((d) => d.course === name),
  })).filter((g) => g.rows.length);

  const known = new Set(COURSES);
  const leftover = (dishes.data ?? []).filter((d) => !known.has(d.course ?? ""));
  if (leftover.length) groups.push({ name: "Also on the table", rows: leftover });

  const dayHours: DayHours[] = DAY_ORDER.map((label) => {
    const row = hours.data?.find((h) => h.day === label);
    return {
      day: DAY_INDEX[label],
      label,
      open: row?.opens ?? null,
      close: row?.closes ?? null,
    };
  });

  const openNowHours = (hours.data ?? [])
    .filter((h) => h.opens && h.closes && DAY_INDEX[h.day] !== undefined)
    .map((h) => ({ day: DAY_INDEX[h.day], open: h.opens!, close: h.closes! }));

  return (
    <SiteChrome {...CHROME}>
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-4xl px-6 py-16 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Pell Street · neighbourhood cooking
          </p>
          <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">
            Pell Street Kitchen
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
            A small room, a short menu, and the same people cooking it most nights. No online
            booking here — ring us and we'll hold you a table.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
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
          title="What's cooking"
          description="Short on purpose — everything on it is made that day."
        />
        <div className="mt-10">
          {dishes.isPending && <Skeleton className="h-64 rounded-xl" />}
          {dishes.isError && (
            <p className="text-sm text-destructive">
              Couldn't load the menu. Refresh and try again.
            </p>
          )}
          {!dishes.isPending && !dishes.isError && dishes.data?.length === 0 && (
            <p className="text-sm text-muted-foreground">
              The menu isn't listed yet — call us and we'll talk you through tonight's.
            </p>
          )}
          {!!groups.length && (
            <MenuSection
              groups={groups.map((g) => ({
                name: g.name,
                items: g.rows.map((d) => ({
                  name: d.name,
                  description: d.description,
                  price: d.price,
                })),
              }))}
            />
          )}
        </div>
      </section>

      <section id="kitchen" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-4xl px-6 py-20">
          <SectionHeader
            eyebrow="Who cooks"
            title="The kitchen"
            description="Same faces most nights — say hello at the pass."
          />
          <div className="mt-10">
            {chefs.isPending && <Skeleton className="h-40 rounded-xl" />}
            {chefs.isError && (
              <p className="text-sm text-destructive">Couldn't load the team just now.</p>
            )}
            {!chefs.isPending && !chefs.isError && chefs.data?.length === 0 && (
              <p className="text-sm text-muted-foreground">
                We haven't listed the team yet — ask whoever's on the pass.
              </p>
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
        <SectionHeader eyebrow="Find us" title="On Pell Street" />
        <div className="mt-10 grid gap-10 sm:grid-cols-2">
          <div>
            <LocationCard
              name="Pell Street Kitchen"
              address="22 Pell Street, London, E1 4NX"
              note="No bookings taken online — call 020 7946 0823 and we'll hold you a table."
            />
            <SafeImage
              src={null}
              alt=""
              ratio="4/3"
              fallbackSeed="pell-street-front"
              className="mt-6"
            />
          </div>
          <div>
            <h3 className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Opening hours
            </h3>
            {hours.isPending && <Skeleton className="mt-5 h-56 rounded-xl" />}
            {hours.isError && (
              <p className="mt-5 text-sm text-destructive">Couldn't load our hours right now.</p>
            )}
            {!hours.isPending && !hours.isError && hours.data?.length === 0 && (
              <p className="mt-5 text-sm text-muted-foreground">
                Hours aren't listed yet — give us a ring.
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
            description="Call us on 020 7946 0823, or just come by — walk-ins are always welcome."
            action={{ label: "Get directions", href: "#find-us" }}
          />
        </div>
      </section>
    </SiteChrome>
  );
}
