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
  tagline: "Slow down, breathe, come back to yourself.",
  links: [
    { label: "Timetable", href: "#/timetable" },
    { label: "Book a class", href: "#/book" },
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
        subtitle="A calm, well-lit studio for every kind of practice — from your first sun salutation to a deep restorative wind-down."
        primary={{ label: "Book a class", href: "#/book" }}
        secondary={{ label: "See the timetable", href: "#/timetable" }}
      />

      <section className="mx-auto max-w-5xl px-6 py-20">
        <SectionHeader
          eyebrow="Our teachers"
          title="Meet the studio"
          description="Every class is taught by someone who has been where you are on the mat."
        />
        {teachers.isPending && <Skeleton className="mt-8 h-48 rounded-xl" />}
        {teachers.isError && (
          <p className="mt-8 text-sm text-destructive">
            Couldn't load our teachers. Refresh and try again.
          </p>
        )}
        {teachers.data?.length === 0 && (
          <Empty
            className="mt-8"
            title="No teachers listed yet"
            description="Check back soon — our team will appear here."
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
            description="Browse the timetable and book straight in — no membership required."
            action={{ label: "View timetable", href: "#/timetable" }}
          />
        </div>
      </section>
    </SiteChrome>
  );
}
