import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { useRows, type Row } from "@/lib/rows";
import { SectionHeader } from "@/components/ui/section-header";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty } from "@/components/ui/empty";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/timetable")({ component: Timetable });

type Teacher = Row & { name: string; bio: string | null; phone: string | null };

const CHROME = {
  name: "Aurora Yoga",
  tagline: "Slow down, breathe, come back to yourself.",
  links: [
    { label: "Home", href: "#/" },
    { label: "Timetable", href: "#/timetable" },
    { label: "Book a class", href: "#/book" },
    { label: "Members", href: "#/members" },
    { label: "Account", href: "#/account" },
  ],
  action: { label: "Book a class", href: "#/book" },
};

const CLASSES = [
  { name: "Sunrise Flow", day: "Monday", time: "07:00", level: "All levels" },
  { name: "Vinyasa Build", day: "Monday", time: "18:15", level: "Intermediate" },
  { name: "Gentle Hatha", day: "Tuesday", time: "10:00", level: "Beginner" },
  { name: "Power Yoga", day: "Tuesday", time: "19:00", level: "Advanced" },
  { name: "Restorative", day: "Wednesday", time: "18:00", level: "All levels" },
  { name: "Sunrise Flow", day: "Thursday", time: "07:00", level: "All levels" },
  { name: "Yin & Breath", day: "Thursday", time: "19:30", level: "All levels" },
  { name: "Vinyasa Build", day: "Friday", time: "09:30", level: "Intermediate" },
  { name: "Family Flow", day: "Saturday", time: "10:00", level: "Beginner" },
  { name: "Slow Sunday", day: "Sunday", time: "11:00", level: "All levels" },
];

function Timetable() {
  const teachers = useRows<Teacher>("teachers", { order: "name", dir: "asc" });
  const navigate = useNavigate();

  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-4xl px-6 py-14">
        <SectionHeader
          eyebrow="This week"
          title="Class timetable"
          description="Pick a class and book straight in — the form will carry it over for you."
        />

        <ul className="mt-8 divide-y divide-border rounded-xl border border-border motion-stagger">
          {CLASSES.map((c, i) => (
            <li
              key={`${c.name}-${c.day}-${i}`}
              className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
            >
              <div>
                <p className="font-medium">{c.name}</p>
                <p className="text-sm text-muted-foreground">
                  {c.day} · {c.time} · {c.level}
                </p>
              </div>
              <Button
                size="sm"
                className="motion-press"
                onClick={() => navigate({ to: "/book", search: { class: c.name } })}
              >
                Book
              </Button>
            </li>
          ))}
        </ul>

        <div className="mt-14">
          <SectionHeader eyebrow="Taught by" title="Our teachers" />
          {teachers.isPending && <Skeleton className="mt-6 h-32 rounded-xl" />}
          {teachers.isError && (
            <p className="mt-6 text-sm text-destructive">
              Couldn't load our teachers. Refresh and try again.
            </p>
          )}
          {teachers.data?.length === 0 && (
            <Empty
              className="mt-6"
              title="No teachers listed yet"
              description="Check back soon."
            />
          )}
          {!!teachers.data?.length && (
            <ul className="mt-6 grid gap-4 sm:grid-cols-2 motion-stagger">
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
