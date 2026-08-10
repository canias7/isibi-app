import { createFileRoute } from "@tanstack/react-router";

import { SiteChrome } from "@/components/ui/site-chrome";
import { Gallery } from "@/components/ui/gallery";
import { SectionHeader } from "@/components/ui/section-header";
import { CtaBand } from "@/components/ui/cta-band";

export const Route = createFileRoute("/work")({ component: Work });

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A calm, well-lit studio — every class ends on time.",
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
      <div className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeader
          eyebrow="The work"
          title="Inside the studio"
          description="A look at the space, the classes and the corner you'll find your mat in."
        />
        <Gallery
          className="mt-8 motion-reveal"
          columns={3}
          items={[
            { src: null, alt: "", caption: "Sunrise Vinyasa, first light through the front windows", fallbackSeed: "work-1" },
            { src: null, alt: "", caption: "Blocks and bolsters, set out before a restorative class", fallbackSeed: "work-2" },
            { src: null, alt: "", caption: "The main room, eighteen mats laid out", fallbackSeed: "work-3" },
            { src: null, alt: "", caption: "Evening Wind-down, lights low", fallbackSeed: "work-4" },
            { src: null, alt: "", caption: "The studio entrance on Middle Street", fallbackSeed: "work-5" },
            { src: null, alt: "", caption: "Tea and quiet after a Saturday class", fallbackSeed: "work-6" },
          ]}
        />
      </div>
      <div className="mx-auto max-w-6xl px-6 pb-20">
        <CtaBand
          title="See it for yourself"
          description="Book a class and try the space firsthand."
          action={{ label: "Book now", href: "/book" }}
        />
      </div>
    </SiteChrome>
  );
}
