import { createFileRoute } from "@tanstack/react-router";

import { useRows, type Row } from "@/lib/rows";
import { CtaBand } from "@/components/ui/cta-band";
import { Hero } from "@/components/ui/hero";
import { SectionHeader } from "@/components/ui/section-header";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Skeleton } from "@/components/ui/skeleton";
import { TeamGrid } from "@/components/ui/team-grid";
import { Empty } from "@/components/ui/empty";

export const Route = createFileRoute("/")({ component: Home });

type Teacher = Row & { name: string; bio: string | null; phone: string | null };

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A quiet studio for a steady practice.",
  links: [
    { label: "Timetable", href: "#/timetable" },
    { label: "Book", href: "#/book" },
    { label: "Members", href: "#/members" },
    { label: "Account", href: "#/account" },
  ],
  action: { label: "Book a class", href: "#/book" },
};

function Home() {
  const teachers = useRows<Teacher>("teachers", { order: "name", dir: "asc" });

  return (
    <SiteChrome {...CHROME}>
      <Hero
        title="Aurora Yoga"
        subtitle="Small classes, natural light, a studio built around the practice rather than around us."
        primary={{ label: "Book a class", href: "#/book" }}
        secondary={{ label: "See the timetable", href: "#/timetable" }}
      />

      <section id="teachers" className="mx-auto max-w-5xl px-6 py-20 motion-reveal">
        <SectionHeader
          eyebrow="The teachers"
          title="Learn from people who practise daily"
          description="Every class is taught live, in the room, by one of these teachers."
        />
        {teachers.isPending && (
          <div className="mt-8 grid gap-5 sm:grid-cols-3">
            <Skeleton className="h-40 rounded-xl" />
            <Skeleton className="h-40 rounded-xl" />
            <Skeleton className="h-40 rounded-xl" />
          </div>
        )}
        {teachers.isError && (
          <p className="mt-8 text-sm text-destructive">
            Couldn't load the teachers. Refresh and try again.
          </p>
        )}
        {teachers.data?.length === 0 && (
          <Empty
            className="mt-8"
            title="No teachers listed yet"
            description="Check back soon — our teaching team will appear here."
          />
        )}
        {!!teachers.data?.length && (
          <TeamGrid
            className="mt-8"
            items={teachers.data.map((t) => ({
              name: t.name,
              role: t.bio ?? undefined,
            }))}
          />
        )}
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <CtaBand
            title="Your mat is waiting"
            description="Pick a class from the timetable and book in under a minute."
            action={{ label: "Book a class", href: "#/book" }}
          />
        </div>
      </section>
    </SiteChrome>
  );
}
