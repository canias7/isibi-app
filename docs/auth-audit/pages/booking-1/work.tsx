import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Gallery } from "@/components/ui/gallery";
import { SectionHeader } from "@/components/ui/section-header";
import { CtaBand } from "@/components/ui/cta-band";

export const Route = createFileRoute("/work")({ component: Work });

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A calm room, a steady practice.",
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
      <section className="mx-auto max-w-6xl px-6 py-16 motion-reveal">
        <SectionHeader
          eyebrow="The work"
          title="Inside the studio"
          description="A look at the room, the classes and the people who show up week after week."
        />
        <Gallery
          className="mt-8"
          columns={3}
          items={[
            { src: null, alt: "Morning Slow Flow, mats laid out" },
            { src: null, alt: "Restorative class, props and blankets" },
            { src: null, alt: "Evening light across the studio floor" },
            { src: null, alt: "Ashtanga led class, full room" },
            { src: null, alt: "The studio before opening" },
            { src: null, alt: "A quiet Saturday session" },
          ]}
        />
      </section>

      <section className="border-t border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <CtaBand
            title="Come and see the room for yourself"
            description="Book a class and try the space — first class is no different in price."
            action={{ label: "Book now", href: "#/book" }}
          />
        </div>
      </section>
    </SiteChrome>
  );
}
