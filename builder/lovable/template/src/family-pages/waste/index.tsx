// waste — SIZE-AND-DATE-FIRST, with the PROHIBITED LIST prominent.
//
// ONE MATTRESS IN A MIXED SKIP IS A £95 CHARGE NOBODY EXPECTS. The banned
// items are the single most common cause of a surprise invoice in this trade,
// and every skip company puts them in a paragraph of terms below the booking
// form. They go above it here.
//
// AND THE PERMIT IS A COUNCIL MATTER TAKING DAYS. Somebody booking a skip for
// Saturday who needs one for the road cannot have it, and finding that out on
// the day is the other half of this industry's complaints.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { SizeGuide } from "@/components/ui/size-guide";
import { BinType } from "@/components/ui/bin-type";
import { CollectionDay } from "@/components/ui/collection-day";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/")({ component: P });

function P() {
  return (
    <SiteChrome
      name="Loxley Skips"
      tagline="Skips and grab hire across north Sheffield. Licensed carrier CBDU142208."
      links={[
        { label: "Sizes", href: "#/sizes" },
        { label: "Book", href: "#/book" },
        { label: "Questions", href: "#questions" },
      ]}
      action={{ label: "Book a skip", href: "#/book" }}
    >
      <section className="border-b border-border">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <h1 className="max-w-3xl text-5xl font-semibold tracking-tight text-balance">
            Which size, which day, and do you need a permit
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Those three, in that order. The third is a council decision that takes five working
            days, so somebody wanting a skip on the road this Saturday needs to know today rather
            than on Friday.
          </p>

          <div className="mt-10 grid gap-8 lg:grid-cols-[1.15fr_1fr]">
            <div>
              <SectionHeader eyebrow="Sizes" title="Against something you can picture" />
              <div className="mt-6">
                <SizeGuide
                  caption="Bin bags are the honest measure. A 'builder's skip' means nothing to somebody clearing a loft."
                  sizes={[
                    { name: "2-yard mini", area: 2, areaLabel: "2 yd³", like: "About 25 bin bags", alsoFits: ["A small bathroom rip-out", "Garden clearance, one afternoon"], price: "£125" },
                    { name: "4-yard midi", area: 4, areaLabel: "4 yd³", like: "About 45 bin bags", alsoFits: ["A kitchen", "A large loft clear"], price: "£185" },
                    { name: "6-yard builder's", area: 6, areaLabel: "6 yd³", like: "About 65 bin bags", alsoFits: ["Soil and rubble — the heavy one", "A full house clearance"], price: "£240" },
                    { name: "8-yard builder's", area: 8, areaLabel: "8 yd³", like: "About 85 bin bags", alsoFits: ["A extension strip-out"], price: "£290" },
                    { name: "12-yard maxi", area: 12, areaLabel: "12 yd³", like: "About 130 bin bags", alsoFits: ["Light bulky waste only", "NOT soil or rubble — too heavy to lift"], price: "£380" },
                  ]}
                />
              </div>
              <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                The 12-yard cannot legally be lifted full of rubble. Anybody who offers you one for
                soil is either not going to collect it or is going to charge you to empty it by hand.
              </p>
            </div>

            <div>
              <SectionHeader eyebrow="When" title="Next available" />
              <div className="mt-6">
                <CollectionDay
                  nextOn="2026-08-06"
                  dayName="Thursday"
                  bins={["2-yard", "4-yard", "6-yard", "8-yard"]}
                  putOutBy="07:00 on the day for collection"
                  changed
                  changedFrom="Wednesday 5 August"
                  changedReason="The 12-yard lorry is off the road until Friday, so the maxi is Friday at the earliest."
                />
              </div>
              <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
                Delivered between seven and one, and we ring twenty minutes before. Standard hire is
                fourteen days and nobody has ever been charged for going a day or two over.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* THE PROHIBITED LIST, ABOVE THE BOOKING RATHER THAN IN THE TERMS. */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <SectionHeader
            eyebrow="Before you fill it"
            title="What cannot go in, and what it costs if it does"
            description="This is the most common surprise charge in the trade and every company hides it under the booking form. One mattress is £95."
          />
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <BinType
              name="A mixed skip"
              colour="Yellow"
              accepted={["Timber, plasterboard in a bag, furniture", "Soil, rubble and hardcore (6-yard and under)", "Garden waste, carpet, packaging", "Metal, plastic, general household"]}
              notAccepted={["Mattresses — £95 each", "Fridges and freezers — £45 each", "Televisions and monitors — £25 each", "Tyres — £12 each", "Paint, oil, solvents and asbestos — refused entirely", "Gas bottles, including empty ones"]}
              commonMistakes={["A mattress under other waste. The tipping station photographs every load and it is always found.", "Plasterboard loose rather than bagged — it has to be separated and it is £30 if we do it."]}
              contaminationNote="Asbestos we will not take at any price and we will not guess. If a garage roof or an artex ceiling is involved, ring before you start and we will tell you who can."
            />
            <BinType
              name="A rubble-only skip"
              colour="Grey"
              accepted={["Soil, brick, concrete, stone", "Slate, tile, ceramic", "Sand and gravel"]}
              notAccepted={["Anything at all that is not inert", "Plasterboard — it reacts and it contaminates the whole load", "Timber, plastic, packaging, food"]}
              commonMistakes={["Half a bag of plaster on top of clean rubble. It turns a £110 skip into a £240 mixed one and it happens weekly."]}
              contaminationNote="Clean rubble is recycled as aggregate and that is why it is cheaper. One contaminated load and the whole skip is charged as mixed."
            />
          </div>
        </div>
      </section>

      <section id="questions">
        <div className="mx-auto max-w-3xl px-6 py-14">
          <SectionHeader title="What people ring to ask" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "Do I need a permit?",
                  answer:
                    "Only if it goes on the road or the pavement. On your own drive, no. A permit is £42 from Sheffield City Council, takes five working days and we apply for it — but you have to tell us in advance.",
                },
                {
                  question: "How much room does it need?",
                  answer:
                    "A 6-yard is 3.6m long, 1.7m wide and needs about 6m of clear approach for the lorry plus room above for the arms — no low branches or cables. Send a photograph if you are unsure.",
                },
                {
                  question: "Can I overfill it?",
                  answer:
                    "Level with the top and no higher. We are not permitted to lift an overloaded skip and the driver will refuse — that is the law rather than fussiness. Ring and we will swap it instead.",
                },
                {
                  question: "Where does it actually go?",
                  answer:
                    "Our transfer station at Neepsend. About 82% is recycled and we will send you the waste transfer note for any load, which you are legally entitled to and almost nobody asks for.",
                },
              ]}
            />
          </div>
        </div>
      </section>
    </SiteChrome>
  );
}
