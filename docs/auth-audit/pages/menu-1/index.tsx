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
  tagline: "A neighbourhood restaurant. Phone us — we don't take bookings online.",
  links: [
    { label: "Menu", href: "#menu" },
    { label: "The kitchen", href: "#kitchen" },
    { label: "Find us", href: "#find-us" },
    { label: "0114 272 0000", href: "tel:+441142720000" },
  ],
  action: { label: "Call to reserve", href: "tel:+441142720000" },
};

const DAY_ORDER: Record<string, number> = {
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
  Sunday: 0,
};

function toDayHours(hours: Hour[]): DayHours[] {
  return hours
    .map((h) => ({
      day: DAY_ORDER[h.day] ?? 0,
      label: h.day,
      open: h.opens,
      close: h.closes,
    }))
    .sort((a, b) => {
      const da = a.day === 0 ? 7 : a.day;
      const db = b.day === 0 ? 7 : b.day;
      return da - db;
    });
}

function Home() {
  const dishes = useRows<Dish>("dishes", { order: "course", dir: "asc" });
  const chefs = useRows<Chef>("chefs", { order: "name", dir: "asc" });
  const hours = useRows<Hour>("hours", { order: "id", dir: "asc" });

  const groups = (() => {
    if (!dishes.data?.length) return [];
    const byCourse = new Map<string, Dish[]>();
    for (const d of dishes.data) {
      const course = d.course ?? "On the menu";
      if (!byCourse.has(course)) byCourse.set(course, []);
      byCourse.get(course)!.push(d);
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

  const dayHours = hours.data ? toDayHours(hours.data) : [];
  const openNowHours = dayHours
    .filter((h) => h.open && h.close)
    .map((h) => ({ day: h.day, open: h.open!, close: h.close! }));

  return (
    <SiteChrome {...CHROME}>
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-4xl px-6 py-14">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Pell Street · a neighbourhood restaurant
          </p>
          <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">
            Pell Street Kitchen
          </h1>
          <p className="mt-4 max-w-lg text-lg leading-relaxed text-muted-foreground">
            No online booking — ring us and we'll hold you a table. Most nights we can.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <a
              className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground motion-press"
              href="tel:+441142720000"
            >
              Call 0114 272 0000
            </a>
            <a
              className="rounded-md border border-border px-5 py-2.5 text-sm font-medium motion-press"
              href="#find-us"
            >
              Directions
            </a>
            {hours.data && hours.data.length > 0 && <OpenNow hours={openNowHours} />}
          </div>
        </div>
      </section>

      <section id="menu" className="mx-auto max-w-4xl px-6 py-20">
        <SectionHeader
          eyebrow="The menu"
          title="What we cook"
          description="Everything on it, every night we're open. Ask about anything with a question mark in your head — we'll tell you straight."
        />
        {dishes.isPending && <Skeleton className="mt-8 h-64 rounded-xl" />}
        {dishes.isError && (
          <p className="mt-8 text-sm text-destructive">
            Couldn't load the menu just now. Refresh and try again.
          </p>
        )}
        {dishes.data?.length === 0 && (
          <Empty
            className="mt-8"
            title="The menu isn't up yet"
            description="Check back soon, or give us a call to hear what's on tonight."
          />
        )}
        {groups.length > 0 && <MenuSection className="mt-8" groups={groups} />}
      </section>

      <section id="kitchen" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-4xl px-6 py-20">
          <SectionHeader
            eyebrow="The kitchen"
            title="Who cooks it"
            description="A small kitchen, and the same faces most nights."
          />
          {chefs.isPending && <Skeleton className="mt-8 h-32 rounded-xl" />}
          {chefs.isError && (
            <p className="mt-8 text-sm text-destructive">Couldn't load the kitchen team.</p>
          )}
          {chefs.data?.length === 0 && (
            <Empty
              className="mt-8"
              title="Nothing listed yet"
              description="Our chefs will be introduced here shortly."
            />
          )}
          {!!chefs.data?.length && (
            <TeamGrid
              className="mt-8"
              columns={chefs.data.length >= 3 ? 3 : (chefs.data.length as 1 | 2)}
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
              address="22 Pell Street, Sheffield S3 8GA"
              note="Street parking after 6pm, or the Division Street car park is a five minute walk."
            />
          </div>
          <div>
            <h3 className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Opening hours
            </h3>
            {hours.isPending && <Skeleton className="mt-5 h-40 rounded-xl" />}
            {hours.isError && (
              <p className="mt-5 text-sm text-destructive">Couldn't load our hours.</p>
            )}
            {hours.data?.length === 0 && (
              <Empty
                className="mt-5"
                title="Hours not listed yet"
                description="Call us to check what time we open."
              />
            )}
            {dayHours.length > 0 && <OpeningHours className="mt-5" days={dayHours} />}
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-muted/40">
        <div className="mx-auto max-w-4xl px-6 py-16">
          <CtaBand
            title="We don't take bookings online"
            description="Give us a ring and we'll hold you a table for the evening."
            action={{ label: "Call 0114 272 0000", href: "tel:+441142720000" }}
          />
        </div>
      </section>
    </SiteChrome>
  );
}
