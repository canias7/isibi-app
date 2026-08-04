import { createFileRoute } from "@tanstack/react-router";

import { CtaBand } from "@/components/ui/cta-band";
import { Gallery } from "@/components/ui/gallery";
import { SectionHeader } from "@/components/ui/section-header";
import { SiteChrome } from "@/components/ui/site-chrome";

export const Route = createFileRoute("/work")({ component: Work });

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A calm room, a good mat, and a class that starts on time.",
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
      <section className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeader
          eyebrow="The studio"
          title="A look inside"
          description="The room, the mats, and the classes in motion — so you know what to expect before you arrive."
        />
        <Gallery
          className="mt-8"
          columns={3}
          items={[
            { src: null, alt: "The main room, empty before the first class" },
            { src: null, alt: "Morning Flow, mid-sequence" },
            { src: null, alt: "Candles set out for the Thursday Yin class" },
            { src: null, alt: "Blocks and bolsters stacked for Restorative" },
            { src: null, alt: "The window wall at golden hour" },
            { src: null, alt: "A Beginners' Foundations class, mid-pose" },
          ]}
        />
      </section>
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <CtaBand
          title="Come and see it for yourself"
          description="Your first class is free — book it in thirty seconds."
          action={{ label: "Book now", href: "#/book" }}
        />
      </section>
    </SiteChrome>
  );
}
