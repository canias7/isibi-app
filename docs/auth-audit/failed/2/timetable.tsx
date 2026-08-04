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
  tagline: "A quiet studio for a steady practice.",
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
  { name: "Sunrise Flow", day: "Monday", time: "07:00", level: "All levels" },
  { name: "Hatha Foundations", day: "Monday", time: "18:15", level: "Beginners" },
  { name: "Vinyasa", day: "Tuesday", time: "09:00", level: "Intermediate" },
  { name: "Restorative", day: "Tuesday", time: "19:00", level: "All levels" },
  { name: "Power Flow", day: "Wednesday", time: "06:30", level: "Advanced" },
  { name: "Hatha Foundations", day: "Wednesday", time: "18:15", level: "Beginners" },
  { name: "Vinyasa", day: "Thursday", time: "09:00", level: "Intermediate" },
  { name: "Yin", day: "Thursday", time: "19:30", level: "All levels" },
  { name: "Sunrise Flow", day: "Friday", time: "07:00", level: "All levels" },
  { name: "Family Class", day: "Saturday", time: "10:00", level: "All ages" },
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
          description="Pick a class below to book it — the form opens with the class already chosen."
        />

        <ul className="mt-8 grid gap-3 motion-stagger">
          {CLASSES.map((c, i) => (
            <li key={i}>
              <Card>
                <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
                  <div>
                    <p className="font-medium">{c.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {c.day} · {c.time} · {c.level}
                    </p>
                  </div>
                  <Button
                    className="motion-press"
                    onClick={() => navigate({ to: "/book", search: { class: c.name } })}
                  >
                    Book
                  </Button>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>

        <div className="mt-16">
          <SectionHeader eyebrow="Who's teaching" title="The teachers" />
          {teachers.isPending && (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
            </div>
          )}
          {teachers.isError && (
            <p className="mt-6 text-sm text-destructive">Couldn't load the teachers.</p>
          )}
          {teachers.data?.length === 0 && (
            <Empty className="mt-6" title="No teachers listed yet" description="They will appear here soon." />
          )}
          {!!teachers.data?.length && (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {teachers.data.map((t) => (
                <Card key={t.id}>
                  <CardHeader>
                    <CardTitle className="text-base">{t.name}</CardTitle>
                    {t.bio && <CardDescription>{t.bio}</CardDescription>}
                  </CardHeader>
                  {t.phone && (
                    <CardContent className="text-sm text-muted-foreground">{t.phone}</CardContent>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </SiteChrome>
  );
}
