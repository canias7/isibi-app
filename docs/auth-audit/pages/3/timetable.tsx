import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { useRows, type Row } from "@/lib/rows";
import { SectionHeader } from "@/components/ui/section-header";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty } from "@/components/ui/empty";
import { PriceList } from "@/components/ui/price-list";

export const Route = createFileRoute("/timetable")({ component: Timetable });

type Teacher = Row & { name: string; bio: string | null; phone: string | null };

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A calm room, a steady practice, six days a week.",
  links: [
    { label: "Timetable", href: "#/timetable" },
    { label: "Book a class", href: "#/book" },
    { label: "Members", href: "#/members" },
    { label: "Account", href: "#/account" },
  ],
  action: { label: "Book a class", href: "#/book" },
};

const CLASSES = [
  { name: "Morning Vinyasa", meta: "Mon, Wed, Fri · 7:00am", description: "A flowing start to the day, breath-led." },
  { name: "Slow Hatha", meta: "Tue, Thu · 6:00pm", description: "Long holds, gentle pace, good for beginners." },
  { name: "Restorative", meta: "Sun · 5:00pm", description: "Props, blankets, and stillness." },
  { name: "Power Flow", meta: "Sat · 9:00am", description: "Stronger sequences, for an established practice." },
];

function Timetable() {
  const teachers = useRows<Teacher>("teachers", { order: "name", dir: "asc" });
  const navigate = useNavigate();

  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-3xl px-6 py-14">
        <SectionHeader
          eyebrow="Timetable"
          title="This week's classes"
          description="Pick a class and Book carries it straight into the form."
        />
        <PriceList
          className="mt-8"
          items={CLASSES.map((c) => ({ name: c.name, description: c.description, price: null, meta: c.meta }))}
          action={{ label: "Book", onSelect: (r) => navigate({ to: "/book", search: { class_name: r.name } }) }}
        />
      </div>

      <section className="border-t border-border bg-muted/40">
        <div className="mx-auto max-w-3xl px-6 py-14">
          <SectionHeader eyebrow="Teachers" title="Who's teaching" />
          {teachers.isPending && <Skeleton className="mt-8 h-32 rounded-xl" />}
          {teachers.isError && (
            <p className="mt-8 text-sm text-destructive">Couldn't load the teachers. Refresh and try again.</p>
          )}
          {teachers.data?.length === 0 && (
            <div className="mt-8">
              <Empty title="No teachers listed yet" description="Check back soon." />
            </div>
          )}
          {!!teachers.data?.length && (
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 motion-stagger">
              {teachers.data.map((t) => (
                <li key={t.id} className="rounded-lg border border-border bg-card p-4">
                  <p className="font-medium">{t.name}</p>
                  {t.bio && <p className="mt-1 text-sm text-muted-foreground">{t.bio}</p>}
                  {t.phone && <p className="mt-1 text-sm text-muted-foreground">{t.phone}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </SiteChrome>
  );
}
