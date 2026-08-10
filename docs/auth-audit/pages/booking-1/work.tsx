import { createFileRoute } from "@tanstack/react-router";

import { SiteChrome } from "@/components/ui/site-chrome";
import { Gallery } from "@/components/ui/gallery";
import { SectionHeader } from "@/components/ui/section-header";
import { CtaBand } from "@/components/ui/cta-band";

export const Route = createFileRoute("/work")({ component: Work });

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A calm, well-taught practice — every level, every day.",
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
          eyebrow="The studio"
          title="A look inside"
          description="The room, the mats, and the mornings that make Aurora what it is."
        />
        <Gallery
          className="mt-8"
          columns={3}
          items={[
            { src: null, alt: "", caption: "Sunrise Vinyasa, full room", fallbackSeed: "work-1" },
            { src: null, alt: "", caption: "Yin, candles lit for the last hold", fallbackSeed: "work-2" },
            { src: null, alt: "", caption: "The studio floor, empty before opening", fallbackSeed: "work-3" },
            { src: null, alt: "", caption: "Blocks and blankets, set for restorative", fallbackSeed: "work-4" },
            { src: null, alt: "", caption: "Power Yoga, midweek", fallbackSeed: "work-5" },
            { src: null, alt: "", caption: "Hatha Fundamentals, a first class", fallbackSeed: "work-6" },
          ]}
        />
      </div>
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <CtaBand
          title="Come and see the room for yourself"
          description="Book a class — most weeks have a mat free within a day or two."
          action={{ label: "Book now", href: "/book" }}
        />
      </section>
    </SiteChrome>
  );
}
