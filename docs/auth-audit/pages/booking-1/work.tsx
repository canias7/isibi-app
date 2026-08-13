import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Gallery } from "@/components/ui/gallery";
import { SectionHeader } from "@/components/ui/section-header";
import { CtaBand } from "@/components/ui/cta-band";

export const Route = createFileRoute("/work")({ component: Work });

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A calm, well-lit studio — five classes a day, every level welcome.",
  links: [
    { label: "Home", href: "/" },
    { label: "Book", href: "/book" },
    { label: "Account", href: "/account" },
  ],
  action: { label: "Book now", href: "/book" },
};

function Work() {
  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeader eyebrow="The studio" title="A look inside" description="The room, the mats, and a class or two mid-flow." align="left" />
        <Gallery
          className="mt-8"
          columns={3}
          items={[
            { src: null, alt: "", caption: "The main studio floor, morning light", fallbackSeed: "floor" },
            { src: null, alt: "", caption: "Mats and blocks stacked by the window", fallbackSeed: "mats" },
            { src: null, alt: "", caption: "A Vinyasa class mid-flow", fallbackSeed: "vinyasa" },
            { src: null, alt: "", caption: "Candlelit Yin on a Friday evening", fallbackSeed: "yin" },
            { src: null, alt: "", caption: "The reception and tea corner", fallbackSeed: "reception" },
            { src: null, alt: "", caption: "Restorative class, blankets out", fallbackSeed: "restorative" },
          ]}
        />
      </div>
      <div className="mx-auto max-w-6xl px-6 pb-20">
        <CtaBand title="Come and see it for yourself" description="Book a class — mats and blocks are provided." action={{ label: "Book now", href: "/book" }} />
      </div>
    </SiteChrome>
  );
}
