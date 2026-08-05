import { createFileRoute } from "@tanstack/react-router";

import { SiteChrome } from "@/components/ui/site-chrome";
import { Gallery } from "@/components/ui/gallery";
import { SectionHeader } from "@/components/ui/section-header";
import { CtaBand } from "@/components/ui/cta-band";

export const Route = createFileRoute("/work")({ component: Work });

const CHROME = {
  name: "Aurora Yoga",
  tagline: "Slow mornings, strong evenings — a studio on the high street.",
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
          description="The rooms, the mats, the mornings — a sense of what a class here feels like."
        />
        <Gallery
          className="mt-8"
          columns={3}
          items={[
            { src: null, alt: "Sunrise light across the main room", caption: "The main room, first light" },
            { src: null, alt: "Mats rolled and ready before Sunrise Flow", caption: "Ready for Sunrise Flow" },
            { src: null, alt: "Blocks and blankets stacked for Restorative & Yin", caption: "Set for Restorative & Yin" },
            { src: null, alt: "A quiet corner with tea after class", caption: "Tea after class" },
            { src: null, alt: "The studio's small library of mats and props", caption: "Spare mats and props" },
            { src: null, alt: "Evening class winding down", caption: "Evening Wind-Down, half-lit" },
          ]}
        />
      </section>

      <section className="border-t border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <CtaBand
            title="Come and see it for yourself"
            description="Book any class this week — first-timers are always welcome."
            action={{ label: "Book now", href: "#/book" }}
          />
        </div>
      </section>
    </SiteChrome>
  );
}
