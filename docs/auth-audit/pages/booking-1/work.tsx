import { createFileRoute, Link } from "@tanstack/react-router";
import { Gallery } from "@/components/ui/gallery";
import { CtaBand } from "@/components/ui/cta-band";
import { SectionHeader } from "@/components/ui/section-header";
import { SiteChrome } from "@/components/ui/site-chrome";

export const Route = createFileRoute("/work")({ component: Work });

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A calm room, a steady practice.",
  links: [
    { label: "Home", href: "/" },
    { label: "Book", href: "/book" },
    { label: "Account", href: "/account" },
  ],
  action: { label: "Book now", href: "/book" },
};

function Work() {
  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeader eyebrow="The studio" title="A look inside" description="The room, the mats, and a class or two mid-flow." />
        <Gallery
          className="mt-8 motion-reveal"
          columns={3}
          items={[
            { src: null, alt: "", caption: "Morning light in the main studio", fallbackSeed: "aurora-1" },
            { src: null, alt: "", caption: "Sunrise Flow, mid-pose", fallbackSeed: "aurora-2" },
            { src: null, alt: "", caption: "Bolsters and blankets set up for Yin", fallbackSeed: "aurora-3" },
            { src: null, alt: "", caption: "The studio, empty before the evening class", fallbackSeed: "aurora-4" },
            { src: null, alt: "", caption: "Hatha Foundations, working on alignment", fallbackSeed: "aurora-5" },
            { src: null, alt: "", caption: "The mat wall, ready for Saturday", fallbackSeed: "aurora-6" },
          ]}
        />
        <div className="mt-16">
          <CtaBand title="Come see it for yourself" description="First class is £7 — book any slot on the timetable." action={{ label: "Book now", href: "/book" }} />
        </div>
        <Link to="/" className="mt-8 inline-block text-sm font-medium underline underline-offset-4">
          ← Back to the studio
        </Link>
      </div>
    </SiteChrome>
  );
}
