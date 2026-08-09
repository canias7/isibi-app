import { createFileRoute } from "@tanstack/react-router";

import { SiteChrome } from "@/components/ui/site-chrome";
import { Gallery } from "@/components/ui/gallery";
import { SectionHeader } from "@/components/ui/section-header";
import { CtaBand } from "@/components/ui/cta-band";

export const Route = createFileRoute("/work")({ component: Work });

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A quiet studio, six mats to a class.",
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
      <section className="mx-auto max-w-5xl px-6 py-16">
        <SectionHeader
          eyebrow="The studio"
          title="A look inside"
          description="Mornings, evenings, and the room itself — a sense of what a class here actually feels like."
        />
        <Gallery
          className="mt-8"
          columns={3}
          items={[
            { src: "@@IMG:sunlit yoga studio room with mats laid out in rows before a class@@", alt: "The studio before a morning class" },
            { src: "@@IMG:a small group in a restorative yoga pose using bolsters and blankets@@", alt: "A restorative class, mid-pose" },
            { src: "@@IMG:a yoga teacher adjusting a student's pose in a small studio class@@", alt: "A teacher giving a hands-on adjustment" },
            { src: "@@IMG:evening vinyasa yoga class with warm lighting, six mats", alt: "An evening Vinyasa class" },
            { src: null, alt: "", fallbackSeed: "studio-props" },
            { src: null, alt: "", fallbackSeed: "studio-entrance" },
          ]}
        />
      </section>
      <section className="mx-auto max-w-5xl px-6 pb-20">
        <CtaBand title="Come see it for yourself" description="Book a mat and try a class — no membership needed to start." action={{ label: "Book now", href: "#/book" }} />
      </section>
    </SiteChrome>
  );
}
