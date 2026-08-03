// antiques /piece — one object in full, with provenance and condition given as
// much room as the photographs.
//
// THE GAP IN THE PROVENANCE IS DISCLOSED. Every honest provenance has one and
// every dishonest one is presented as continuous. A dealer who shows the gap is
// telling you what they do not know, which is the only reason to trust what
// they say they do.
//
// RESTORATION IS LISTED AS RESTORATION. A repaired lopper does not reduce a
// piece's value nearly as much as an undisclosed one discovered later, and the
// second is how a customer stops being a customer.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Gallery } from "@/components/ui/gallery";
import { ProvenanceNote } from "@/components/ui/provenance-note";
import { ConditionReport } from "@/components/ui/condition-report";
import { SpecRow, SpecList } from "@/components/ui/spec-row";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/piece")({ component: P });

function P() {
  return (
    <SiteChrome
      name="Vane & Marrow"
      tagline="A-441 — George III mahogany bureau, c.1790."
      links={[
        { label: "All stock", href: "#/" },
        { label: "Selling something", href: "#/selling" },
      ]}
      action={{ label: "Enquire about this", href: "#enquire" }}
    >
      <div className="mx-auto max-w-5xl px-6 py-16">
        <p className="font-mono text-sm text-muted-foreground">A-441</p>
        <h1 className="mt-2 text-5xl font-semibold tracking-tight text-balance">
          George III mahogany bureau
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Circa 1790, probably North Country. Fitted interior, original brass. <span className="font-medium text-foreground">£2,150</span>
        </p>

        <section className="mt-10">
          <Gallery
            columns={3}
            items={[
              { src: null, alt: "The bureau closed, three-quarter view", caption: "Closed. The figure on the fall is the reason we bought it." },
              { src: null, alt: "The fitted interior with the fall open", caption: "The interior — eight pigeonholes, four drawers and a well." },
              { src: null, alt: "Detail of the original swan-neck handles", caption: "Original brass throughout except one escutcheon." },
              { src: null, alt: "The repaired left-hand lopper", caption: "The repaired lopper, photographed rather than described." },
              { src: null, alt: "Underside showing the drawer construction", caption: "Hand-cut dovetails, oak linings, saw marks consistent with the date." },
              { src: null, alt: "The bracket feet from below", caption: "Both feet original. This is where a replacement usually shows." },
            ]}
          />
        </section>

        <section className="mt-14">
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr]">
            <div>
              <SectionHeader eyebrow="The object" title="Measurements and construction" />
              <div className="mt-6">
                <SpecList>
                  <SpecRow label="Height" value="107" unit="cm" />
                  <SpecRow label="Width" value="97" unit="cm" />
                  <SpecRow label="Depth, closed" value="52" unit="cm" />
                  <SpecRow label="Depth, open" value="82" unit="cm" note="Worth measuring your room. It is the dimension people forget." />
                  <SpecRow label="Timber" value="Mahogany" note="Oak drawer linings and pine carcass, as expected for the date and region." />
                  <SpecRow label="Handles" value="Original" highlight note="Swan-neck, all eight. One escutcheon is a replacement and is photographed." />
                  <SpecRow label="Feet" value="Original bracket" highlight />
                  <SpecRow label="Weight" value="About 58" unit="kg" note="Two people. It comes apart no further than removing the drawers." />
                </SpecList>
              </div>
            </div>
            <div>
              <SectionHeader
                eyebrow="Where it has been"
                title="Provenance, including the gap"
                description="Every honest provenance has one. A continuous chain back to 1790 would be remarkable and we would be suspicious of it."
              />
              <div className="mt-6">
                <ProvenanceNote
                  statementAt="July 2026"
                  researchNote="Researched from the 1911 inventory at Sheffield Archives and the 1968 Sotheby's Chester catalogue. The 1911 to 1968 period is not documented and we are not going to invent it."
                  steps={[
                    { id: "1", period: "c.1790", holder: "Unknown — probably made for a Sheffield merchant house", place: "North of England", how: "Construction and timber are consistent with a Yorkshire or Lancashire workshop" },
                    { id: "2", period: "By 1911", holder: "The Hadfield family", place: "Ranmoor, Sheffield", how: "Listed in a household inventory of 1911 as 'a mahogany bureau, the study'" },
                    { id: "3", period: "1911 – 1968", gap: true },
                    { id: "4", period: "1968", holder: "Private buyer", place: "Chester", how: "Sotheby's Chester, 14 May 1968, lot 212" },
                    { id: "5", period: "1968 – 2026", holder: "One family", place: "Cheshire", how: "By descent" },
                    { id: "6", period: "July 2026", holder: "Vane & Marrow", place: "Sheffield", how: "Purchased from the estate" },
                  ]}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader
            eyebrow="Condition"
            title="Everything we can see, including the repairs"
            description="An undisclosed repair found later costs far more than a disclosed one costs now — it costs the customer."
          />
          <div className="mt-8 max-w-3xl">
            <ConditionReport
              examinedBy="Ruth Marrow"
              examinedOn="19 July 2026"
              inHand
              viewingNote="Come and look. Photographs flatten a surface and no report replaces standing in front of something for ten minutes."
              points={[
                { id: "1", where: "Left-hand lopper", what: "Broken and repaired with a glued splice, at some point before 1968. Sound and functional; visible from underneath.", restoration: true },
                { id: "2", where: "Second escutcheon, upper drawer", what: "Replaced with a good period-style casting. The other seven are original.", restoration: true },
                { id: "3", where: "Fall front", what: "Excellent figure, one shallow scratch about 60mm long on the right. Not through the finish." },
                { id: "4", where: "Interior", what: "Complete. All eight pigeonholes, four small drawers and the well are original with their dividers." },
                { id: "5", where: "Bracket feet", what: "All four original, which is unusual. Minor losses to the rear left foot's moulding." },
                { id: "6", where: "Surface", what: "Waxed, not French polished. A previous owner's ring mark on the top left, about 80mm, faint." },
                { id: "7", where: "Locks", what: "Two of five working. One key present, fits the fall. Not restored and we would leave it that way.", restoration: false },
                { id: "8", where: "Carcass", what: "Sound and square. No woodworm, active or historic." },
              ]}
            />
          </div>
        </section>

        <section className="mt-14" id="enquire">
          <SectionHeader
            eyebrow="Enquire"
            title="Ring, email, or come and look"
            description="We will hold a piece for a fortnight without a deposit while you think, measure, or take somebody else's opinion on it."
          />
          <div className="mt-6 flex flex-wrap gap-3">
            <a className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" href="tel:01142551180">
              Ring 0114 255 1180
            </a>
            <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="#/">
              Back to the stock
            </a>
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader title="About this piece" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "Does the repaired lopper matter?",
                  answer:
                    "To the price, a little — perhaps eight percent. To using it, not at all; it has held since before 1968. What would matter is finding it after buying, which is why it is in the photographs.",
                },
                {
                  question: "Will it fit through a normal door?",
                  answer:
                    "97cm wide, so a standard 76cm doorway needs it turned on its side, which is fine. Measure the turn at the top of the stairs rather than the door — that is what defeats bureaux.",
                },
                {
                  question: "Should I have it polished?",
                  answer:
                    "No. It has a waxed surface with two hundred years of history in it and French polishing would take perhaps a fifth off the value. Wax it twice a year and leave it alone.",
                },
                {
                  question: "Would you take it back?",
                  answer:
                    "Within fourteen days, full refund, no reason needed, if it is as it left. Under BADA's code we would do that anyway and we would rather say it plainly.",
                },
              ]}
            />
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            <a className="underline underline-offset-4" href="#/">All available stock</a>
            {" · "}
            <a className="underline underline-offset-4" href="#/selling">Selling something of your own</a>
          </p>
        </section>
      </div>
    </SiteChrome>
  );
}
