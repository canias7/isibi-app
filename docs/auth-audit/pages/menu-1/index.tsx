import { createFileRoute } from "@tanstack/react-router";
import { useRows, type Row } from "@/lib/rows";
import { SiteChrome } from "@/components/ui/site-chrome";
import { CtaBand } from "@/components/ui/cta-band";
import { LocationCard } from "@/components/ui/location-card";
import { MenuSection } from "@/components/ui/menu-section";
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

type Hour = Row & {
  day: string;
  opens: string | null;
  closes: string | null;
};

const COURSES = ["Starters", "Mains", "Sides", "Desserts", "Drinks"];

const DAY_ORDER: Record<string, number> = {
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
  Sunday: 0,
};

const CHROME = {
  name: "Pell Street Kitchen",
  tagline: "A neighbourhood table on Pell Street.",
  links: [
    { label: "The menu", href: "#menu" },
    { label: "The kitchen", href: "#kitchen" },
    { label: "Find us", href: "#find-us" },
  ],
  action: { label: "Directions", href: "#find-us" },
};

function toDayHours(rows: Hour[]): DayHours[] {
  return rows
    .filter((r) => DAY_ORDER[r.day] !== undefined)
    .sort((a, b) => {
      const da = DAY_ORDER[a.day];
      const db = DAY_ORDER[b.day];
      const na = da === 0 ? 7 : da;
      const nb = db === 0 ? 7 : db;
      return na - nb;
    })
    .map((r) => ({
      day: DAY_ORDER[r.day],
      label: r.day,
      open: r.opens,
      close: r.closes,
    }));
}

function Home() {
  const dishes = useRows<Dish>("dishes", { order: "price", dir: "asc" });
  const chefs = useRows<Chef>("chefs", { order: "name", dir: "asc" });
  const hours = useRows<Hour>("hours", { order: "day", dir: "asc" });

  const dayHours = hours.data ? toDayHours(hours.data) : [];
  const openNowHours = dayHours
    .filter((h) => h.open && h.close)
    .map((h) => ({ day: h.day, open: h.open as string, close: h.close as string }));

  const grouped = dishes.data
    ? (() => {
        const known = COURSES.map((name) => ({
          name,
          rows: dishes.data!.filter((d) => d.course === name),
        })).filter((g) => g.rows.length > 0);
        const knownNames = new Set(COURSES);
        const rest = dishes.data!.filter((d) => !d.course || !knownNames.has(d.course));
        if (rest.length) known.push({ name: "More", rows: rest });
        return known;
      })()
    : [];

  return (
    <SiteChrome {...CHROME}>
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Pell Street · your neighbourhood table
          </p>
          <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">Pell Street Kitchen</h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">
            No booking system — we take calls. Come in, or ring ahead and we'll have a table waiting.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <a className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" href="#find-us">
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

      <section id="menu" className="mx-auto max-w-4xl px-6 py-20">
        <SectionHeader
          eyebrow="The menu"
          title="What we cook"
          description="Everything's made through the day — ask what's fresh in if you're not sure."
        />
        {dishes.isPending && <Skeleton className="mt-8 h-72 rounded-xl" />}
        {dishes.isError && (
          <p className="mt-8 text-sm text-destructive">Couldn't load the menu. Refresh and try again.</p>
        )}
        {dishes.data?.length === 0 && (
          <Empty className="mt-8" title="Menu coming soon" description="We're putting the finishing touches on our dishes." />
        )}
        {grouped.length > 0 && (
          <MenuSection
            className="mt-10"
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
        <div className="mx-auto max-w-4xl px-6 py-20">
          <SectionHeader eyebrow="Who cooks" title="The kitchen" description="The people behind the pass, most nights." />
          {chefs.isPending && <Skeleton className="mt-8 h-32 rounded-xl" />}
          {chefs.isError && (
            <p className="mt-8 text-sm text-destructive">Couldn't load the team. Refresh and try again.</p>
          )}
          {chefs.data?.length === 0 && (
            <Empty className="mt-8" title="Meet the kitchen soon" description="We'll introduce the team here shortly." />
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
        <div className="grid gap-10 lg:grid-cols-[1fr_1fr_1.1fr]">
          <div>
            <SectionHeader eyebrow="Find us" title="Pell Street" />
            {hours.isPending && <Skeleton className="mt-6 h-40 rounded-xl" />}
            {hours.isError && (
              <p className="mt-6 text-sm text-destructive">Couldn't load our hours. Refresh and try again.</p>
            )}
            {hours.data?.length === 0 && (
              <Empty className="mt-6" title="Hours coming soon" description="Check back or give us a call." />
            )}
            {dayHours.length > 0 && <OpeningHours className="mt-6" days={dayHours} />}
          </div>
          <LocationCard
            className="self-start"
            name="Pell Street Kitchen"
            address="22 Pell Street, Sheffield S3 7QA"
            note="On the corner opposite the old chapel. Street parking after 6pm, or the Pell Street car park two doors down."
          />
          <SafeImage src={null} alt="" ratio="4/5" fallbackSeed="pell-street-front" />
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <CtaBand
          title="We don't take online bookings"
          description="Give us a ring and we'll hold you a table — or just walk in, we usually have room."
          action={{ label: "Get directions", href: "#find-us" }}
        />
      </section>
    </SiteChrome>
  );
}
