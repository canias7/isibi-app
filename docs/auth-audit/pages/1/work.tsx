import { createFileRoute } from "@tanstack/react-router";

import { CtaBand } from "@/components/ui/cta-band";
import { Gallery } from "@/components/ui/gallery";
import { SectionHeader } from "@/components/ui/section-header";
import { SiteChrome } from "@/components/ui/site-chrome";

export const Route = createFileRoute("/work")({ component: Work });

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A quiet studio for a steady practice.",
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
      <section className="mx-auto max-w-5xl px-6 py-16">
        <SectionHeader
          eyebrow="The studio"
          title="A look inside"
          description="The room, the mats, and the light we practise in — so you know what to expect before you turn up."
        />
        <Gallery
          className="mt-8"
          columns={3}
          items={[
            { src: null, alt: "Morning light across the main studio floor" },
            { src: null, alt: "The wall of mats and blocks, ready to borrow" },
            { src: null, alt: "A Sunrise Flow class mid-sequence" },
            { src: null, alt: "Restorative class, blankets and bolsters out" },
            { src: null, alt: "The reception nook and tea corner" },
            { src: null, alt: "Evening candlelight for the last class of the day" },
          ]}
        />
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-20">
        <CtaBand
          title="Come see it for yourself"
          description="Book your first class — most people stay for tea afterwards."
          action={{ label: "Book now", href: "#/book" }}
        />
      </section>
    </SiteChrome>
  );
}
