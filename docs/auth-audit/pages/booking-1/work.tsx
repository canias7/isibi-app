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
    { label: "Home", href: "/" },
    { label: "Timetable", href: "/#timetable" },
    { label: "Studio", href: "/work" },
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
          title="A look inside"
          description="The room, the mats, and the odd moment of stillness between classes."
        />
        <Gallery
          className="mt-8"
          columns={3}
          items={[
            { src: null, alt: "The main studio room, empty before class", caption: "The main room, before a Monday morning class" },
            { src: null, alt: "Rows of mats laid out ready", caption: "Mats laid out for Slow & Steady" },
            { src: null, alt: "Light coming through the studio windows", caption: "Morning light on the floor" },
            { src: null, alt: "Blankets and bolsters stacked for restorative class", caption: "Set up for Restorative" },
            { src: null, alt: "A teacher adjusting a block during class", caption: "A hands-on adjustment mid-class" },
            { src: null, alt: "The studio's small reception area", caption: "Reception — tea's always on" },
          ]}
        />
      </div>
      <div className="mx-auto max-w-6xl px-6 pb-20">
        <CtaBand
          title="Come and see it for yourself"
          description="Book a class and try the room — first-timers are always welcome."
          action={{ label: "Book now", href: "/book" }}
        />
      </div>
    </SiteChrome>
  );
}
