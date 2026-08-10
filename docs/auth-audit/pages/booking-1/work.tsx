import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Gallery } from "@/components/ui/gallery";
import { SectionHeader } from "@/components/ui/section-header";
import { CtaBand } from "@/components/ui/cta-band";

export const Route = createFileRoute("/work")({ component: Work });

const CHROME = {
  name: "Aurora Yoga",
  tagline: "A calm studio room, six classes a day.",
  links: [
    { label: "Home", href: "/" },
    { label: "Book", href: "/book" },
    { label: "The work", href: "/work" },
    { label: "Account", href: "/account" },
  ],
  action: { label: "Check availability", href: "/book" },
};

function Work() {
  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeader eyebrow="The studio" title="The room, the classes, the people in them" description="A look at what a session here actually feels like." />
        <Gallery
          className="mt-8"
          columns={3}
          items={[
            { src: "@@IMG:a full yoga class mid-pose in warm studio light@@", alt: "", caption: "Morning Flow, a full room" },
            { src: "@@IMG:a close-up of hands in a supported stretch, blocks nearby@@", alt: "", caption: "Yin & Restore — props for every shape" },
            { src: "@@IMG:a teacher adjusting a student's alignment in a standing pose@@", alt: "", caption: "A hands-on correction, Foundations" },
            { src: "@@IMG:a pregnant woman in a gentle seated yoga pose@@", alt: "", caption: "Prenatal, modified and unhurried" },
            { src: "@@IMG:rows of neatly stacked yoga mats and bolsters against a wall@@", alt: "", caption: "Set up before the evening class" },
            { src: "@@IMG:a sunlit empty studio floor early in the morning@@", alt: "", caption: "Before the first class of the day" },
          ]}
        />
      </div>
      <div className="mx-auto max-w-6xl px-6 pb-20">
        <CtaBand title="See it for yourself" description="Your first class is on us — check availability and come try the room." action={{ label: "Check availability", href: "/book" }} />
      </div>
    </SiteChrome>
  );
}
