import { createFileRoute } from "@tanstack/react-router";

import { useRows, type Row } from "@/lib/rows";
import { CtaBand } from "@/components/ui/cta-band";
import { Hero } from "@/components/ui/hero";
import { SectionHeader } from "@/components/ui/section-header";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Skeleton } from "@/components/ui/skeleton";
import { TeamGrid } from "@/components/ui/team-grid";
import { Empty } from "@/components/ui/empty";
import { TrustStrip } from "@/components/ui/trust-strip";

export const Route = createFileRoute("/")({ component: Home });

type Teacher = Row & { name: string; bio: string | null; phone: string | null };

const CHROME = {
  name: "Aurora Yoga",
  tagline: "Slow down. Breathe. Move well.",
  links: [
    { label: "Timetable", href: "#/timetable" },
    { label: "Book", href: "#/book" },
    { label: "Notes", href: "#/notes" },
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
        subtitle="A calm, well-lit studio with classes for every level, seven days a week."
        primary={{ label: "Book a class", href: "#/book" }}
        secondary={{ label: "See the timetable", href: "#/timetable" }}
      />

      <section className="mx-auto max-w-5xl px-6">
        <TrustStrip
          items={[
            { title: "All levels welcome", description: "Mats and blocks provided" },
            { title: "Small classes", description: "Capped so everyone gets seen" },
            { title: "Book in a minute", description: "No account needed to reserve a spot" },
          ]}
        />
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <SectionHeader
            eyebrow="The teachers"
            title="Learn from people who love this"
            description="Every class is led by one of our resident teachers."
          />
          {teachers.isPending && (
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
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
          title="Your first class is a decision away"
          description="Pick a slot on the timetable and book it — takes less than a minute."
          action={{ label: "Book a class", href: "#/book" }}
        />
      </section>
    </SiteChrome>
  );
}
