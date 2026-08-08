import { createFileRoute } from "@tanstack/react-router";

import { useRows, type Row } from "@/lib/rows";
import { CtaBand } from "@/components/ui/cta-band";
import { Empty } from "@/components/ui/empty";
import { LocationCard } from "@/components/ui/location-card";
import { MenuSection } from "@/components/ui/menu-section";
import { OpenNow } from "@/components/ui/open-now";
import { OpeningHours, type DayHours } from "@/components/ui/opening-hours";
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
    { label: "0114 268 4400", href: "tel:+441142684400" },
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

function toDayHours(rows: Hour[]): DayHours[] {
  return DAY_ORDER.map((label) => {
    const row = rows.find((r) => r.day === label);
    return {
      day: DAY_INDEX[label] ?? 0,
      label,
      open: row?.opens ?? null,
      close: row?.closes ?? null,
    };
  });
}

function parsePrice(price: string | null): number | string | null {
  if (price == null) return null;
  const n = Number(price.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : price;
}

function Home() {
  const dishes = useRows<Dish>("dishes", { order: "course", dir: "asc" });
  const chefs = useRows<Chef>("chefs", { order: "name", dir: "asc" });
  const hours = useRows<Hour>("hours");

  const dayHours = hours.data ? toDayHours(hours.data) : [];
  const openHours = dayHours
    .filter((h) => h.open && h.close)
    .map((h) => ({ day: h.day, open: h.open as string, close: h.close as string }));

  const groups = (dishes.data ?? []).reduce<Record<string, Dish[]>>((acc, d) => {
    const key = d.course && d.course.trim() ? d.course : "On the menu";
    (acc[key] ||= []).push(d);
    return acc;
  }, {});

  return (
    <SiteChrome {...CHROME}>
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-4xl px-6 py-14">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Pell Street · neighbourhood cooking
          </p>
          <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">Pell Street Kitchen</h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">
            A short menu, cooked properly, a few doors from where most of you live. We don't take
            bookings — ring ahead if you're a big table, otherwise just come in.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <a
              className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground motion-press"
              href="tel:+441142684400"
            >
              Call to reserve
            </a>
            <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="#find-us">
              Directions
            </a>
            {!hours.isPending && !hours.isError && openHours.length > 0 && <OpenNow hours={openHours} />}
          </div>
        </div>
      </section>

      <section id="menu" className="mx-auto max-w-4xl px-6 py-20">
        <SectionHeader
          eyebrow="The menu"
          title="What's cooking"
          description="Short, and it changes with what's good this week."
        />

        {dishes.isPending && (
          <div className="mt-8 space-y-3">
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        )}

        {dishes.isError && (
          <p className="mt-8 text-sm text-destructive">Couldn't load the menu. Refresh and try again.</p>
        )}

        {dishes.data?.length === 0 && (
          <Empty
            className="mt-8"
            title="The menu isn't up yet"
            description="Check back shortly, or give us a ring to hear what's on tonight."
          />
        )}

        {!!dishes.data?.length && (
          <MenuSection
            className="mt-8"
            groups={Object.entries(groups).map(([name, items]) => ({
              name,
              items: items.map((d) => ({
                name: d.name,
                description: d.description,
                price: parsePrice(d.price),
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
            description="Small team, same faces most nights."
          />

          {chefs.isPending && (
            <div className="mt-8 grid gap-6 sm:grid-cols-3">
              <Skeleton className="h-40 rounded-xl" />
              <Skeleton className="h-40 rounded-xl" />
              <Skeleton className="h-40 rounded-xl" />
            </div>
          )}

          {chefs.isError && (
            <p className="mt-8 text-sm text-destructive">Couldn't load the team. Refresh and try again.</p>
          )}

          {chefs.data?.length === 0 && (
            <Empty
              className="mt-8"
              title="Introductions coming soon"
              description="We'll add the team here shortly."
            />
          )}

          {!!chefs.data?.length && (
            <TeamGrid
              className="mt-8"
              columns={3}
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
              address="27 Pell Street, Sheffield S3 8JA"
              note="Small dining room — big groups, please ring ahead. Street parking after 6pm."
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
            {hours.data?.length === 0 && (
              <Empty className="mt-5" title="Hours coming soon" description="Give us a call to check when we're open." />
            )}
            {!!hours.data?.length && <OpeningHours className="mt-5" days={dayHours} />}
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-muted/40">
        <div className="mx-auto max-w-4xl px-6 py-16">
          <CtaBand
            title="We don't take online bookings"
            description="Give us a ring and we'll hold you a table, or just walk in."
            action={{ label: "Call 0114 268 4400", href: "tel:+441142684400" }}
          />
        </div>
      </section>
    </SiteChrome>
  );
}
