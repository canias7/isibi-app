import { createFileRoute, Link } from "@tanstack/react-router";

import { useRows, type Row } from "@/lib/rows";
import { CtaBand } from "@/components/ui/cta-band";
import { Hero } from "@/components/ui/hero";
import { SectionHeader } from "@/components/ui/section-header";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Skeleton } from "@/components/ui/skeleton";
import { TeamGrid } from "@/components/ui/team-grid";
import { Empty } from "@/components/ui/empty";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({ component: Home });

type Teacher = Row & { name: string; bio: string | null; phone: string | null };

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

const CLASSES = [
  { name: "Sunrise Flow", time: "Mon, Wed, Fri · 07:00", level: "All levels" },
  { name: "Slow Hatha", time: "Tue, Thu · 09:30", level: "Beginner friendly" },
  { name: "Power Vinyasa", time: "Mon, Wed · 18:00", level: "Intermediate" },
  { name: "Restorative & Yin", time: "Sun · 17:00", level: "All levels" },
];

function Home() {
  const teachers = useRows<Teacher>("teachers", { order: "name", dir: "asc" });

  return (
    <SiteChrome {...CHROME}>
      <Hero
        title="Aurora Yoga"
        subtitle="A small studio with a big timetable. Come as you are, mat or no mat."
        primary={{ label: "Book a class", href: "#/book" }}
        secondary={{ label: "See the timetable", href: "#/timetable" }}
      />

      <section id="timetable-preview" className="mx-auto max-w-4xl px-6 py-16">
        <SectionHeader
          eyebrow="This week"
          title="A taste of the timetable"
          description="Full schedule and booking on the timetable page."
        />
        <ul className="mt-8 divide-y divide-border rounded-xl border border-border motion-stagger">
          {CLASSES.map((c) => (
            <li key={c.name} className="flex items-center justify-between gap-4 p-4">
              <div>
                <p className="font-medium">{c.name}</p>
                <p className="text-sm text-muted-foreground">{c.time}</p>
              </div>
              <span className="text-sm text-muted-foreground">{c.level}</span>
            </li>
          ))}
        </ul>
        <div className="mt-6">
          <Button asChild>
            <Link to="/timetable">View full timetable</Link>
          </Button>
        </div>
      </section>

      <section id="teachers" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <SectionHeader
            eyebrow="Meet the teachers"
            title="Who you'll practise with"
            description="Every class is taught by one of our small, dedicated team."
          />
          {teachers.isPending && <Skeleton className="mt-8 h-40 rounded-xl" />}
          {teachers.isError && (
            <p className="mt-8 text-sm text-destructive">
              Couldn't load the teachers. Refresh and try again.
            </p>
          )}
          {teachers.data?.length === 0 && (
            <Empty
              className="mt-8"
              title="No teachers listed yet"
              description="Check back soon — our teacher profiles are on their way."
            />
          )}
          {!!teachers.data?.length && (
            <TeamGrid
              className="mt-8"
              items={teachers.data.map((t) => ({
                name: t.name,
                role: t.bio ?? "Yoga teacher",
              }))}
            />
          )}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-20">
        <CtaBand
          title="Your first class is waiting"
          description="Pick a time that works and we'll see you on the mat."
          action={{ label: "Book a class", href: "#/book" }}
        />
      </section>
    </SiteChrome>
  );
}
