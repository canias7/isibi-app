import { createFileRoute } from "@tanstack/react-router";

import { Gallery } from "@/components/ui/gallery";
import { SectionHeader } from "@/components/ui/section-header";
import { SiteChrome } from "@/components/ui/site-chrome";
import { CtaBand } from "@/components/ui/cta-band";

export const Route = createFileRoute("/work")({ component: Work });

const CHROME = {
  name: "Aurora Yoga",
  tagline: "Slow mornings, steady evenings — a mat and a class most days.",
  links: [
    { label: "Home", href: "#/" },
    { label: "Book", href: "#/book" },
    { label: "Account", href: "#/account" },
  ],
  action: { label: "Book now", href: "#/book" },
};

function Work() {
  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeader
          eyebrow="The studio"
          title="A look inside"
          description="Our main room, the smaller studio upstairs, and a few moments from class."
        />
        <Gallery
          className="mt-8"
          columns={3}
          items={[
            { src: null, alt: "The main studio at sunrise, mats laid out" },
            { src: null, alt: "A Restorative & Yin class, bolsters and blankets" },
            { src: null, alt: "The smaller upstairs studio, candlelit for evening class" },
            { src: null, alt: "Power Vinyasa mid-flow" },
            { src: null, alt: "The reception and tea corner" },
            { src: null, alt: "Blocks and straps, ready for a Hatha class" },
          ]}
        />
      </div>
      <div className="mx-auto max-w-6xl px-6 pb-20">
        <CtaBand
          title="Come see it for yourself"
          description="Book your first class and we'll show you round before it starts."
          action={{ label: "Book now", href: "#/book" }}
        />
      </div>
    </SiteChrome>
  );
}
