import { createFileRoute } from "@tanstack/react-router";

import { useRows, type Row } from "@/lib/rows";
import { CtaBand } from "@/components/ui/cta-band";
import { LocationCard } from "@/components/ui/location-card";
import { MenuSection, type MenuGroup } from "@/components/ui/menu-section";
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
    { label: "The kitchen", href: "#kitchen" },
    { label: "Find us", href: "#find-us" },
  ],
  action: { label: "Directions", href: "#find-us" },
};

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

function toTime(t: string | null): string | undefined {
  if (!t) return undefined;
  const trimmed = t.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (match) return trimmed.padStart(5, "0");
  return undefined;
}

function Home() {
  const dishes = useRows<Dish>("dishes", { order: "course", dir: "asc" });
  const chefs = useRows<Chef>("chefs", { order: "name", dir: "asc" });
  const hours = useRows<Hour>("hours", { order: "id", dir: "asc" });

  const groups: MenuGroup[] = [];
  if (dishes.data?.length) {
    const byCourse = new Map<string, Dish[]>();
    for (const d of dishes.data) {
      const key = d.course?.trim() || "On the menu";
      if (!byCourse.has(key)) byCourse.set(key, []);
      byCourse.get(key)!.push(d);
    }
    for (const [name, items] of byCourse) {
      groups.push({
        name,
        items: items.map((d) => ({
          name: d.name,
          description: d.description,
          price: d.price,
        })),
      });
    }
  }

  const dayHours: DayHours[] = (hours.data ?? [])
    .slice()
    .sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day))
    .map((h) => ({
      day: DAY_NUMBER[h.day] ?? 0,
      label: h.day,
      open: toTime(h.opens) ?? null,
      close: toTime(h.closes) ?? null,
    }));

  const openNowHours = dayHours
    .filter((h) => h.open && h.close)
    .map((h) => ({ day: h.day, open: h.open!, close: h.close! }));

  return (
    <SiteChrome {...CHROME}>
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-4xl px-6 py-14 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Pell Street · a neighbourhood kitchen
          </p>
          <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">Pell Street Kitchen</h1>
          <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Twelve tables, a short seasonal menu, and a kitchen you can hear from the dining room.
            No online booking — ring the number below and we'll hold you a table.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <a
              className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground motion-press"
              href="tel:+441142345678"
            >
              Call to reserve — 0114 234 5678
            </a>
            <a
              className="rounded-md border border-border px-5 py-2.5 text-sm font-medium motion-press"
              href="#find-us"
            >
              Directions
            </a>
            {openNowHours.length > 0 && <OpenNow hours={openNowHours} />}
          </div>
        </div>
      </section>

      <section id="menu" className="mx-auto max-w-4xl px-6 py-20">
        <SectionHeader
          eyebrow="The menu"
          title="What's on tonight"
          description="Short, seasonal, and printed fresh most weeks. Ask about anything you don't recognise."
        />
        <div className="mt-10">
          {dishes.isPending && <Skeleton className="h-64 rounded-xl" />}
          {dishes.isError && (
            <p className="text-sm text-destructive">
              Couldn't load the menu right now. Refresh and try again.
            </p>
          )}
          {dishes.data?.length === 0 && (
            <div className="rounded-xl border border-border bg-muted/30 p-10 text-center">
              <p className="font-medium">The menu isn't listed yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Check back soon, or call and we'll talk you through tonight's dishes.
              </p>
            </div>
          )}
          {!!dishes.data?.length && <MenuSection groups={groups} currency="£" />}
        </div>
      </section>

      <section id="kitchen" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-4xl px-6 py-20">
          <SectionHeader
            eyebrow="Who cooks"
            title="The kitchen"
            description="Small team, long hours, no shortcuts."
          />
          <div className="mt-10">
            {chefs.isPending && <Skeleton className="h-32 rounded-xl" />}
            {chefs.isError && (
              <p className="text-sm text-destructive">Couldn't load the team. Refresh and try again.</p>
            )}
            {chefs.data?.length === 0 && (
              <div className="rounded-xl border border-border bg-background p-8 text-center">
                <p className="font-medium">Team details coming soon</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  We'll introduce the kitchen here shortly.
                </p>
              </div>
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
            address="22 Pell Street, Sheffield, S3 8JQ"
            note="Opposite the launderette. Street parking after 6pm, or the Cambridge Street car park two minutes away."
          />
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
                <p className="text-sm text-muted-foreground">
                  Hours aren't listed yet — call us and we'll tell you.
                </p>
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
            description="Give us a ring and we'll hold you a table — especially for weekends, when it's worth calling ahead."
            action={{ label: "Call 0114 234 5678", href: "tel:+441142345678" }}
          />
        </div>
      </section>
    </SiteChrome>
  );
}
