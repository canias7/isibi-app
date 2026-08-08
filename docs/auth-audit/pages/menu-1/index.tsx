import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";

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

type HourRow = Row & {
  day: string;
  opens: string | null;
  closes: string | null;
};

const CHROME = {
  name: "Pell Street Kitchen",
  tagline: "A neighbourhood table, cooked properly.",
  links: [
    { label: "Menu", href: "#menu" },
    { label: "Kitchen", href: "#kitchen" },
    { label: "Find us", href: "#find-us" },
  ],
  action: { label: "Call to reserve", href: "tel:+441142700099" },
};

const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function dayIndex(day: string): number {
  const i = DAY_ORDER.findIndex((d) => d.toLowerCase() === day.trim().toLowerCase());
  return i === -1 ? 99 : i;
}

function toNumberPrice(price: string | null): number | string | null {
  if (price == null) return null;
  const n = Number(price.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : price;
}

function Home() {
  const dishes = useRows<Dish>("dishes", { order: "course", dir: "asc" });
  const chefs = useRows<Chef>("chefs", { order: "name", dir: "asc" });
  const hours = useRows<HourRow>("hours", { order: "day", dir: "asc" });

  const menuGroups: MenuGroup[] = useMemo(() => {
    if (!dishes.data) return [];
    const map = new Map<string, MenuGroup>();
    for (const d of dishes.data) {
      const course = d.course?.trim() || "More";
      if (!map.has(course)) map.set(course, { name: course, items: [] });
      map.get(course)!.items.push({
        name: d.name,
        description: d.description,
        price: toNumberPrice(d.price),
      });
    }
    return Array.from(map.values());
  }, [dishes.data]);

  const sortedHours: DayHours[] = useMemo(() => {
    if (!hours.data) return [];
    return hours.data
      .slice()
      .sort((a, b) => dayIndex(a.day) - dayIndex(b.day))
      .map((h, i) => ({
        day: dayIndex(h.day) === 99 ? i : dayIndex(h.day),
        label: h.day,
        open: h.opens,
        close: h.closes,
      }));
  }, [hours.data]);

  const openNowHours = sortedHours
    .filter((h) => h.open && h.close)
    .map((h) => ({ day: h.day, open: h.open!, close: h.close! }));

  return (
    <SiteChrome {...CHROME}>
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Pell Street · neighbourhood cooking
          </p>
          <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">Pell Street Kitchen</h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
            A small room off the high street, a short menu that changes with what's good, and a
            kitchen that would rather you phoned than clicked.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <a
              className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground motion-press"
              href="tel:+441142700099"
            >
              Call to reserve
            </a>
            <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="#find-us">
              Get directions
            </a>
            {openNowHours.length > 0 && <OpenNow hours={openNowHours} />}
          </div>
        </div>
      </section>

      <section id="menu" className="mx-auto max-w-5xl px-6 py-20">
        <SectionHeader
          eyebrow="The menu"
          title="What's on tonight"
          description="Short by design. Ask what's not on the sheet — it's usually the reason to come in."
        />
        <div className="mt-10">
          {dishes.isPending && <Skeleton className="h-72 rounded-xl" />}
          {dishes.isError && (
            <p className="text-sm text-destructive">Couldn't load the menu. Refresh and try again.</p>
          )}
          {dishes.data?.length === 0 && (
            <Empty title="Nothing on the menu yet" description="Check back shortly — the kitchen is setting the sheet." />
          )}
          {!!menuGroups.length && <MenuSection groups={menuGroups} />}
        </div>
      </section>

      <section id="kitchen" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <SectionHeader
            eyebrow="Who cooks"
            title="The kitchen"
            description="Small team, long hours, no pass shouting for the cameras."
          />
          <div className="mt-10">
            {chefs.isPending && <Skeleton className="h-40 rounded-xl" />}
            {chefs.isError && (
              <p className="text-sm text-destructive">Couldn't load the team. Refresh and try again.</p>
            )}
            {chefs.data?.length === 0 && (
              <Empty title="No one listed yet" description="The kitchen roster will appear here soon." />
            )}
            {!!chefs.data?.length && (
              <TeamGrid
                items={chefs.data.map((c) => ({ name: c.name, role: c.role, photo: c.photo_url }))}
              />
            )}
          </div>
        </div>
      </section>

      <section id="find-us" className="mx-auto max-w-5xl px-6 py-20">
        <div className="grid gap-10 lg:grid-cols-[1fr_1fr_1.1fr]">
          <div>
            <SectionHeader eyebrow="Find us" title="On Pell Street" />
            <LocationCard
              className="mt-6"
              name="Pell Street Kitchen"
              address="22 Pell Street, Sheffield S3 8RQ"
              note="No online booking — ring us and we'll hold a table. Small room, so it's worth calling ahead on weekends."
            />
          </div>
          <div>
            <h3 className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Opening hours
            </h3>
            {hours.isPending && <Skeleton className="mt-5 h-56 rounded-xl" />}
            {hours.isError && (
              <p className="mt-5 text-sm text-destructive">Couldn't load our hours. Refresh and try again.</p>
            )}
            {hours.data?.length === 0 && (
              <p className="mt-5 text-sm text-muted-foreground">Hours coming soon — call ahead for now.</p>
            )}
            {!!sortedHours.length && <OpeningHours className="mt-5" days={sortedHours} />}
          </div>
          <SafeImage src={null} alt="" ratio="4/5" fallbackSeed="pell-street-frontage" />
        </div>
      </section>

      <section className="border-t border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <CtaBand
            title="Tables go quickly on Fridays"
            description="We don't take bookings online — give us a call and we'll sort you a table."
            action={{ label: "Call 0114 270 0099", href: "tel:+441142700099" }}
          />
        </div>
      </section>
    </SiteChrome>
  );
}
