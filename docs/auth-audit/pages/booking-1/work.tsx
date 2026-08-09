import { createFileRoute } from "@tanstack/react-router";

import { SiteChrome } from "@/components/ui/site-chrome";
import { Gallery } from "@/components/ui/gallery";
import { SectionHeader } from "@/components/ui/section-header";
import { CtaBand } from "@/components/ui/cta-band";

export const Route = createFileRoute("/work")({ component: Work });

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A quiet studio for a proper practice.",
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
          title="The space itself"
          description="A look at the studio, the classes in session, and the quiet corners in between."
        />
        <Gallery
          className="mt-8"
          columns={3}
          items={[
            { src: null, alt: "Morning light across the studio floor", fallbackSeed: "work-1" } as any,
            { alt: "A Slow & Steady class mid-pose" },
            { alt: "Mats and blocks stacked for the evening class" },
            { alt: "Restorative class, low light" },
            { alt: "The reception and tea corner" },
            { alt: "Props wall, blankets and bolsters" },
          ]}
        />
      </div>
      <div className="mx-auto max-w-6xl px-6 pb-20">
        <CtaBand
          title="Come and see it for yourself"
          description="Book a class and try the room before you commit to anything."
          action={{ label: "Book now", href: "/book" }}
        />
      </div>
    </SiteChrome>
  );
}
