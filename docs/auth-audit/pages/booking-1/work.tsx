import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { SectionHeader } from "@/components/ui/section-header";
import { Gallery } from "@/components/ui/gallery";
import { CtaBand } from "@/components/ui/cta-band";

export const Route = createFileRoute("/work")({ component: Work });

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A calm, well-lit studio for every level of practice.",
  links: [
    { label: "Home", href: "#/" },
    { label: "Book", href: "#/book" },
    { label: "Manage booking", href: "#/manage" },
    { label: "Members", href: "#/account" },
  ],
  action: { label: "Book now", href: "#/book" },
};

function Work() {
  return (
    <SiteChrome {...CHROME}>
      <section className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeader eyebrow="The studio" title="A look inside" description="Our main room, the quiet corner for restorative work, and a few moments from class." />
        <Gallery className="mt-8" columns={3} items={[
          { src: null, alt: "The main studio floor, morning light" },
          { src: null, alt: "Mats and bolsters laid out for a restorative class" },
          { src: null, alt: "Candlelit yin on a Friday evening" },
          { src: null, alt: "Beginners' Foundations, a supported pose" },
          { src: null, alt: "The changing room and cubbies" },
          { src: null, alt: "A full room for Power Hour" },
        ]} />
      </section>
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <CtaBand title="Come see it for yourself" description="Book a class and find out why our students keep coming back." action={{ label: "Book now", href: "#/book" }} />
      </section>
    </SiteChrome>
  );
}
