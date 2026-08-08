import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Gallery } from "@/components/ui/gallery";
import { SectionHeader } from "@/components/ui/section-header";
import { CtaBand } from "@/components/ui/cta-band";

export const Route = createFileRoute("/work")({ component: Work });

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A quiet studio for a steady practice.",
  links: [
    { label: "Home", href: "/" },
    { label: "The work", href: "/work" },
    { label: "Book", href: "/book" },
    { label: "Account", href: "/account" },
  ],
  action: { label: "Book now", href: "/book" },
};

function Work() {
  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeader eyebrow="The studio" title="A look inside Aurora" description="The room, the mats, the light — what a class here actually feels like." />
        <Gallery
          className="mt-8"
          columns={3}
          items={[
            { src: null, alt: "", fallbackSeed: "w1", caption: "Morning Flow, first light through the blinds" },
            { src: null, alt: "", fallbackSeed: "w2", caption: "Blocks and blankets set out for Restorative" },
            { src: null, alt: "", fallbackSeed: "w3", caption: "The wall of props, always tidy by nine" },
            { src: null, alt: "", fallbackSeed: "w4", caption: "Evening Wind Down, candles lit" },
            { src: null, alt: "", fallbackSeed: "w5", caption: "The studio empty before opening" },
            { src: null, alt: "", fallbackSeed: "w6", caption: "Saturday's Beginners' class" },
          ]}
        />
      </div>
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <CtaBand title="Come see it for yourself" description="Book your first class in under a minute." action={{ label: "Book now", href: "/book" }} />
      </section>
    </SiteChrome>
  );
}
