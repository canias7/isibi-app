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
  tagline: "A quiet room, a good mat, and a class for wherever you're starting from.",
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
        subtitle="Small classes, unhurried pace. Morning flow, evening restore, and everything between."
        primary={{ label: "Book a class", href: "#/book" }}
        secondary={{ label: "See the timetable", href: "#/timetable" }}
      />

      <section className="mx-auto max-w-5xl px-6 py-20 motion-reveal">
        <SectionHeader
          eyebrow="Your teachers"
          title="Who you'll practise with"
          description="Every class is taught by one of the studio's own teachers, never a substitute you haven't met."
        />
        {teachers.isPending && <Skeleton className="mt-8 h-48 rounded-xl" />}
        {teachers.isError && (
          <p className="mt-8 text-sm text-destructive">
            Couldn't load the teachers. Refresh and try again.
          </p>
        )}
        {teachers.data?.length === 0 && (
          <Empty
            className="mt-8"
            title="No teachers listed yet"
            description="Check back soon — we're adding profiles for the studio's teachers."
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
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <CtaBand
            title="Your first class is a good time to start"
            description="Pick a slot on the timetable and book in a minute — we'll see you on the mat."
            action={{ label: "Book a class", href: "#/book" }}
          />
        </div>
      </section>
    </SiteChrome>
  );
}
