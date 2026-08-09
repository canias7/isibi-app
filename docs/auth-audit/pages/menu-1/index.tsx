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

type Dish = Row & { name: string; description: string | null; price: string | null; course: string | null };
type Chef = Row & { name: string; role: string | null; photo_url: string | null };
type Hour = Row & { day: string; opens: string | null; closes: string | null };

const CHROME = {
  name: "Pell Street Kitchen",
  tagline: "A neighbourhood table on Pell Street.",
  links: [
    { label: "Menu", href: "#menu" },
    { label: "Kitchen", href: "#kitchen" },
    { label: "Find us", href: "#find-us" },
  ],
  action: { label: "Directions", href: "#find-us" },
};

const DAY_ORDER: Record<string, number> = {
  monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 0,
};

function toDayHours(hours: Hour[]): DayHours[] {
  return hours.map((h) => ({
    day: DAY_ORDER[h.day.toLowerCase()] ?? 0,
    label: h.day,
    open: h.opens,
    close: h.closes,
  }));
}

function Home() {
  const dishes = useRows<Dish>("dishes", { order: "course", dir: "asc" });
  const chefs = useRows<Chef>("chefs", { order: "name", dir: "asc" });
  const hours = useRows<Hour>("hours");

  const openHours = hours.data?.filter((h) => h.opens && h.closes) ?? [];

  const groups: MenuGroup[] = (() => {
    if (!dishes.data?.length) return [];
    const byCourse = new Map<string, Dish[]>();
    for (const d of dishes.data) {
      const key = d.course?.trim() || "On the menu";
      if (!byCourse.has(key)) byCourse.set(key, []);
      byCourse.get(key)!.push(d);
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

  return (
    <SiteChrome {...CHROME}>
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Pell Street · a neighbourhood restaurant
          </p>
          <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">Pell Street Kitchen</h1>
          <p className="mt-4 max-w-lg text-lg leading-relaxed text-muted-foreground">
            Same street, same tables, same kitchen since we opened. No bookings taken online —
            ring us and we'll hold you a table.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <a className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" href="#find-us">
              Directions
            </a>
            <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="#menu">
              See the menu
            </a>
            {hours.isPending && <Skeleton className="h-9 w-40 rounded-md" />}
            {!hours.isPending && openHours.length > 0 && <OpenNow hours={openHours.map((h) => ({ day: DAY_ORDER[h.day.toLowerCase()] ?? 0, open: h.opens!, close: h.closes! }))} />}
          </div>
        </div>
      </section>

      <section id="menu" className="mx-auto max-w-4xl px-6 py-20">
        <SectionHeader
          eyebrow="The menu"
          title="What's on tonight"
          description="Cooked to order, kept simple. Ring ahead if you're a big table."
        />
        <div className="mt-10">
          {dishes.isPending && <Skeleton className="h-72 rounded-xl" />}
          {dishes.isError && (
            <p className="text-sm text-destructive">Couldn't load the menu. Refresh and try again.</p>
          )}
          {dishes.data?.length === 0 && (
            <Empty title="Nothing on the menu yet" description="Check back soon — we're setting it up." />
          )}
          {!!dishes.data?.length && <MenuSection groups={groups} />}
        </div>
      </section>

      <section id="kitchen" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-4xl px-6 py-20">
          <SectionHeader eyebrow="Who cooks" title="The kitchen" description="The people behind every plate." />
          <div className="mt-10">
            {chefs.isPending && <Skeleton className="h-40 rounded-xl" />}
            {chefs.isError && (
              <p className="text-sm text-destructive">Couldn't load the team. Refresh and try again.</p>
            )}
            {chefs.data?.length === 0 && (
              <Empty title="Nothing here yet" description="We'll introduce the kitchen soon." />
            )}
            {!!chefs.data?.length && (
              <TeamGrid
                items={chefs.data.map((c) => ({ name: c.name, role: c.role, photo: c.photo_url }))}
                columns={4}
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
              address="Pell Street"
              note="No online booking — ring us and we'll hold you a table."
            />
          </div>
          <div>
            <h3 className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">Opening hours</h3>
            <div className="mt-5">
              {hours.isPending && <Skeleton className="h-56 rounded-xl" />}
              {hours.isError && (
                <p className="text-sm text-destructive">Couldn't load our hours. Refresh and try again.</p>
              )}
              {hours.data?.length === 0 && (
                <Empty title="Hours coming soon" description="We're finalising our schedule." />
              )}
              {!!hours.data?.length && <OpeningHours days={toDayHours(hours.data)} />}
            </div>
          </div>
          <SafeImage src={null} alt="" ratio="4/5" fallbackSeed="pell-street-front" />
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <CtaBand
          title="We don't take bookings online"
          description="Give us a call and we'll have a table ready for you."
          action={{ label: "Get directions", href: "#find-us" }}
        />
      </section>
    </SiteChrome>
  );
}
