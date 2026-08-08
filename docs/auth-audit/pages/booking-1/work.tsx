import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { SectionHeader } from "@/components/ui/section-header";
import { Gallery } from "@/components/ui/gallery";
import { CtaBand } from "@/components/ui/cta-band";

export const Route = createFileRoute("/work")({ component: Work });

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A quiet studio for a steady practice.",
  links: [
    { label: "Home", href: "#/" },
    { label: "The studio", href: "#/work" },
    { label: "Book", href: "#/book" },
    { label: "Account", href: "#/account" },
  ],
  action: { label: "Book now", href: "#/book" },
};

function Work() {
  return (
    <SiteChrome {...CHROME}>
      <section className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeader
          eyebrow="The studio"
          title="A look inside"
          description="The rooms, the classes and the quiet corners that make Aurora what it is."
        />
        <Gallery
          className="mt-8"
          columns={3}
          items={[
            { src: "@@IMG:a bright yoga studio room with rows of mats and large windows@@", alt: "", caption: "The main room, morning light" },
            { src: "@@IMG:a small group yoga class mid pose, seen from the back of the room@@", alt: "", caption: "Sunrise Flow, in progress" },
            { src: "@@IMG:a restorative yoga setup with bolsters and blankets on a mat@@", alt: "", caption: "Set up for Restorative" },
            { src: "@@IMG:a teacher adjusting a students pose during a yoga class@@", alt: "", caption: "A hands-on correction" },
            { src: "@@IMG:a quiet studio reception area with plants and a wooden bench@@", alt: "", caption: "The front desk" },
            { src: "@@IMG:a close up of a yoga mat and props neatly arranged before class@@", alt: "", caption: "Ready for the next class" },
          ]}
        />
      </section>
      <section className="border-t border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <CtaBand
            title="Come and see it for yourself"
            description="Book a class and try the room before you commit to a pass."
            action={{ label: "Book now", href: "#/book" }}
          />
        </div>
      </section>
    </SiteChrome>
  );
}
