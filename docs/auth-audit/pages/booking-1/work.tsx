import { createFileRoute } from "@tanstack/react-router";

import { SiteChrome } from "@/components/ui/site-chrome";
import { CtaBand } from "@/components/ui/cta-band";
import { Gallery } from "@/components/ui/gallery";
import { SectionHeader } from "@/components/ui/section-header";

export const Route = createFileRoute("/work")({ component: Work });

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A calm room, a steady practice, every day of the week.",
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
      <section className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeader
          eyebrow="The studio"
          title="A look inside"
          description="Our room, our mats, and the practice as it actually looks — not a stock photo of it."
        />
        <Gallery
          className="mt-8"
          columns={3}
          items={[
            { src: null, alt: "The main studio, empty before the first class", caption: "The main room, before Sunrise Flow" },
            { src: null, alt: "Mats laid out for a Vinyasa class", caption: "Mats down for Tuesday's Vinyasa" },
            { src: null, alt: "Props shelf — blocks, straps and bolsters", caption: "Blocks, straps and bolsters, ready" },
            { src: null, alt: "A Restorative class mid-pose", caption: "Restorative, held long and low-lit" },
            { src: null, alt: "Morning light through the studio windows", caption: "First light on a Monday morning" },
            { src: null, alt: "The reception and changing area", caption: "Reception and changing, just inside the door" },
          ]}
        />
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <CtaBand
          title="Come and see the room for yourself"
          description="Book a class — your first one is on us if it's your first time here."
          action={{ label: "Book now", href: "#/book" }}
        />
      </section>
    </SiteChrome>
  );
}
