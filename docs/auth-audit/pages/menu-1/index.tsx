import { createFileRoute } from "@tanstack/react-router";
import { useRows, type Row } from "@/lib/rows";
import { SiteChrome } from "@/components/ui/site-chrome";
import { CtaBand } from "@/components/ui/cta-band";
import { LocationCard } from "@/components/ui/location-card";
import { MenuSection, type MenuGroup } from "@/components/ui/menu-section";
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
  tagline: "Neighbourhood cooking on Pell Street.",
  links: [
    { label: "The menu", href: "#menu" },
    { label: "Who cooks", href: "#kitchen" },
    { label: "Find us", href: "#find-us" },
  ],
  action: { label: "Directions", href: "#find-us" },
};

const COURSES = ["Starters", "Mains", "Sides", "Desserts"];

const DAY_ORDER: Record<string, number> = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 0,
};

function parsePrice(price: string | null): number | string | null {
  if (price == null) return null;
  const n = Number(price);
  return Number.isFinite(n) ? n : price;
}

function toDayHours(rows: HourRow[]): DayHours[] {
  return rows
    .map((r) => ({
      day: DAY_ORDER[r.day.toLowerCase()] ?? 99,
      label: r.day.charAt(0).toUpperCase() + r.day.slice(1).toLowerCase(),
      open: r.opens,
      close: r.closes,
    }))
    .sort((a, b) => {
      const da = a.day === 0 ? 7 : a.day;
      const db = b.day === 0 ? 7 : b.day;
      return da - db;
    });
}

function Home() {
  const dishes = useRows<Dish>("dishes", { order: "name", dir: "asc" });
  const chefs = useRows<Chef>("chefs", { order: "name", dir: "asc" });
  const hours = useRows<HourRow>("hours");

  const dayHours = hours.data ? toDayHours(hours.data) : [];
  const openNowHours = dayHours
    .filter((h) => h.open && h.close)
    .map((h) => ({ day: h.day, open: h.open!, close: h.close! }));

  const groups: MenuGroup[] = (() => {
    const rows = dishes.data ?? [];
    const known = COURSES.map((name) => ({
      name,
      items: rows
        .filter((r) => r.course === name)
        .map((r) => ({
          name: r.name,
          description: r.description,
          price: parsePrice(r.price),
        })),
    })).filter((g) => g.items.length);
    const knownCourses = new Set(COURSES);
    const leftovers = rows.filter((r) => !r.course || !knownCourses.has(r.course));
    if (leftovers.length) {
      known.push({
        name: "Also on the menu",
        items: leftovers.map((r) => ({
          name: r.name,
          description: r.description,
          price: parsePrice(r.price),
        })),
      });
    }
    return known;
  })();

  return (
    <SiteChrome {...CHROME}>
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Pell Street · neighbourhood kitchen
              </p>
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">
                Pell Street Kitchen
              </h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                No booking system, no app — just ring the number below and we'll hold you a
                table. Everything on the menu is cooked to order, so ask what's good tonight.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <a
                  className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
                  href="#find-us"
                >
                  Directions
                </a>
                <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="#menu">
                  See the menu
                </a>
                {hours.data && hours.data.length > 0 && <OpenNow hours={openNowHours} />}
              </div>
            </div>
            <SafeImage
              src="@@IMG:the dining room at Pell Street Kitchen, warm evening light, a few tables set@@"
              alt="The dining room at Pell Street Kitchen"
              ratio="4/3"
            />
          </div>
        </div>
      </section>

      <section id="menu" className="mx-auto max-w-5xl px-6 py-20">
        <SectionHeader
          eyebrow="The menu"
          title="What we're cooking"
          description="Changes with the seasons. Ring ahead if you're bringing a big table."
        />
        <div className="mt-10">
          {dishes.isPending && <Skeleton className="h-64 rounded-xl" />}
          {dishes.isError && (
            <p className="text-sm text-destructive">Couldn't load the menu. Refresh and try again.</p>
          )}
          {dishes.data?.length === 0 && (
            <Empty title="Nothing on the menu yet" description="Check back soon — we're setting it up." />
          )}
          {!!dishes.data?.length && <MenuSection groups={groups} currency="£" />}
        </div>
      </section>

      <section id="kitchen" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <SectionHeader
            eyebrow="Who cooks"
            title="The kitchen"
            description="Small team, same faces every service."
          />
          <div className="mt-10">
            {chefs.isPending && <Skeleton className="h-40 rounded-xl" />}
            {chefs.isError && (
              <p className="text-sm text-destructive">Couldn't load the team. Refresh and try again.</p>
            )}
            {chefs.data?.length === 0 && (
              <Empty title="No team listed yet" description="We'll introduce the kitchen here soon." />
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

      <section id="find-us" className="mx-auto max-w-5xl px-6 py-20">
        <div className="grid gap-10 lg:grid-cols-[1fr_1fr]">
          <div>
            <SectionHeader eyebrow="Find us" title="On Pell Street" />
            <LocationCard
              className="mt-6"
              name="Pell Street Kitchen"
              address="22 Pell Street"
              note="No online booking — give us a ring and we'll hold you a table."
            />
          </div>
          <div>
            <h3 className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Opening hours
            </h3>
            <div className="mt-5">
              {hours.isPending && <Skeleton className="h-48 rounded-xl" />}
              {hours.isError && (
                <p className="text-sm text-destructive">Couldn't load our hours. Refresh and try again.</p>
              )}
              {hours.data?.length === 0 && (
                <Empty title="Hours not listed yet" description="Give us a call to check when we're open." />
              )}
              {!!hours.data?.length && <OpeningHours days={dayHours} />}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <CtaBand
            title="We don't take bookings online"
            description="Ring us and we'll hold you a table, or just walk in — we always keep a couple free."
            action={{ label: "Get directions", href: "#find-us" }}
          />
        </div>
      </section>
    </SiteChrome>
  );
}
