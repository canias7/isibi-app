import { createFileRoute } from "@tanstack/react-router";

import { SiteChrome } from "@/components/ui/site-chrome";
import { SectionHeader } from "@/components/ui/section-header";
import { Gallery } from "@/components/ui/gallery";
import { CtaBand } from "@/components/ui/cta-band";

export const Route = createFileRoute("/work")({ component: Work });

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A calm room, a steady practice.",
  links: [
    { label: "Home", href: "/" },
    { label: "The work", href: "/work" },
    { label: "Book", href: "/book" },
  ],
  action: { label: "Book now", href: "/book" },
};

function Work() {
  return (
    <SiteChrome {...CHROME}>
      <section className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeader
          eyebrow="The studio"
          title="The room, and the practice in it"
          description="A look at the space, the classes and the quiet moments in between."
        />
        <Gallery
          className="mt-8"
          columns={3}
          items={[
            { src: null, alt: "Morning light across the mats", caption: "Morning Flow, first light" },
            { src: null, alt: "Blankets and bolsters set for restorative class", caption: "Restorative, set for a Sunday" },
            { src: null, alt: "Candles lit along the studio wall", caption: "Candlelit Yin, dusk" },
            { src: null, alt: "A row of mats before class begins", caption: "Before Hatha Foundations" },
            { src: null, alt: "The studio floor, empty and quiet", caption: "Between classes" },
            { src: null, alt: "Hands in prayer position at the front of the room", caption: "Power Vinyasa, closing" },
          ]}
        />
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <CtaBand
          title="Come and try a class"
          description="Every level is welcome — book whichever class suits your evening."
          action={{ label: "Book now", href: "/book" }}
        />
      </section>
    </SiteChrome>
  );
}
