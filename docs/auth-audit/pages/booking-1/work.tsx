import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Gallery } from "@/components/ui/gallery";
import { SectionHeader } from "@/components/ui/section-header";
import { CtaBand } from "@/components/ui/cta-band";

export const Route = createFileRoute("/work")({ component: Work });

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A calm room, a good floor, teachers who remember your name.",
  links: [
    { label: "Home", href: "/" },
    { label: "Classes", href: "/#prices" },
    { label: "The work", href: "/work" },
    { label: "Account", href: "/account" },
  ],
  action: { label: "Book now", href: "/book" },
};

function Work() {
  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-6xl px-6 py-16 motion-reveal">
        <SectionHeader eyebrow="The studio" title="A look inside" description="The room, the classes and the quiet bits in between." />
        <Gallery
          className="mt-8"
          columns={3}
          items={[
            { src: null, alt: "Sun salutations, full room", caption: "Morning Flow, full room", fallbackSeed: "w1" },
            { src: null, alt: "A quiet Yin class, low light", caption: "Yin, low light", fallbackSeed: "w2" },
            { src: null, alt: "Props stacked and ready before class", caption: "Ready before the doors open", fallbackSeed: "w3" },
            { src: null, alt: "A teacher adjusting a student's stretch", caption: "A hands-on adjustment", fallbackSeed: "w4" },
            { src: null, alt: "The studio floor empty, early morning light", caption: "Empty floor, early light", fallbackSeed: "w5" },
            { src: null, alt: "Mats rolled and stacked along the wall", caption: "Mats rolled and ready", fallbackSeed: "w6" },
            { src: null, alt: "A Strong Vinyasa class mid-flow", caption: "Strong Vinyasa, mid-flow", fallbackSeed: "w7" },
            { src: null, alt: "The studio entrance from the river path", caption: "The door, from the river path", fallbackSeed: "w8" },
            { src: null, alt: "A Beginners class, guided one to one", caption: "Beginners, guided closely", fallbackSeed: "w9" },
          ]}
        />
      </div>
      <div className="mx-auto max-w-6xl px-6 pb-20">
        <CtaBand title="Want to feel like this on a Tuesday?" description="Book a class in thirty seconds." action={{ label: "Book now", href: "/book" }} />
      </div>
    </SiteChrome>
  );
}
