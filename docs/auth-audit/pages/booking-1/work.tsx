import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Gallery } from "@/components/ui/gallery";
import { SectionHeader } from "@/components/ui/section-header";
import { CtaBand } from "@/components/ui/cta-band";

export const Route = createFileRoute("/work")({ component: Work });

const CHROME = {
  name: "Aurora Yoga",
  tagline: "Slow mornings, strong afternoons — a studio for every kind of practice.",
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
      <div className="mx-auto max-w-6xl px-6 py-16 motion-reveal">
        <SectionHeader
          eyebrow="The studio"
          title="Inside Aurora"
          description="The room, the mats, and the mornings that make this place what it is."
        />
        <Gallery
          className="mt-8"
          columns={3}
          items={[
            { alt: "Sunrise light across the studio floor", caption: "Sunrise Flow, Monday morning" },
            { alt: "Rows of mats set for a full class", caption: "A full Strong Vinyasa" },
            { alt: "Bolsters and blankets stacked for Restorative", caption: "Set for Restorative" },
            { alt: "Candles lit along the studio wall", caption: "Candlelit Yin, Thursday" },
            { alt: "A teacher adjusting a student's pose", caption: "Hands-on adjustment in Foundations" },
            { alt: "The studio entrance from the street", caption: "The blue door on Bellhouse Lane" },
          ]}
        />
      </div>
      <div className="mx-auto max-w-6xl px-6 pb-20">
        <CtaBand
          title="Come see it for yourself"
          description="Your first class is on us — book any slot to try the room."
          action={{ label: "Book now", href: "/book" }}
        />
      </div>
    </SiteChrome>
  );
}
