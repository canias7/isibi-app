import { createFileRoute } from "@tanstack/react-router";
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
import { useRows, type Row } from "@/lib/rows";

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

const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const COURSE_ORDER = ["Starters", "Mains", "Sides", "Desserts", "Drinks"];

const CHROME = {
  name: "Pell Street Kitchen",
  tagline: "A neighbourhood table on Pell Street.",
  links: [
    { label: "Menu", href: "#menu" },
    { label: "Who cooks", href: "#kitchen" },
    { label: "Find us", href: "#find-us" },
  ],
  action: { label: "Directions", href: "#find-us" },
};

function dayToNumber(day: string): number {
  const idx = DAY_ORDER.findIndex((d) => d.toLowerCase() === day.toLowerCase());
  return idx === -1 ? 7 : idx === 6 ? 0 : idx + 1;
}

function Home() {
  const dishes = useRows<Dish>("dishes", { order: "name", dir: "asc" });
  const chefs = useRows<Chef>("chefs", { order: "name", dir: "asc" });
  const hours = useRows<HourRow>("hours", { order: "day", dir: "asc" });

  const menuGroups = COURSE_ORDER.map((name) => ({
    name,
    items: (dishes.data ?? [])
      .filter((d) => (d.course ?? "").toLowerCase() === name.toLowerCase())
      .map((d) => ({ name: d.name, description: d.description, price: d.price })),
  })).filter((g) => g.items.length > 0);

  const knownCourses = new Set(COURSE_ORDER.map((c) => c.toLowerCase()));
  const leftovers = (dishes.data ?? []).filter(
    (d) => !knownCourses.has((d.course ?? "").toLowerCase()),
  );
  if (leftovers.length) {
    menuGroups.push({
      name: "More",
      items: leftovers.map((d) => ({ name: d.name, description: d.description, price: d.price })),
    });
  }

  const dayHours: DayHours[] = (hours.data ?? [])
    .map((h) => ({
      day: dayToNumber(h.day),
      label: h.day,
      open: h.opens,
      close: h.closes,
    }))
    .sort((a, b) => (a.day === 0 ? 7 : a.day) - (b.day === 0 ? 7 : b.day));

  const openHoursForNow = dayHours
    .filter((h) => h.open && h.close)
    .map((h) => ({ day: h.day, open: h.open!, close: h.close! }));

  return (
    <SiteChrome {...CHROME}>
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <div className="grid items-center gap-10 lg:grid-cols-[1.2fr_1fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Pell Street · neighbourhood kitchen
              </p>
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">
                Pell Street Kitchen
              </h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                A small room, a short menu, and a kitchen that changes it when the produce tells us
                to. No online booking — ring the door and we'll hold you a table.
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
                {openHoursForNow.length > 0 && <OpenNow hours={openHoursForNow} />}
              </div>
            </div>
            <SafeImage src={null} alt="" ratio="4/3" fallbackSeed="psk-hero" />
          </div>
        </div>
      </section>

      <section id="menu" className="mx-auto max-w-4xl px-6 py-20">
        <SectionHeader
          eyebrow="The menu"
          title="What's on today"
          description="Short by design — everything on it is something we make well."
        />
        {dishes.isPending && <Skeleton className="mt-8 h-72 rounded-xl" />}
        {dishes.isError && (
          <p className="mt-8 text-sm text-destructive">
            Couldn't load the menu. Refresh and try again.
          </p>
        )}
        {!dishes.isPending && !dishes.isError && dishes.data?.length === 0 && (
          <Empty className="mt-8" title="Menu coming soon" description="We're setting the menu up — check back shortly." />
        )}
        {!!menuGroups.length && <MenuSection className="mt-10" groups={menuGroups} />}
      </section>

      <section id="kitchen" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <SectionHeader eyebrow="Who cooks" title="The kitchen" description="The people behind the pass." />
          {chefs.isPending && <Skeleton className="mt-8 h-40 rounded-xl" />}
          {chefs.isError && (
            <p className="mt-8 text-sm text-destructive">
              Couldn't load the team. Refresh and try again.
            </p>
          )}
          {!chefs.isPending && !chefs.isError && chefs.data?.length === 0 && (
            <Empty className="mt-8" title="Team coming soon" description="We'll introduce the kitchen here shortly." />
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
              address="Pell Street"
              note="No online booking — call the kitchen and we'll hold you a table."
            />
          </div>
          <div>
            <h3 className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Opening hours
            </h3>
            {hours.isPending && <Skeleton className="mt-5 h-56 rounded-xl" />}
            {hours.isError && (
              <p className="mt-5 text-sm text-destructive">
                Couldn't load our hours. Refresh and try again.
              </p>
            )}
            {!hours.isPending && !hours.isError && hours.data?.length === 0 && (
              <Empty className="mt-5" title="Hours coming soon" description="We'll post our hours here shortly." />
            )}
            {!!dayHours.length && <OpeningHours className="mt-5" days={dayHours} />}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <CtaBand
          title="We don't take bookings online"
          description="Give us a call and we'll save you a table — walk-ins are always welcome too."
          action={{ label: "Get directions", href: "#find-us" }}
        />
      </section>
    </SiteChrome>
  );
}
