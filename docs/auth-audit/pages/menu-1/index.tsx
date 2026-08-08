import { createFileRoute } from "@tanstack/react-router";

import { useRows, type Row } from "@/lib/rows";
import { CtaBand } from "@/components/ui/cta-band";
import { LocationCard } from "@/components/ui/location-card";
import { MenuSection, type MenuGroup } from "@/components/ui/menu-section";
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
  tagline: "Our neighbourhood table on Pell Street.",
  links: [
    { label: "Menu", href: "#menu" },
    { label: "The kitchen", href: "#kitchen" },
    { label: "Find us", href: "#find-us" },
  ],
  action: { label: "Directions", href: "#find-us" },
};

const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function dayIndex(day: string): number {
  const i = DAY_ORDER.findIndex((d) => d.toLowerCase() === day.trim().toLowerCase());
  return i === -1 ? 0 : (i + 1) % 7;
}

function toDayHours(rows: Hour[]): DayHours[] {
  return rows.map((h) => ({
    day: dayIndex(h.day),
    label: h.day,
    open: h.opens,
    close: h.closes,
  }));
}

function groupDishes(rows: Dish[]): MenuGroup[] {
  const order: string[] = [];
  const groups = new Map<string, Dish[]>();
  for (const d of rows) {
    const course = d.course?.trim() || "On the menu";
    if (!groups.has(course)) {
      groups.set(course, []);
      order.push(course);
    }
    groups.get(course)!.push(d);
  }
  return order.map((course) => ({
    name: course,
    items: groups.get(course)!.map((d) => ({
      name: d.name,
      description: d.description,
      price: d.price,
    })),
  }));
}

function Home() {
  const dishes = useRows<Dish>("dishes", { order: "course", dir: "asc" });
  const chefs = useRows<Chef>("chefs", { order: "name", dir: "asc" });
  const hours = useRows<Hour>("hours");

  const dayHours = hours.data ? toDayHours(hours.data) : [];
  const openHours = dayHours
    .filter((h) => h.open && h.close)
    .map((h) => ({ day: h.day, open: h.open!, close: h.close! }));

  return (
    <SiteChrome {...CHROME}>
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <div className="grid items-center gap-10 lg:grid-cols-[1.2fr_1fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Pell Street · Neighbourhood kitchen
              </p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
                Pell Street Kitchen
              </h1>
              <p className="mt-4 max-w-lg text-lg leading-relaxed text-muted-foreground">
                Honest cooking, a short walk from wherever you are on the street. No online
                booking — ring us, or just come in.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <a
                  className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground motion-press"
                  href="#find-us"
                >
                  Get directions
                </a>
                <a
                  className="rounded-md border border-border px-5 py-2.5 text-sm font-medium motion-press"
                  href="#menu"
                >
                  See the menu
                </a>
                {hours.data && hours.data.length > 0 && <OpenNow hours={openHours} />}
              </div>
            </div>
            <SafeImage src={null} alt="" ratio="4/3" fallbackSeed="hero" />
          </div>
        </div>
      </section>

      <section id="menu" className="mx-auto max-w-4xl px-6 py-20">
        <SectionHeader
          eyebrow="The menu"
          title="What we're cooking"
          description="Everything on the pass today, priced honestly."
        />
        <div className="mt-10">
          {dishes.isPending && <Skeleton className="h-64 rounded-xl" />}
          {dishes.isError && (
            <p className="text-sm text-destructive">
              Couldn't load the menu just now. Refresh and try again.
            </p>
          )}
          {dishes.data?.length === 0 && (
            <Empty
              title="Nothing on the menu yet"
              description="Check back soon, or give us a ring to hear what's cooking."
            />
          )}
          {!!dishes.data?.length && <MenuSection groups={groupDishes(dishes.data)} />}
        </div>
      </section>

      <section id="kitchen" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-4xl px-6 py-20">
          <SectionHeader eyebrow="Who cooks" title="The kitchen" />
          <div className="mt-10">
            {chefs.isPending && <Skeleton className="h-40 rounded-xl" />}
            {chefs.isError && (
              <p className="text-sm text-destructive">Couldn't load the team just now.</p>
            )}
            {chefs.data?.length === 0 && (
              <Empty
                title="Introductions coming soon"
                description="We'll list who's on the pass here shortly."
              />
            )}
            {!!chefs.data?.length && (
              <TeamGrid
                items={chefs.data.map((c) => ({
                  name: c.name,
                  role: c.role,
                  photo: c.photo_url,
                }))}
              />
            )}
          </div>
        </div>
      </section>

      <section id="find-us" className="mx-auto max-w-4xl px-6 py-20">
        <SectionHeader eyebrow="Find us" title="On Pell Street" />
        <div className="mt-10 grid gap-10 sm:grid-cols-2">
          <LocationCard
            name="Pell Street Kitchen"
            address="Pell Street, in among the shops"
            note="No bookings taken online — call ahead if you'd like us to hold a table."
          />
          <div>
            <h3 className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Opening hours
            </h3>
            <div className="mt-5">
              {hours.isPending && <Skeleton className="h-48 rounded-xl" />}
              {hours.isError && (
                <p className="text-sm text-destructive">Couldn't load our hours just now.</p>
              )}
              {hours.data?.length === 0 && (
                <Empty title="Hours coming soon" description="Give us a ring to check when we're open." />
              )}
              {!!hours.data?.length && <OpeningHours days={dayHours} />}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-muted/40">
        <div className="mx-auto max-w-4xl px-6 py-16">
          <CtaBand
            title="We don't take bookings online"
            description="Walk in, or give us a call and we'll do our best to hold you a table."
            action={{ label: "Get directions", href: "#find-us" }}
          />
        </div>
      </section>
    </SiteChrome>
  );
}
