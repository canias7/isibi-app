import { createFileRoute } from "@tanstack/react-router";

import { Gallery } from "@/components/ui/gallery";
import { SectionHeader } from "@/components/ui/section-header";
import { SiteChrome } from "@/components/ui/site-chrome";
import { CtaBand } from "@/components/ui/cta-band";

export const Route = createFileRoute("/work")({ component: Work });

const CHROME = {
  name: "Aurora Yoga",
  tagline: "Slow mornings, strong practice — a studio on the high street.",
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
      <section className="mx-auto max-w-6xl px-6 py-16 motion-reveal">
        <SectionHeader
          eyebrow="The studio"
          title="A look inside"
          description="The room, the mats and the mornings — a sense of what to expect before your first class."
        />
        <Gallery
          className="mt-8"
          columns={3}
          items={[
            { src: null, alt: "Sunrise Vinyasa, first light through the windows" },
            { src: null, alt: "The studio floor, mats set for a full class" },
            { src: null, alt: "Restorative class, props laid out" },
            { src: null, alt: "Beginners' Flow, a quiet Saturday morning" },
            { src: null, alt: "The props wall — blocks, straps and bolsters" },
            { src: null, alt: "After class, tea in the front room" },
          ]}
        />
      </section>

      <section className="border-t border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <CtaBand
            title="Come see it for yourself"
            description="Your first class is on us — just tell us which one when you book."
            action={{ label: "Book now", href: "#/book" }}
          />
        </div>
      </section>
    </SiteChrome>
  );
}
