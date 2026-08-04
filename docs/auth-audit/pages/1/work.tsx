import { createFileRoute } from "@tanstack/react-router";

import { Gallery } from "@/components/ui/gallery";
import { SectionHeader } from "@/components/ui/section-header";
import { SiteChrome } from "@/components/ui/site-chrome";
import { CtaBand } from "@/components/ui/cta-band";

export const Route = createFileRoute("/work")({ component: Work });

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A quiet studio, a steady practice.",
  links: [
    { label: "Home", href: "#/" },
    { label: "Book", href: "#/book" },
    { label: "The work", href: "#/work" },
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
          title="Inside Aurora"
          description="The space itself — the room, the props wall, and the quiet corner where people arrive early."
        />
        <Gallery
          className="mt-8"
          columns={3}
          items={[
            { src: null, alt: "The main room, mats laid out before sunrise class" },
            { src: null, alt: "Bolsters and blankets stacked for restorative class" },
            { src: null, alt: "Morning light across the studio floor" },
            { src: null, alt: "The props wall — blocks, straps, blankets" },
            { src: null, alt: "A Saturday beginners' class in the foundations pose" },
            { src: null, alt: "The entrance and reception nook" },
          ]}
        />
      </div>
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <CtaBand
          title="Come see it for yourself"
          description="Book a class and try the room before you commit to a course."
          action={{ label: "Book now", href: "#/book" }}
        />
      </section>
    </SiteChrome>
  );
}
