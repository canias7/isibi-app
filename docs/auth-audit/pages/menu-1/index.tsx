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

function parsePrice(price: string | null): number | string | null {
  if (price == null) return null;
  const n = Number(price);
  return Number.isFinite(n) ? n : price;
}

function Home() {
  const dishes = useRows<Dish>("dishes", { order: "course", dir: "asc" });
  const chefs = useRows<Chef>("chefs", { order: "name", dir: "asc" });
  const hours = useRows<Hour>("hours", { order: "day", dir: "asc" });

  const groups: MenuGroup[] = [];
  if (dishes.data?.length) {
    const byCourse = new Map<string, Dish[]>();
    for (const d of dishes.data) {
      const key = d.course ?? "On the menu";
      if (!byCourse.has(key)) byCourse.set(key, []);
      byCourse.get(key)!.push(d);
    }
    for (const [course, items] of byCourse) {
      groups.push({
        name: course,
        items: items.map((d) => ({
          name: d.name,
          description: d.description,
          price: parsePrice(d.price),
        })),
      });
    }
  }

  const dayHours: DayHours[] = (hours.data ?? [])
    .slice()
    .sort((a, b) => (DAY_ORDER[a.day.toLowerCase()] ?? 99) - (DAY_ORDER[b.day.toLowerCase()] ?? 99))
    .map((h) => ({
      day: DAY_ORDER[h.day.toLowerCase()] ?? 0,
      label: h.day,
      open: h.opens,
      close: h.closes,
    }));

  const openNowHours = dayHours
    .filter((h) => h.open && h.close)
    .map((h) => ({ day: h.day, open: h.open!, close: h.close! }));

  return (
    <SiteChrome {...CHROME}>
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Pell Street</p>
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">Pell Street Kitchen</h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                A small room, a short menu, and a kitchen that changes it when the market does.
                No booking line to call — come by, and if the room's full there's a bench outside
                worth the wait.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <a className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" href="#find-us">Directions</a>
                <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="#menu">See the menu</a>
                {!hours.isPending && !hours.isError && openNowHours.length > 0 && (
                  <OpenNow hours={openNowHours} />
                )}
              </div>
            </div>
            <SafeImage src={null} alt="" ratio="4/3" fallbackSeed="psk-hero" />
          </div>
        </div>
      </section>

      <section id="menu" className="mx-auto max-w-5xl px-6 py-20">
        <SectionHeader
          eyebrow="The menu"
          title="What's on tonight"
          description="Short, seasonal, and priced the way we'd want to see it ourselves."
        />
        <div className="mt-10">
          {dishes.isPending && (
            <div className="grid gap-4">
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          )}
          {dishes.isError && (
            <p className="text-sm text-destructive">Couldn't load the menu. Refresh and try again.</p>
          )}
          {!dishes.isPending && !dishes.isError && dishes.data?.length === 0 && (
            <Empty title="Menu coming soon" description="We're setting the menu for this room. Check back shortly." />
          )}
          {!dishes.isPending && !dishes.isError && groups.length > 0 && (
            <MenuSection groups={groups} />
          )}
        </div>
      </section>

      <section id="kitchen" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <SectionHeader eyebrow="Who cooks" title="The kitchen" description="The people behind the pass, most nights." />
          <div className="mt-10">
            {chefs.isPending && (
              <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
                <Skeleton className="h-40 rounded-xl" />
                <Skeleton className="h-40 rounded-xl" />
                <Skeleton className="h-40 rounded-xl" />
                <Skeleton className="h-40 rounded-xl" />
              </div>
            )}
            {chefs.isError && (
              <p className="text-sm text-destructive">Couldn't load the team. Refresh and try again.</p>
            )}
            {!chefs.isPending && !chefs.isError && chefs.data?.length === 0 && (
              <Empty title="Team coming soon" description="We haven't introduced the kitchen yet." />
            )}
            {!chefs.isPending && !chefs.isError && !!chefs.data?.length && (
              <TeamGrid
                items={chefs.data.map((c) => ({ name: c.name, role: c.role, photo: c.photo_url }))}
              />
            )}
          </div>
        </div>
      </section>

      <section id="find-us" className="mx-auto max-w-5xl px-6 py-20">
        <div className="grid gap-10 sm:grid-cols-2">
          <div>
            <SectionHeader eyebrow="Find us" title="On Pell Street" />
            <LocationCard
              className="mt-6"
              name="Pell Street Kitchen"
              address="Pell Street, in the middle of the row"
              note="No bookings — walk in. If the room's full, put your name in and we'll come find you."
            />
          </div>
          <div>
            <h3 className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">Opening hours</h3>
            {hours.isPending && <Skeleton className="mt-5 h-48 rounded-md" />}
            {hours.isError && (
              <p className="mt-5 text-sm text-destructive">Couldn't load our hours. Refresh and try again.</p>
            )}
            {!hours.isPending && !hours.isError && dayHours.length === 0 && (
              <p className="mt-5 text-sm text-muted-foreground">Hours coming soon — give us a call.</p>
            )}
            {!hours.isPending && !hours.isError && dayHours.length > 0 && (
              <OpeningHours className="mt-5" days={dayHours} />
            )}
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <CtaBand
            title="No online booking — just come by"
            description="We keep a few tables free for walk-ins every night. Get directions and we'll see you soon."
            action={{ label: "Get directions", href: "#find-us" }}
          />
        </div>
      </section>
    </SiteChrome>
  );
}
