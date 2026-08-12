import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Gallery } from "@/components/ui/gallery";
import { SectionHeader } from "@/components/ui/section-header";
import { CtaBand } from "@/components/ui/cta-band";

export const Route = createFileRoute("/work")({ component: Work });

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A quiet studio, a full timetable.",
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
        <SectionHeader eyebrow="The studio" title="A look inside" description="The room, the classes, the people who show up week after week." />
        <Gallery
          className="mt-8"
          columns={3}
          items={[
            { src: "@@IMG:a bright yoga studio room, empty mats laid out in rows@@", alt: "The main studio room", caption: "The main room, before a Monday evening class" },
            { src: "@@IMG:a teacher assisting a student in a seated stretch@@", alt: "A teacher assisting a student", caption: "Hands-on adjustment in Hatha Foundations" },
            { src: "@@IMG:a small group in a restorative pose with bolsters and blankets@@", alt: "Restorative class with bolsters", caption: "Restorative, mid-pose" },
            { src: "@@IMG:a shelf of neatly folded yoga blankets and blocks@@", alt: "Shelf of folded blankets and blocks", caption: "Props, ready to go" },
            { src: "@@IMG:a sunrise vinyasa class silhouetted against a window@@", alt: "Early morning vinyasa class", caption: "Sunrise Vinyasa Flow" },
            { src: "@@IMG:a close-up of bare feet on a yoga mat in mountain pose@@", alt: "Feet on a mat in mountain pose", caption: "Where every class starts" },
          ]}
        />
      </div>
      <div className="mx-auto max-w-6xl px-6 pb-20">
        <CtaBand title="Come and see the room for yourself" description="Book your first class in thirty seconds." action={{ label: "Book now", href: "/book" }} />
      </div>
    </SiteChrome>
  );
}
