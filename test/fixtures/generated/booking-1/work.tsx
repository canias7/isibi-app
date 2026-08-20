import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Gallery } from "@/components/ui/gallery";
import { CtaBand } from "@/components/ui/cta-band";

export const Route = createFileRoute("/work")({ component: Work });

function Work() {
  return (
    <SiteChrome
      name="Aurora Yoga"
      tagline="A calm, well-lit studio a short walk from the station."
      links={[
        { label: "Home", href: "/" },
        { label: "Book", href: "/book" },
        { label: "The work", href: "/work" },
        { label: "Account", href: "/account" },
      ]}
      action={{ label: "Check availability", href: "/book" }}
    >
      <div className="mx-auto max-w-6xl px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">The studio</h1>
        <p className="mt-2 max-w-xl text-muted-foreground">
          A look at the space, the classes and the people who show up week after
          week.
        </p>
        <Gallery
          className="mt-8 motion-reveal"
          columns={3}
          items={[
            { alt: "Sunrise Vinyasa, full room", caption: "Sunrise Vinyasa, a full room" },
            { alt: "Yin class with bolsters and blankets", caption: "Yin, bolsters and blankets" },
            { alt: "A teacher adjusting a pose", caption: "A hands-on adjustment" },
            { alt: "The studio floor, empty in morning light", caption: "The floor before anyone arrives" },
            { alt: "Power Flow, mid-sequence", caption: "Power Flow, mid-sequence" },
            { alt: "Beginners' Foundations, first class", caption: "A first class in Foundations" },
            { alt: "Blocks and straps stacked by the wall", caption: "Props, always within reach" },
            { alt: "The studio at dusk, lights on", caption: "The studio at dusk" },
            { alt: "A quiet savasana at the end of class", caption: "Savasana, the end of class" },
          ]}
        />
        <div className="mt-16">
          <CtaBand
            title="Come see it for yourself"
            description="A mat is usually free tonight — book in under a minute."
            action={{ label: "Check availability", href: "/book" }}
          />
        </div>
      </div>
    </SiteChrome>
  );
}
