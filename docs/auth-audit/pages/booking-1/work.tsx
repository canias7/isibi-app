import { createFileRoute } from "@tanstack/react-router";

import { SiteChrome } from "@/components/ui/site-chrome";
import { Gallery } from "@/components/ui/gallery";
import { SectionHeader } from "@/components/ui/section-header";
import { CtaBand } from "@/components/ui/cta-band";

export const Route = createFileRoute("/work")({ component: Work });

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A studio in the city centre, breathing room every hour.",
  links: [
    { label: "Home", href: "/" },
    { label: "Book", href: "/book" },
    { label: "The work", href: "/work" },
  ],
  action: { label: "Book now", href: "/book" },
};

function Work() {
  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeader eyebrow="The studio" title="A look inside" description="The space, the classes, the community — a few moments from our floor." />
        <Gallery
          className="mt-8"
          columns={3}
          items={[
            { src: null, alt: "", caption: "Sunrise Vinyasa, first light through the studio windows", fallbackSeed: "work-1" },
            { src: null, alt: "", caption: "Mats laid out before an evening class", fallbackSeed: "work-2" },
            { src: null, alt: "", caption: "A Restorative & Yin class, low light and blankets", fallbackSeed: "work-3" },
            { src: null, alt: "", caption: "Props wall — blocks, straps and bolsters", fallbackSeed: "work-4" },
            { src: null, alt: "", caption: "The studio floor, empty between classes", fallbackSeed: "work-5" },
            { src: null, alt: "", caption: "A Saturday Power Vinyasa in full flow", fallbackSeed: "work-6" },
          ]}
        />
      </div>
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <CtaBand title="Come see it for yourself" description="Your first class is on us." action={{ label: "Book now", href: "/book" }} />
      </section>
    </SiteChrome>
  );
}
