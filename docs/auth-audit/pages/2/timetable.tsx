import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { useRows, type Row } from "@/lib/rows";
import { PriceList } from "@/components/ui/price-list";
import { SectionHeader } from "@/components/ui/section-header";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty } from "@/components/ui/empty";

export const Route = createFileRoute("/timetable")({ component: Timetable });

type Teacher = Row & { name: string; bio: string | null; phone: string | null };

const CHROME = {
  name: "Aurora Yoga",
  tagline: "Slow down. Breathe. Move well.",
  links: [
    { label: "Home", href: "#/" },
    { label: "Timetable", href: "#/timetable" },
    { label: "Book", href: "#/book" },
    { label: "Notes", href: "#/notes" },
    { label: "Account", href: "#/account" },
  ],
  action: { label: "Book a class", href: "#/book" },
};

const CLASSES = [
  { name: "Sunrise Flow", meta: "Mon, Wed, Fri · 7:00am", description: "A gentle vinyasa to start the day." },
  { name: "Slow & Stretch", meta: "Tue, Thu · 12:00pm", description: "Restorative stretching over lunch." },
  { name: "Power Vinyasa", meta: "Mon, Wed · 6:00pm", description: "A stronger, faster-paced flow." },
  { name: "Yin & Candlelight", meta: "Fri · 7:30pm", description: "Long holds, low light, quiet room." },
  { name: "Weekend Wind-Down", meta: "Sat, Sun · 10:00am", description: "An easy weekend session for all levels." },
];

function Timetable() {
  const teachers = useRows<Teacher>("teachers", { order: "name", dir: "asc" });
  const navigate = useNavigate();

  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-3xl px-6 py-16">
        <SectionHeader
          eyebrow="This week"
          title="Class timetable"
          description="Pick a class below to book your spot — the form opens with it filled in."
        />
        <PriceList
          className="mt-8"
          items={CLASSES.map((c) => ({ name: c.name, description: c.description, price: null, meta: c.meta }))}
          action={{
            label: "Book",
            onSelect: (r) => navigate({ to: "/book", search: { class: r.name } }),
          }}
        />

        <div className="mt-16">
          <SectionHeader eyebrow="Teachers" title="Who's teaching" />
          {teachers.isPending && <Skeleton className="mt-6 h-32 rounded-xl" />}
          {teachers.isError && (
            <p className="mt-6 text-sm text-destructive">
              Couldn't load teacher details right now.
            </p>
          )}
          {teachers.data?.length === 0 && (
            <Empty className="mt-6" title="No teachers listed yet" description="Profiles are on their way." />
          )}
          {!!teachers.data?.length && (
            <ul className="mt-6 grid gap-3 sm:grid-cols-2 motion-stagger">
              {teachers.data.map((t) => (
                <li key={t.id} className="rounded-xl border border-border p-4">
                  <p className="font-medium">{t.name}</p>
                  {t.bio && <p className="mt-1 text-sm text-muted-foreground">{t.bio}</p>}
                  {t.phone && <p className="mt-1 text-sm text-muted-foreground">{t.phone}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </SiteChrome>
  );
}
