import { createFileRoute } from "@tanstack/react-router";
import { CtaBand } from "@/components/ui/cta-band";
import { Gallery } from "@/components/ui/gallery";
import { SectionHeader } from "@/components/ui/section-header";
import { SiteChrome } from "@/components/ui/site-chrome";

export const Route = createFileRoute("/work")({ component: Work });

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A calm, well-lit room. Come as you are.",
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
          description="Classes, workshops and the room itself, on the days the light is good."
        />
        <Gallery
          className="mt-8"
          columns={3}
          items={[
            { src: null, alt: "", fallbackSeed: "w1", caption: "Sunrise, Morning Flow" },
            { src: null, alt: "", fallbackSeed: "w2", caption: "Hatha Foundations, first row" },
            { src: null, alt: "", fallbackSeed: "w3", caption: "Power Vinyasa, mid-flow" },
            { src: null, alt: "", fallbackSeed: "w4", caption: "Restorative, blankets out" },
            { src: null, alt: "", fallbackSeed: "w5", caption: "Candlelit Yin on a Thursday" },
            { src: null, alt: "", fallbackSeed: "w6", caption: "The studio, empty before opening" },
            { src: null, alt: "", fallbackSeed: "w7", caption: "A weekend workshop" },
            { src: null, alt: "", fallbackSeed: "w8", caption: "Props wall, freshly stacked" },
            { src: null, alt: "", fallbackSeed: "w9", caption: "Closing savasana" },
          ]}
        />
      </div>
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <CtaBand
          title="Come and see the room for yourself"
          description="Most classes have room this week — book a spot in under a minute."
          action={{ label: "Book now", href: "/book" }}
        />
      </section>
    </SiteChrome>
  );
}
