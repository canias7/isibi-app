import { createFileRoute } from "@tanstack/react-router";

import { Gallery } from "@/components/ui/gallery";
import { SectionHeader } from "@/components/ui/section-header";
import { SiteChrome } from "@/components/ui/site-chrome";
import { CtaBand } from "@/components/ui/cta-band";

export const Route = createFileRoute("/work")({ component: Work });

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A calm room, a good floor, six classes a week.",
  links: [
    { label: "Home", href: "#/" },
    { label: "Timetable", href: "#/#timetable" },
    { label: "The studio", href: "#/work" },
  ],
  action: { label: "Book now", href: "#/book" },
};

function Work() {
  return (
    <SiteChrome {...CHROME}>
      <section className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeader
          eyebrow="The studio"
          title="A look inside"
          description="Our room, our floor, and the practice as it actually looks on a Tuesday evening."
        />
        <Gallery
          className="mt-8"
          columns={3}
          items={[
            { src: null, alt: "The main studio floor, empty before class" },
            { src: null, alt: "Morning light through the west windows" },
            { src: null, alt: "Props wall — blocks, straps and bolsters" },
            { src: null, alt: "Restorative class set up with bolsters" },
            { src: null, alt: "The entrance and reception desk" },
            { src: null, alt: "A full Sunday evening class" },
          ]}
        />
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <CtaBand
          title="Come see the room for yourself"
          description="Your first class is on us — book any slot on the timetable."
          action={{ label: "Book now", href: "#/book" }}
        />
      </section>
    </SiteChrome>
  );
}
