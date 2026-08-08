import { createFileRoute } from "@tanstack/react-router";
import { useRows, type Row } from "@/lib/rows";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Gallery } from "@/components/ui/gallery";
import { SectionHeader } from "@/components/ui/section-header";
import { CtaBand } from "@/components/ui/cta-band";
import { TeamGrid } from "@/components/ui/team-grid";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/work")({ component: Work });

type Teacher = Row & { name: string; bio: string | null; photo_url: string | null };

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A calm room, six classes a day.",
  links: [
    { label: "Home", href: "#/" },
    { label: "Book", href: "#/book" },
    { label: "Members", href: "#/account" },
  ],
  action: { label: "Book now", href: "#/book" },
};

function Work() {
  const teachers = useRows<Teacher>("teachers", { order: "name", dir: "asc" });

  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-5xl px-6 py-16">
        <SectionHeader eyebrow="The studio" title="Inside the room" description="Wooden floors, big windows, and a lot of quiet mornings." />
        <Gallery
          className="mt-8"
          columns={3}
          items={[
            { src: null, alt: "The main room before a morning class" },
            { src: null, alt: "Mats laid out for Power Vinyasa" },
            { src: null, alt: "Props shelf — blocks and bolsters" },
            { src: null, alt: "Candlelit evening class" },
            { src: null, alt: "The studio at golden hour" },
            { src: null, alt: "Restorative class, blankets out" },
          ]}
        />
      </div>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <SectionHeader eyebrow="Teachers" title="Who you'll practise with" />
          {teachers.isPending && <Skeleton className="mt-8 h-40 rounded-xl" />}
          {teachers.isError && (
            <p className="mt-8 text-sm text-destructive">Couldn't load the teachers. Refresh and try again.</p>
          )}
          {teachers.data?.length === 0 && (
            <p className="mt-8 text-sm text-muted-foreground">No teachers listed yet.</p>
          )}
          {!!teachers.data?.length && (
            <TeamGrid
              className="mt-8"
              items={teachers.data.map((t) => ({ name: t.name, role: t.bio, photo: t.photo_url }))}
            />
          )}
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-6 py-16">
        <CtaBand title="See it for yourself" description="Your first class is free — book any slot that suits." action={{ label: "Book now", href: "#/book" }} />
      </div>
    </SiteChrome>
  );
}
