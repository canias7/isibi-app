import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { SectionHeader } from "@/components/ui/section-header";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/timetable")({ component: Timetable });

const CHROME = {
  name: "Aurora Yoga",
  tagline: "Slow down, breathe, move well.",
  links: [
    { label: "Timetable", href: "#/timetable" },
    { label: "Book", href: "#/book" },
    { label: "Members", href: "#/members" },
    { label: "Account", href: "#/account" },
  ],
  action: { label: "Book a class", href: "#/book" },
};

type ClassRow = {
  name: string;
  day: string;
  time: string;
  level: string;
  duration: string;
};

const TIMETABLE: ClassRow[] = [
  { name: "Sunrise Flow", day: "Monday", time: "07:00", level: "All levels", duration: "60 min" },
  { name: "Power Vinyasa", day: "Monday", time: "18:00", level: "Intermediate", duration: "60 min" },
  { name: "Slow Hatha", day: "Tuesday", time: "09:30", level: "Beginner friendly", duration: "75 min" },
  { name: "Sunrise Flow", day: "Wednesday", time: "07:00", level: "All levels", duration: "60 min" },
  { name: "Power Vinyasa", day: "Wednesday", time: "18:00", level: "Intermediate", duration: "60 min" },
  { name: "Slow Hatha", day: "Thursday", time: "09:30", level: "Beginner friendly", duration: "75 min" },
  { name: "Sunrise Flow", day: "Friday", time: "07:00", level: "All levels", duration: "60 min" },
  { name: "Restorative & Yin", day: "Sunday", time: "17:00", level: "All levels", duration: "75 min" },
];

function Timetable() {
  const navigate = useNavigate();

  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-3xl px-6 py-16">
        <SectionHeader
          eyebrow="Timetable"
          title="This week's classes"
          description="Pick a class below to book your spot — it carries straight into the form."
        />
        <ul className="mt-8 divide-y divide-border rounded-xl border border-border motion-stagger">
          {TIMETABLE.map((c, i) => (
            <li key={`${c.name}-${c.day}-${i}`} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-medium">{c.name}</p>
                <p className="text-sm text-muted-foreground">
                  {c.day} · {c.time} · {c.duration} · {c.level}
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
      </div>
    </SiteChrome>
  );
}
