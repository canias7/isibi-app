import { createFileRoute } from "@tanstack/react-router";

import { Gallery } from "@/components/ui/gallery";
import { CtaBand } from "@/components/ui/cta-band";
import { SectionHeader } from "@/components/ui/section-header";
import { SiteChrome } from "@/components/ui/site-chrome";

export const Route = createFileRoute("/work")({ component: Work });

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A calm room, a mat, and a class that starts on time.",
  links: [
    { label: "Home", href: "#/" },
    { label: "Book", href: "#/book" },
    { label: "Members", href: "#/account" },
  ],
  action: { label: "Book now", href: "#/book" },
};

function Work() {
  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeader
          eyebrow="The studio"
          title="The room, the mats, the light"
          description="A look at where classes actually happen, so you know what you're walking into."
        />
        <Gallery
          className="mt-8"
          columns={3}
          items={[
            { src: null, alt: "The main room, morning light" },
            { src: null, alt: "Mats laid out before Vinyasa" },
            { src: null, alt: "The restorative room, low light" },
            { src: null, alt: "Props wall — blocks, straps, bolsters" },
            { src: null, alt: "The heated room, ready for class" },
            { src: null, alt: "The entrance off Riverside Walk" },
          ]}
        />
      </div>
      <div className="mx-auto max-w-6xl px-6 pb-20">
        <CtaBand
          title="Come and see it for yourself"
          description="Book a class and try the room before committing to a course."
          action={{ label: "Book now", href: "#/book" }}
        />
      </div>
    </SiteChrome>
  );
}
