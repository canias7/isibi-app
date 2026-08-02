// tradesman /work — every job, before and after. The gallery IS the argument in
// this trade, so it gets a page rather than a strip.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { BeforeAfter } from "@/components/ui/before-after";
import { Gallery } from "@/components/ui/gallery";
import { SectionHeader } from "@/components/ui/section-header";
import { Testimonial } from "@/components/ui/testimonial";
export const Route = createFileRoute("/work")({ component: P });
const JOBS = [
  { where: "Crookes", what: "Full bathroom", how: "Five days, including the tiling. Old suite out on the Monday, first shower on the Friday." },
  { where: "Walkley", what: "Back boiler to combi", how: "Two days. The airing cupboard came back as a cupboard, which is most of why people do it." },
  { where: "Fulwood", what: "Wet room, level access", how: "Eight days. Floor dug out, tanked, and a fall you cannot see but the water can find." },
  { where: "Nether Edge", what: "Whole-house rads", how: "Three days, eleven radiators, and the system flushed rather than topped up." },
];
function P() {
  return (
    <SiteChrome name="Barlow & Son" tagline="Plumbing and heating, Sheffield S6 and S10."
      links={[{ label: "Home", href: "#/" }, { label: "Quote", href: "#/quote" }]}
      action={{ label: "0114 266 1180", href: "tel:+441142661180" }}>
      <div className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="The work" title="Every job, before and after"
          description="All of these are within four miles. We will give you the address if you want to knock on and ask." />
        <div className="mt-10 space-y-14">
          {JOBS.map((j) => (
            <article key={j.where} className="border-t border-border pt-10">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="text-2xl font-semibold tracking-tight">{j.what}</h2>
                <p className="text-sm uppercase tracking-widest text-muted-foreground">{j.where}</p>
              </div>
              <p className="mt-2 max-w-2xl text-base leading-relaxed text-muted-foreground">{j.how}</p>
              <BeforeAfter className="mt-6" beforeLabel={`${j.what} at ${j.where}, before`} afterLabel={`${j.what} at ${j.where}, finished`} />
            </article>
          ))}
        </div>
        <div className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="Odds and ends" title="The bits nobody photographs" />
          <Gallery className="mt-6" columns={4} items={[
            { alt: "Copper soldered at a joint", caption: "Soldered, not pushed" },
            { alt: "A stopcock finally labelled", caption: "Labelled, at last" },
            { alt: "Dust sheets down before anything", caption: "Sheets first" },
            { alt: "The old suite going in the van", caption: "It leaves with us" },
          ]} />
        </div>
        <Testimonial className="mt-12" item={{ quote: "He sent me a photo of the joint before he boarded it back up. Nobody has ever done that.", name: "Rob D", role: "Stannington" }} />
      </div>
    </SiteChrome>
  );
}
