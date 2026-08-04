import { createFileRoute } from "@tanstack/react-router";

import { CtaBand } from "@/components/ui/cta-band";
import { Gallery } from "@/components/ui/gallery";
import { SectionHeader } from "@/components/ui/section-header";
import { SiteChrome } from "@/components/ui/site-chrome";

export const Route = createFileRoute("/work")({ component: Work });

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A quiet studio for a steady practice.",
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
      <section className="mx-auto max-w-5xl px-6 py-16">
        <SectionHeader
          eyebrow="The studio"
          title="Inside Aurora"
          description="Two practice rooms, warm light, and a wall of mats waiting for a Tuesday morning class."
        />
        <Gallery
          className="mt-8"
          columns={3}
          items={[
            { src: null, alt: "The main room before a morning flow" },
            { src: null, alt: "Bolsters and blocks stacked for restorative class" },
            { src: null, alt: "The hot room, lit for evening power yoga" },
            { src: null, alt: "A full beginners' foundations class" },
            { src: null, alt: "The studio entrance on Bellhouse Lane" },
            { src: null, alt: "Tea and quiet after the last class of the day" },
          ]}
        />
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-20">
        <CtaBand
          title="Come see it for yourself"
          description="Check availability and book a class today."
          action={{ label: "Book now", href: "#/book" }}
        />
      </section>
    </SiteChrome>
  );
}
