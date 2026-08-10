import { createFileRoute, Link } from "@tanstack/react-router";

import { CtaBand } from "@/components/ui/cta-band";
import { Gallery } from "@/components/ui/gallery";
import { SectionHeader } from "@/components/ui/section-header";
import { SiteChrome } from "@/components/ui/site-chrome";

export const Route = createFileRoute("/work")({ component: Work });

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A calm room, a good mat, classes most days.",
  links: [
    { label: "Home", href: "/" },
    { label: "Book", href: "/book" },
    { label: "The work", href: "/work" },
    { label: "Members", href: "/members" },
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
          description="The room, the mats, and a few moments from class — so you know what you're walking into."
        />
        <Gallery
          className="mt-8"
          columns={3}
          items={[
            { src: null, alt: "", caption: "The main room, before a Vinyasa Flow class", fallbackSeed: "work-1" },
            { src: null, alt: "", caption: "Mats and blocks set out for Restorative", fallbackSeed: "work-2" },
            { src: null, alt: "", caption: "Morning light through the studio windows", fallbackSeed: "work-3" },
            { src: null, alt: "", caption: "Candles lit for Yin & Sound on a Thursday", fallbackSeed: "work-4" },
            { src: null, alt: "", caption: "The props wall — bolsters, blocks, straps", fallbackSeed: "work-5" },
            { src: null, alt: "", caption: "The studio entrance on Riverside Walk", fallbackSeed: "work-6" },
          ]}
        />
      </div>
      <div className="mx-auto max-w-6xl px-6 pb-20">
        <CtaBand
          title="Come see it for yourself"
          description="Your first class is free — book any slot on the timetable."
          action={{ label: "Book now", href: "/book" }}
        />
      </div>
    </SiteChrome>
  );
}
