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
import { SafeImage } from "@/components/ui/safe-image";
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
    { label: "The menu", href: "#menu" },
    { label: "Who cooks", href: "#kitchen" },
    { label: "Find us", href: "#find-us" },
  ],
  action: { label: "Directions", href: "#find-us" },
};

const COURSES = ["Starters", "Mains", "Sides", "Desserts"];

const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const DAY_NUMBER: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

function toPrice(p: string | null): number | string | null {
  if (p == null) return null;
  const n = Number(p);
  return Number.isFinite(n) ? n : p;
}

function Home() {
  const dishes = useRows<Dish>("dishes", { order: "name", dir: "asc" });
  const chefs = useRows<Chef>("chefs", { order: "name", dir: "asc" });
  const hours = useRows<Hour>("hours");

  const dishRows = dishes.data ?? [];
  const grouped = COURSES.map((name) => ({
    name,
    rows: dishRows.filter((d) => d.course === name),
  })).filter((g) => g.rows.length);
  const knownCourses = new Set(COURSES);
  const leftover = dishRows.filter((d) => !d.course || !knownCourses.has(d.course));
  if (leftover.length) {
    grouped.push({ name: "More from the kitchen", rows: leftover });
  }

  const hourRows = hours.data ?? [];
  const sortedHours = [...hourRows].sort((a, b) => {
    const ai = DAY_ORDER.indexOf(a.day);
    const bi = DAY_ORDER.indexOf(b.day);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  const dayHours: DayHours[] = sortedHours.map((h) => ({
    day: DAY_NUMBER[h.day] ?? 0,
    label: h.day,
    open: h.opens,
    close: h.closes,
  }));
  const openNowHours = dayHours
    .filter((h) => h.open && h.close)
    .map((h) => ({ day: h.day, open: h.open!, close: h.close! }));

  return (
    <SiteChrome {...CHROME}>
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-4xl px-6 py-14 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Pell Street
          </p>
          <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">
            Pell Street Kitchen
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Home cooking, a short walk from wherever you are on the street.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {openNowHours.length > 0 && <OpenNow hours={openNowHours} />}
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
          </div>
        </div>
      </section>

      <section id="menu" className="mx-auto max-w-4xl px-6 py-20">
        <SectionHeader
          eyebrow="The menu"
          title="What's cooking"
          description="Everything made in-house. Ask your server about the specials chalked up on the board."
        />
        {dishes.isPending && <Skeleton className="mt-8 h-64 rounded-xl" />}
        {dishes.isError && (
          <p className="mt-8 text-sm text-destructive">
            Couldn't load the menu. Refresh and try again.
          </p>
        )}
        {!dishes.isPending && !dishes.isError && dishRows.length === 0 && (
          <Empty
            className="mt-8"
            title="Nothing on the menu yet"
            description="Check back soon — the kitchen is still setting the board."
          />
        )}
        {grouped.length > 0 && (
          <MenuSection
            className="mt-10"
            groups={grouped.map((g) => ({
              name: g.name,
              items: g.rows.map((d) => ({
                name: d.name,
                description: d.description,
                price: toPrice(d.price),
              })),
            }))}
          />
        )}
      </section>

      <section id="kitchen" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-4xl px-6 py-20">
          <SectionHeader
            eyebrow="Who cooks"
            title="The kitchen"
            description="The people behind the pass every service."
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
          {!chefs.isPending && !chefs.isError && (chefs.data ?? []).length === 0 && (
            <Empty
              className="mt-8"
              title="No team listed yet"
              description="Come in and meet the kitchen in person."
            />
          )}
          {!!chefs.data?.length && (
            <TeamGrid
              className="mt-10"
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

      <section id="find-us" className="mx-auto max-w-4xl px-6 py-20">
        <div className="grid gap-10 sm:grid-cols-2">
          <div>
            <SectionHeader eyebrow="Find us" title="On Pell Street" />
            <LocationCard
              className="mt-6"
              name="Pell Street Kitchen"
              address="Pell Street, in among the shopfronts"
              note="No bookings — we keep tables for whoever walks in. Come hungry."
            />
            <SafeImage
              src={null}
              alt=""
              ratio="4/3"
              className="mt-6"
              fallbackSeed="pell-street-front"
            />
          </div>
          <div>
            <h3 className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Opening hours
            </h3>
            {hours.isPending && <Skeleton className="mt-5 h-48 rounded-xl" />}
            {hours.isError && (
              <p className="mt-5 text-sm text-destructive">
                Couldn't load our hours. Refresh and try again.
              </p>
            )}
            {!hours.isPending && !hours.isError && dayHours.length === 0 && (
              <Empty
                className="mt-5"
                title="Hours not listed yet"
                description="Give us a ring to check before you set off."
              />
            )}
            {dayHours.length > 0 && <OpeningHours className="mt-5" days={dayHours} />}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 pb-20">
        <CtaBand
          title="We don't take bookings — just come by"
          description="Tables are first come, first served. Get directions and we'll see you soon."
          action={{ label: "Get directions", href: "#find-us" }}
        />
      </section>
    </SiteChrome>
  );
}
