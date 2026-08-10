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
  tagline: "A neighbourhood table on Pell Street.",
  links: [
    { label: "Menu", href: "#menu" },
    { label: "The kitchen", href: "#kitchen" },
    { label: "Find us", href: "#find-us" },
  ],
  action: { label: "Call to reserve", href: "tel:+441142700000" },
};

const COURSE_ORDER = ["Starters", "Mains", "Sides", "Puddings", "Desserts"];

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

function parsePrice(price: string | null): number | string | null {
  if (price == null) return null;
  const n = Number(price.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && price.replace(/[^0-9.]/g, "").length > 0 ? n : price;
}

function Home() {
  const dishes = useRows<Dish>("dishes", { order: "course", dir: "asc" });
  const chefs = useRows<Chef>("chefs", { order: "name", dir: "asc" });
  const hours = useRows<HourRow>("hours", { order: "day", dir: "asc" });

  const grouped = (() => {
    const rows = dishes.data ?? [];
    const known = COURSE_ORDER.map((name) => ({
      name,
      rows: rows.filter((r) => (r.course ?? "").trim().toLowerCase() === name.toLowerCase()),
    })).filter((g) => g.rows.length);
    const knownNames = new Set(COURSE_ORDER.map((c) => c.toLowerCase()));
    const leftovers = rows.filter((r) => !knownNames.has((r.course ?? "").trim().toLowerCase()));
    if (leftovers.length) {
      const byCourse = new Map<string, Dish[]>();
      for (const r of leftovers) {
        const key = r.course && r.course.trim().length ? r.course : "More";
        byCourse.set(key, [...(byCourse.get(key) ?? []), r]);
      }
      for (const [name, rs] of byCourse) known.push({ name, rows: rs });
    }
    return known;
  })();

  const sortedHours = [...(hours.data ?? [])].sort(
    (a, b) => (DAY_NUMBER[a.day] ?? 99) - (DAY_NUMBER[b.day] ?? 99),
  );
  const dayHours: DayHours[] = sortedHours.map((h) => ({
    day: DAY_NUMBER[h.day] ?? 0,
    label: h.day,
    open: h.opens,
    close: h.closes,
  }));
  const openNowHours = dayHours
    .filter((h) => h.open && h.close)
    .map((h) => ({ day: h.day, open: h.open as string, close: h.close as string }));

  return (
    <SiteChrome {...CHROME}>
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-4xl px-6 py-14">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Pell Street · a neighbourhood kitchen
          </p>
          <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">
            Pell Street Kitchen
          </h1>
          <p className="mt-4 max-w-lg text-lg leading-relaxed text-muted-foreground">
            Simple plates, done properly, for whoever's on the street. We don't take online
            bookings — ring us and we'll hold you a table.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <a
              className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground motion-press"
              href="tel:+441142700000"
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
          title="What we cook"
          description="Short, seasonal, and changed when the market changes."
        />

        {dishes.isPending && <Skeleton className="mt-8 h-64 rounded-xl" />}
        {dishes.isError && (
          <p className="mt-8 text-sm text-destructive">
            Couldn't load the menu. Refresh and try again.
          </p>
        )}
        {dishes.data?.length === 0 && (
          <p className="mt-8 text-sm text-muted-foreground">Nothing on the menu yet — check back soon.</p>
        )}
        {!!dishes.data?.length && (
          <MenuSection
            className="mt-8"
            groups={grouped.map((g) => ({
              name: g.name,
              items: g.rows.map((r) => ({
                name: r.name,
                description: r.description,
                price: parsePrice(r.price),
              })),
            }))}
          />
        )}
      </section>

      <section id="kitchen" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-4xl px-6 py-20">
          <SectionHeader eyebrow="The kitchen" title="Who cooks it" />

          {chefs.isPending && <Skeleton className="mt-8 h-40 rounded-xl" />}
          {chefs.isError && (
            <p className="mt-8 text-sm text-destructive">
              Couldn't load the team. Refresh and try again.
            </p>
          )}
          {chefs.data?.length === 0 && (
            <p className="mt-8 text-sm text-muted-foreground">Nobody listed yet.</p>
          )}
          {!!chefs.data?.length && (
            <TeamGrid
              className="mt-8"
              columns={chefs.data.length >= 4 ? 4 : (chefs.data.length as 1 | 2 | 3)}
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
              address="12 Pell Street, Sheffield S3 8GG"
              note="No bookings taken online — give us a ring and we'll hold your table."
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
              <p className="mt-5 text-sm text-muted-foreground">Hours coming soon — call ahead.</p>
            )}
            {!!hours.data?.length && <OpeningHours className="mt-5" days={dayHours} />}
          </div>
        </div>
        <div className="mt-12">
          <SafeImage src={null} alt="" ratio="16/9" fallbackSeed="pell-street-front" />
        </div>
      </section>

      <section className="border-t border-border bg-muted/40">
        <div className="mx-auto max-w-4xl px-6 py-16">
          <CtaBand
            title="We don't take bookings online"
            description="Give us a call and we'll get you a table."
            action={{ label: "Call to reserve", href: "tel:+441142700000" }}
          />
        </div>
      </section>
    </SiteChrome>
  );
}
