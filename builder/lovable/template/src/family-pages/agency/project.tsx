// agency /project — one commission told as a story: the brief in a
// sentence, the day in pictures, the couple's word at the end. Copy stays
// short; the sequence of images carries the narrative.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Gallery } from "@/components/ui/gallery";
import { SafeImage } from "@/components/ui/safe-image";
import { Testimonial } from "@/components/ui/testimonial";
import { CtaBand } from "@/components/ui/cta-band";
export const Route = createFileRoute("/project")({ component: P });
const CHROME = {
  name: "Hale & Frost", tagline: "Weddings photographed like they felt.",
  links: [{ label: "The work", href: "#/" }, { label: "Enquire", href: "#/contact" }],
  action: { label: "Start a project", href: "#/contact" },
};
function P() {
  return (
    <SiteChrome {...CHROME}>
      <SafeImage src={null} alt="Nadia and Tom under the mill arches, dusk" ratio="21/9" />
      <div className="mx-auto max-w-3xl px-6 pb-16">
        <p className="mt-8 text-xs uppercase tracking-wide text-muted-foreground">Cressbrook Mill · June 2026</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Nadia &amp; Tom</h1>
        <p className="mt-3 text-muted-foreground">
          The brief was one line: "no posing, my dad hates cameras." Eleven hours,
          two photographers, and the dad — as it turned out — gave the picture of the year.
        </p>
        <Gallery className="mt-10" columns={2} items={[
          { src: null, alt: "Morning — the dress and the nerves" },
          { src: null, alt: "Her father, reading his speech to the mirror" },
          { src: null, alt: "The walk down, everyone standing" },
          { src: null, alt: "Confetti at the mill gates" },
          { src: null, alt: "The band's second set" },
          { src: null, alt: "Last bus home, still dancing" },
        ]} />
        <Testimonial className="mt-12" item={{
          quote: "Dad framed the one of him and the mirror. He tells people a friend took it.",
          name: "Nadia El-Amin", role: "Married at Cressbrook Mill",
        }} />
        <CtaBand className="mt-12" title="Your day, told like this"
          description="We take twenty weddings a year and never two in one weekend."
          action={{ label: "Ask about your date", href: "#/contact" }} />
      </div>
    </SiteChrome>
  );
}
