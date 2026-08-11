import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { SectionHeader } from "@/components/ui/section-header";
import { Gallery } from "@/components/ui/gallery";
import { CtaBand } from "@/components/ui/cta-band";

export const Route = createFileRoute("/work")({ component: Work });

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A calm, well-lit studio for every kind of practice.",
  links: [
    { label: "Home", href: "/" },
    { label: "Book", href: "/book" },
    { label: "The studio", href: "/work" },
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
          title="A look inside Aurora Yoga"
          description="Our space, our classes, and the community that shows up for them."
        />
        <Gallery
          className="mt-10 motion-reveal"
          columns={3}
          items={[
            { src: "@@IMG:a bright studio room with wooden floors and large windows, empty before class@@", alt: "The main room before class", fallbackSeed: "w1" },
            { src: "@@IMG:a full class in downward dog pose seen from the back of the room@@", alt: "A full class in downward dog", fallbackSeed: "w2" },
            { src: "@@IMG:a teacher adjusting a student's shoulder alignment during a pose@@", alt: "A teacher offering an adjustment", fallbackSeed: "w3" },
            { src: "@@IMG:a shelf of neatly folded blankets and cork blocks@@", alt: "Props ready to use", fallbackSeed: "w4" },
            { src: "@@IMG:candles and cushions arranged for an evening restorative class@@", alt: "Set up for an evening restorative class", fallbackSeed: "w5" },
            { src: "@@IMG:students chatting and rolling up mats after a class ends@@", alt: "After class", fallbackSeed: "w6" },
            { src: "@@IMG:a single yoga mat and water bottle in a patch of morning sun@@", alt: "Morning light on a mat", fallbackSeed: "w7" },
            { src: "@@IMG:a small group practising a balancing pose together, smiling@@", alt: "A balancing pose, mid-laugh", fallbackSeed: "w8" },
            { src: "@@IMG:the studio entrance with a wooden sign and plants either side@@", alt: "The studio entrance", fallbackSeed: "w9" },
          ]}
        />
      </div>
      <div className="mx-auto max-w-6xl px-6 pb-20">
        <CtaBand
          title="Come and see it for yourself"
          description="Your first class is on us — book any slot this week."
          action={{ label: "Book now", href: "/book" }}
        />
      </div>
    </SiteChrome>
  );
}
