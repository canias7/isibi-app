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
    { label: "The kitchen", href: "#kitchen" },
    { label: "Find us", href: "#find-us" },
    { label: "020 7946 0091", href: "tel:+442079460091" },
  ],
  action: { label: "Call to reserve", href: "tel:+442079460091" },
};

const COURSES = ["Starters", "Mains", "Sides", "Desserts"];

const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_NUMBER: Record<string, number> = {
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
  Sunday: 0,
};

function parsePrice(price: string | null): number | null {
  if (!price) return null;
  const n = Number(price.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function Home() {
  const dishes = useRows<Dish>("dishes", { order: "name", dir: "asc" });
  const chefs = useRows<Chef>("chefs", { order: "name", dir: "asc" });
  const hours = useRows<Hour>("hours", { order: "day", dir: "asc" });

  const dishGroups = COURSES
    .map((name) => ({
      name,
      rows: (dishes.data ?? []).filter((d) => d.course === name),
    }))
    .filter((g) => g.rows.length > 0);

  const leftoverDishes = (dishes.data ?? []).filter((d) => !COURSES.includes(d.course ?? ""));
  if (leftoverDishes.length) {
    dishGroups.push({ name: "More from the kitchen", rows: leftoverDishes });
  }

  const sortedHours = [...(hours.data ?? [])].sort(
    (a, b) => (DAY_ORDER.indexOf(a.day) === -1 ? 99 : DAY_ORDER.indexOf(a.day)) - (DAY_ORDER.indexOf(b.day) === -1 ? 99 : DAY_ORDER.indexOf(b.day)),
  );

  const openNowHours = sortedHours
    .filter((h) => h.opens && h.closes && DAY_NUMBER[h.day] !== undefined)
    .map((h) => ({ day: DAY_NUMBER[h.day], open: h.opens as string, close: h.closes as string }));

  const dayHours: DayHours[] = sortedHours.map((h) => ({
    day: DAY_NUMBER[h.day] ?? 8,
    label: h.day,
    open: h.opens,
    close: h.closes,
  }));

  return (
    <SiteChrome {...CHROME}>
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <div className="grid items-center gap-10 lg:grid-cols-[1.2fr_1fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Pell Street · neighbourhood kitchen
              </p>
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">Pell Street Kitchen</h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                A short walk from the tram stop, a table most nights, and a menu that does not change
                just because we can. We don't take bookings online — ring us and we'll hold a table.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <a
                  className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
                  href="tel:+442079460091"
                >
                  Call to reserve
                </a>
                <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="#find-us">
                  Directions
                </a>
                {!hours.isPending && !hours.isError && openNowHours.length > 0 && (
                  <OpenNow hours={openNowHours} />
                )}
              </div>
            </div>
            <SafeImage src={null} alt="" ratio="4/3" fallbackSeed="psk-hero" />
          </div>
        </div>
      </section>

      <section id="menu" className="mx-auto max-w-5xl px-6 py-20">
        <SectionHeader
          eyebrow="The menu"
          title="What we're cooking"
          description="Everything made in-house, priced plainly, and worth asking about if a name doesn't say enough."
        />
        {dishes.isPending && <Skeleton className="mt-8 h-64 rounded-xl" />}
        {dishes.isError && (
          <p className="mt-8 text-sm text-destructive">Couldn't load the menu. Refresh and try again.</p>
        )}
        {!dishes.isPending && !dishes.isError && dishes.data?.length === 0 && (
          <Empty className="mt-8" title="The menu isn't posted yet" description="Check back soon, or give us a ring." />
        )}
        {!!dishGroups.length && (
          <MenuSection
            className="mt-10"
            groups={dishGroups.map((g) => ({
              name: g.name,
              items: g.rows.map((d) => ({
                name: d.name,
                description: d.description,
                price: parsePrice(d.price) ?? d.price,
              })),
            }))}
          />
        )}
      </section>

      <section id="kitchen" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <SectionHeader eyebrow="The kitchen" title="Who cooks" description="Small team, same faces most nights." />
          {chefs.isPending && <Skeleton className="mt-8 h-40 rounded-xl" />}
          {chefs.isError && (
            <p className="mt-8 text-sm text-destructive">Couldn't load the team. Refresh and try again.</p>
          )}
          {!chefs.isPending && !chefs.isError && chefs.data?.length === 0 && (
            <Empty className="mt-8" title="Nobody listed yet" description="The team will appear here soon." />
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
            <LocationCard
              className="mt-6"
              name="Pell Street Kitchen"
              address="22 Pell Street, London E1 2QN"
              note="Two minutes from Pell Street tram stop. No bookings online — ring us on 020 7946 0091."
            />
          </div>
          <div>
            <h3 className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">Opening hours</h3>
            {hours.isPending && <Skeleton className="mt-5 h-48 rounded-xl" />}
            {hours.isError && (
              <p className="mt-5 text-sm text-destructive">Couldn't load our hours. Refresh and try again.</p>
            )}
            {!hours.isPending && !hours.isError && hours.data?.length === 0 && (
              <Empty className="mt-5" title="Hours not posted yet" description="Give us a ring to check." />
            )}
            {!!dayHours.length && <OpeningHours className="mt-5" days={dayHours} />}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <CtaBand
          title="We don't take bookings online"
          description="Ring us and we'll hold you a table — most weeknights we can fit you in."
          action={{ label: "Call 020 7946 0091", href: "tel:+442079460091" }}
        />
      </section>
    </SiteChrome>
  );
}
