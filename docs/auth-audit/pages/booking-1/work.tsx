import { createFileRoute } from "@tanstack/react-router";

import { SiteChrome } from "@/components/ui/site-chrome";
import { Gallery } from "@/components/ui/gallery";
import { SectionHeader } from "@/components/ui/section-header";
import { CtaBand } from "@/components/ui/cta-band";

export const Route = createFileRoute("/work")({ component: Work });

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A calm room off the high street — mats provided.",
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
        <SectionHeader
          eyebrow="The studio"
          title="The room itself"
          description="Underfloor heating, big windows, and a wall of mirrors we mostly leave uncovered."
        />
        <Gallery
          className="mt-8"
          columns={3}
          items={[
            { src: null, alt: "", caption: "The main studio, mid-class", fallbackSeed: "studio-a" },
            { src: null, alt: "", caption: "Morning light on the floor", fallbackSeed: "studio-b" },
            { src: null, alt: "", caption: "Props wall — blocks, straps, bolsters", fallbackSeed: "studio-c" },
            { src: null, alt: "", caption: "The changing room", fallbackSeed: "studio-d" },
            { src: null, alt: "", caption: "A restorative class, blankets out", fallbackSeed: "studio-e" },
            { src: null, alt: "", caption: "The entrance, up the side stairs", fallbackSeed: "studio-f" },
          ]}
        />
      </section>
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <CtaBand
          title="Come see it for yourself"
          description="Your first class is on us if you've never been."
          action={{ label: "Book now", href: "/book" }}
        />
      </section>
    </SiteChrome>
  );
}
