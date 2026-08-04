import { createFileRoute } from "@tanstack/react-router";

import { Gallery } from "@/components/ui/gallery";
import { CtaBand } from "@/components/ui/cta-band";
import { SectionHeader } from "@/components/ui/section-header";
import { SiteChrome } from "@/components/ui/site-chrome";

export const Route = createFileRoute("/work")({ component: Work });

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A quiet room, a good floor, classes that start on time.",
  links: [
    { label: "Home", href: "#/" },
    { label: "Book", href: "#/book" },
    { label: "The work", href: "#/work" },
    { label: "Account", href: "#/account" },
  ],
  action: { label: "Book now", href: "#/book" },
};

function Work() {
  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-5xl px-6 py-16">
        <SectionHeader
          eyebrow="The studio"
          title="Inside Aurora Yoga"
          description="The room, the mats, the mornings — a look at where the classes happen."
        />
        <Gallery
          className="mt-8"
          columns={3}
          items={[
            { src: null, alt: "The main studio floor at sunrise" },
            { src: null, alt: "Mats and blocks stacked before Morning Flow" },
            { src: null, alt: "Restorative class, props laid out" },
            { src: null, alt: "The window wall during Slow & Strong" },
            { src: null, alt: "A quiet moment before the Beginners' Course" },
            { src: null, alt: "The studio at dusk, empty and still" },
          ]}
        />
      </div>
      <div className="mx-auto max-w-5xl px-6 pb-20">
        <CtaBand
          title="Come see the room for yourself"
          description="Book a class and try the space firsthand."
          action={{ label: "Book now", href: "#/book" }}
        />
      </div>
    </SiteChrome>
  );
}
