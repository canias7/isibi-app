import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Gallery } from "@/components/ui/gallery";
import { SectionHeader } from "@/components/ui/section-header";
import { CtaBand } from "@/components/ui/cta-band";

export const Route = createFileRoute("/work")({ component: Work });

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A calm, well-lit studio — book your mat in a minute.",
  links: [
    { label: "Home", href: "/" },
    { label: "Book", href: "/book" },
    { label: "The studio", href: "/work" },
    { label: "Account", href: "/account" },
  ],
  action: { label: "Book now", href: "/book" },
};

function Work() {
  return (
    <SiteChrome {...CHROME}>
      <section className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeader eyebrow="The studio" title="A look inside" description="The room, the mats, and a class in flow." />
        <Gallery
          className="mt-8"
          columns={3}
          items={[
            { src: "@@IMG:wide shot of a bright yoga studio room with wooden floor, rolled mats along the wall, morning light@@", alt: "The main studio room, morning light", fallbackSeed: "studio-1" },
            { src: "@@IMG:a group yoga class mid flow, students in a warrior pose, seen from the back of the room@@", alt: "A Power Vinyasa class in flow", fallbackSeed: "studio-2" },
            { src: null, alt: "Bolsters and blankets set out for a restorative class", fallbackSeed: "studio-3" },
            { src: "@@IMG:close up of neatly stacked yoga blocks and folded blankets in a studio corner@@", alt: "Props ready for class", fallbackSeed: "studio-4" },
            { src: null, alt: "Students arriving and rolling out mats before class", fallbackSeed: "studio-5" },
            { src: "@@IMG:a single yoga mat and water bottle laid out in a quiet, sunlit studio", alt: "A quiet mat before a Sunrise Flow class", fallbackSeed: "studio-6" },
          ]}
        />
      </section>
      <section className="border-t border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <CtaBand title="Ready to try a class?" description="Check today's slots and book your mat." action={{ label: "Book now", href: "/book" }} />
        </div>
      </section>
    </SiteChrome>
  );
}
