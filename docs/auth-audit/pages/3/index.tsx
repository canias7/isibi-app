import { createFileRoute } from "@tanstack/react-router";

import { useRows, type Row } from "@/lib/rows";
import { CtaBand } from "@/components/ui/cta-band";
import { Hero } from "@/components/ui/hero";
import { SectionHeader } from "@/components/ui/section-header";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Skeleton } from "@/components/ui/skeleton";
import { TeamGrid } from "@/components/ui/team-grid";
import { Empty } from "@/components/ui/empty";
import { AgendaList } from "@/components/ui/agenda-list";

export const Route = createFileRoute("/")({ component: Home });

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
  { title: "Morning Vinyasa", time: "Mon, Wed, Fri · 7:00am", description: "A flowing start to the day, breath-led." },
  { title: "Slow Hatha", time: "Tue, Thu · 6:00pm", description: "Long holds, gentle pace, good for beginners." },
  { title: "Restorative", time: "Sun · 5:00pm", description: "Props, blankets, and stillness." },
];

function Home() {
  const teachers = useRows<Teacher>("teachers", { order: "name", dir: "asc" });

  return (
    <SiteChrome {...CHROME}>
      <Hero
        title="Aurora Yoga"
        subtitle="A small studio with a steady practice — morning flows, slow evenings, and a room that stays quiet."
        primary={{ label: "Book a class", href: "#/book" }}
        secondary={{ label: "See the timetable", href: "#/timetable" }}
      />

      <section className="mx-auto max-w-5xl px-6 py-16">
        <SectionHeader
          eyebrow="This week"
          title="A few classes to start with"
          description="The full timetable and booking form are on their own pages."
        />
        <AgendaList
          className="mt-8"
          items={CLASSES.map((c) => ({ title: c.title, time: c.time, description: c.description }))}
        />
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <SectionHeader
            eyebrow="The teachers"
            title="Who you'll practice with"
            description="Every class is taught by one of the studio's own teachers."
          />
          {teachers.isPending && <Skeleton className="mt-8 h-40 rounded-xl" />}
          {teachers.isError && (
            <p className="mt-8 text-sm text-destructive">Couldn't load the teachers. Refresh and try again.</p>
          )}
          {teachers.data?.length === 0 && (
            <div className="mt-8">
              <Empty title="No teachers listed yet" description="Check back soon — the studio is adding profiles." />
            </div>
          )}
          {!!teachers.data?.length && (
            <TeamGrid
              className="mt-8"
              items={teachers.data.map((t) => ({ name: t.name, role: t.bio ?? "Yoga teacher" }))}
            />
          )}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <CtaBand
          title="Your mat is waiting"
          description="Pick a class and a time — booking takes a minute."
          action={{ label: "Book a class", href: "#/book" }}
        />
      </section>
    </SiteChrome>
  );
}
