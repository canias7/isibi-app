import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { useRows, type Row } from "@/lib/rows";
import { SectionHeader } from "@/components/ui/section-header";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty } from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const Route = createFileRoute("/timetable")({ component: Timetable });

type Teacher = Row & { name: string; bio: string | null; phone: string | null };

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A quiet room, a good mat, and a class for wherever you're starting from.",
  links: [
    { label: "Home", href: "#/" },
    { label: "Timetable", href: "#/timetable" },
    { label: "Book", href: "#/book" },
    { label: "Members", href: "#/members" },
    { label: "Account", href: "#/account" },
  ],
  action: { label: "Book a class", href: "#/book" },
};

const CLASSES = [
  { name: "Sunrise Flow", day: "Monday", time: "07:00", teacher: "a studio teacher" },
  { name: "Gentle Hatha", day: "Monday", time: "18:00", teacher: "a studio teacher" },
  { name: "Vinyasa Build", day: "Wednesday", time: "07:00", teacher: "a studio teacher" },
  { name: "Restorative", day: "Wednesday", time: "19:00", teacher: "a studio teacher" },
  { name: "Power Flow", day: "Friday", time: "07:00", teacher: "a studio teacher" },
  { name: "Slow Sunday", day: "Sunday", time: "10:00", teacher: "a studio teacher" },
];

function Timetable() {
  const teachers = useRows<Teacher>("teachers", { order: "name", dir: "asc" });
  const navigate = useNavigate();

  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-4xl px-6 py-16">
        <SectionHeader
          eyebrow="Timetable"
          title="This week's classes"
          description="Pick a class below and it will carry straight into the booking form."
        />

        <ul className="mt-8 grid gap-4 sm:grid-cols-2 motion-stagger">
          {CLASSES.map((c) => (
            <li key={c.name + c.day + c.time}>
              <Card className="h-full motion-lift">
                <CardHeader>
                  <CardTitle>{c.name}</CardTitle>
                  <CardDescription>
                    {c.day} · {c.time}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    className="motion-press"
                    onClick={() => navigate({ to: "/book", search: { class: c.name } })}
                  >
                    Book this class
                  </Button>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>

        <div className="mt-16">
          <SectionHeader eyebrow="Teachers" title="Who's teaching" />
          {teachers.isPending && <Skeleton className="mt-6 h-32 rounded-xl" />}
          {teachers.isError && (
            <p className="mt-6 text-sm text-destructive">
              Couldn't load the teachers. Refresh and try again.
            </p>
          )}
          {teachers.data?.length === 0 && (
            <Empty className="mt-6" title="No teachers listed yet" description="Check back soon." />
          )}
          {!!teachers.data?.length && (
            <ul className="mt-6 grid gap-3 sm:grid-cols-2 motion-stagger">
              {teachers.data.map((t) => (
                <li key={t.id} className="rounded-lg border border-border p-4">
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
