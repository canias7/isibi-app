import { createFileRoute } from "@tanstack/react-router";

import { CtaBand } from "@/components/ui/cta-band";
import { Gallery } from "@/components/ui/gallery";
import { SectionHeader } from "@/components/ui/section-header";
import { SiteChrome } from "@/components/ui/site-chrome";

export const Route = createFileRoute("/work")({ component: Work });

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A calm, well-lit room for whatever your practice needs today.",
  links: [
    { label: "Home", href: "/" },
    { label: "Book", href: "/book" },
    { label: "The work", href: "/work" },
    { label: "Account", href: "/account" },
  ],
  action: { label: "Book now", href: "/book" },
};

function Work() {
  return (
    <SiteChrome {...CHROME}>
      <section className="mx-auto max-w-5xl px-6 py-16">
        <SectionHeader
          eyebrow="The studio"
          title="The room, the mats, the mornings"
          description="A look at the space and the practice — taken between classes, not staged for it."
        />
        <Gallery
          className="mt-8"
          columns={3}
          items={[
            { src: null, alt: "Sunrise Slow Flow, mats laid out" },
            { src: null, alt: "The studio, empty before the first class" },
            { src: null, alt: "Restorative class, bolsters and blankets" },
            { src: null, alt: "Vinyasa, mid-flow" },
            { src: null, alt: "Props wall — blocks, straps, bolsters" },
            { src: null, alt: "Beginners' Foundations, a quiet Tuesday" },
          ]}
        />
      </section>

      <section className="border-t border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <CtaBand
            title="Come see the room for yourself"
            description="Your first class is on us — just say so when you book."
            action={{ label: "Book now", href: "/book" }}
          />
        </div>
      </section>
    </SiteChrome>
  );
}
