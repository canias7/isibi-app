import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Gallery } from "@/components/ui/gallery";
import { SectionHeader } from "@/components/ui/section-header";
import { CtaBand } from "@/components/ui/cta-band";

export const Route = createFileRoute("/work")({ component: Work });

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A calm room, a good floor, and a class most evenings.",
  links: [
    { label: "Home", href: "/" },
    { label: "Book", href: "/book" },
    { label: "Members", href: "/members" },
    { label: "Account", href: "/account" },
  ],
  action: { label: "Book now", href: "/book" },
};

function Work() {
  return (
    <SiteChrome {...CHROME}>
      <section className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeader
          eyebrow="The studio"
          title="A look inside"
          description="The room, the floor, and a class or two in progress."
        />
        <Gallery
          className="mt-8"
          columns={3}
          items={[
            { src: null, alt: "", caption: "The main studio, morning light", fallbackSeed: "studio-1" },
            { src: null, alt: "", caption: "Sunrise Flow, a Wednesday", fallbackSeed: "studio-2" },
            { src: null, alt: "", caption: "Mats rolled and ready", fallbackSeed: "studio-3" },
            { src: null, alt: "", caption: "Candlelit Yin, low light", fallbackSeed: "studio-4" },
            { src: null, alt: "", caption: "The changing room", fallbackSeed: "studio-5" },
            { src: null, alt: "", caption: "Saturday Stretch, full room", fallbackSeed: "studio-6" },
          ]}
        />
      </section>
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <CtaBand
          title="Come and see it for yourself"
          description="Book a class in thirty seconds."
          action={{ label: "Book now", href: "/book" }}
        />
      </section>
    </SiteChrome>
  );
}
