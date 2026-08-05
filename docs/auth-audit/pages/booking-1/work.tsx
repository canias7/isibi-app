import { createFileRoute } from "@tanstack/react-router";

import { Gallery } from "@/components/ui/gallery";
import { SectionHeader } from "@/components/ui/section-header";
import { SiteChrome } from "@/components/ui/site-chrome";
import { CtaBand } from "@/components/ui/cta-band";

export const Route = createFileRoute("/work")({ component: Work });

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A calm, well-lit studio for every kind of practice.",
  links: [
    { label: "Home", href: "#/" },
    { label: "Book", href: "#/book" },
    { label: "Work", href: "#/work" },
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
          title="A look inside"
          description="The room, the mats, and the practice itself — so you know what to expect before you arrive."
        />
        <Gallery
          className="mt-8"
          columns={3}
          items={[
            { src: null, alt: "Morning light across the main studio floor", caption: "Sunrise Vinyasa, 7am" },
            { src: null, alt: "Bolsters and blankets set out for Restorative", caption: "Restorative, set up and waiting" },
            { src: null, alt: "A full Power Yoga class mid-flow", caption: "Power Yoga, Thursday evening" },
            { src: null, alt: "The props wall — blocks, straps and bolsters", caption: "Everything provided" },
            { src: null, alt: "Beginners' Foundations, one-to-one adjustment", caption: "Beginners' Foundations" },
            { src: null, alt: "The studio entrance on Meadow Lane", caption: "18 Meadow Lane" },
          ]}
        />
      </div>
      <div className="mx-auto max-w-6xl px-6 pb-20">
        <CtaBand
          title="Come see it for yourself"
          description="Book your first class and try the room on for size."
          action={{ label: "Book now", href: "#/book" }}
        />
      </div>
    </SiteChrome>
  );
}
