// accountant/booking-hybrid /services — "each practice area stated plainly:
// what it covers, what it costs to start". For a vet the second half is the
// whole page, because what a treatment costs is the thing this trade is least
// willing to publish and the thing every client most wants to know.
//
// So every price is here, and so is the sentence almost nobody writes: what
// happens when it goes over the estimate.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { CostEstimateNote } from "@/components/ui/cost-estimate-note";
import { Faq } from "@/components/ui/faq";
import { KeyPoints } from "@/components/ui/key-points";
import { PriceList } from "@/components/ui/price-list";
import { SectionHeader } from "@/components/ui/section-header";
import { ServiceCard } from "@/components/ui/service-card";
import { SpecList, SpecRow } from "@/components/ui/spec-row";
export const Route = createFileRoute("/services")({ component: P });
function P() {
  return (
    <SiteChrome name="Marsh Lane Veterinary" tagline="Independent, RCVS accredited, and owned by the two vets who work here. Louth, Lincolnshire."
      links={[{ label: "Home", href: "#/" }, { label: "Book or ring", href: "#/contact" }, { label: "The practice", href: "#/about" }]}
      action={{ label: "Book an appointment", href: "#/contact" }}>

      <div className="mx-auto max-w-6xl px-6 py-12">
        <SectionHeader eyebrow="What we do" title="And what every bit of it costs"
          description="Prices last changed in March 2024 and they are the same on a Saturday and on a Thursday evening. If something is not on this page, ring and ask — nobody has ever been charged for that conversation." />

        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {[
            { name: "Routine and preventive", price: "From £42", duration: "20 min", description: "Consultations, vaccination, microchipping, worming, nail clips, weight clinics and the nurse appointments, which are free." },
            { name: "Surgery", price: "From £98", duration: "Day admission", description: "Neutering, lumps, dentals, wounds and orthopaedics up to cruciate. Anything beyond that we refer, and we say where and why." },
            { name: "Ongoing conditions", price: "From £28", duration: "Follow-up rate", description: "Diabetes, thyroid, kidney, arthritis and skin. Same vet every time, and a follow-up is £28 rather than another full consultation." },
          ].map((s) => (
            <ServiceCard key={s.name} name={s.name} price={s.price} duration={s.duration}
              description={s.description} bookLabel="Book" />
          ))}
        </div>

        <section className="mt-14 grid gap-12 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <SectionHeader eyebrow="Every routine price" title="The whole list, not a starting-from"
              description="A price with 'from' in front of it is a price somebody is expecting to change. These are what you pay." />
            <div className="mt-6">
              <PriceList items={[
                { name: "Consultation", price: 42, meta: "20 min", description: "Evenings and Saturdays included. No uplift during opening hours" },
                { name: "Follow-up, same problem", price: 28, meta: "within 14 days", description: "Charging twice for one illness is a habit we do not have" },
                { name: "Nurse appointment", price: 0, meta: "free", description: "Weight, nail clips, post-op checks, anal glands, diet. Genuinely free and always has been" },
                { name: "Vaccination, dog", price: 54, meta: "annual, incl. consult" },
                { name: "Vaccination, cat", price: 51, meta: "annual, incl. consult" },
                { name: "Rabbit, RHD2 and myxi", price: 62, meta: "annual, incl. consult" },
                { name: "Microchip", price: 18, meta: "£12 with a vaccination" },
                { name: "Neutering, cat male", price: 98, meta: "day patient" },
                { name: "Neutering, cat female", price: 142, meta: "day patient" },
                { name: "Neutering, dog", price: 265, meta: "under 15kg · +£30 per 10kg", description: "Includes pre-op check, anaesthetic, pain relief and the post-op check" },
                { name: "Dental, scale and polish", price: 240, meta: "no extractions" },
                { name: "Dental extractions", price: 22, meta: "per tooth", description: "Molars with roots are £45. This is where a dental estimate moves and it is why we ring from theatre" },
                { name: "Blood test, in-house", price: 78, meta: "same day", description: "Run here, results in about forty minutes rather than two days" },
                { name: "X-ray", price: 128, meta: "incl. sedation" },
                { name: "Out of hours, own client", price: 130, meta: "call-out, plus treatment" },
                { name: "Euthanasia, at the practice", price: 68, meta: "any time" },
                { name: "Euthanasia, at home", price: 95, meta: "any time, no call-out on top" },
                { name: "Individual cremation", price: 145, meta: "ashes returned", description: "Communal is £52. We use one crematorium and you can visit it, which most people do not know" },
              ]} />
            </div>
          </div>

          <div>
            {/* THE SENTENCE ALMOST NOBODY WRITES. An estimate is a number
                everybody understands; what happens when the number is wrong is
                the thing that actually generates the complaint. */}
            <SectionHeader eyebrow="Estimates" title="And what happens when it goes over" />
            <div className="mt-6">
              <CostEstimateNote from="£240" to="£420"
                dependsOn={["How many teeth come out", "Whether the roots are sound", "Whether an X-ray is needed once we are in"]}
                firmWhen="After the pre-op examination on the morning"
                note="A dental is the honest example because it is the one that moves most. We do not know how many extractions until the animal is asleep." />
            </div>
            <div className="mt-6">
              <SpecList>
                <SpecRow label="Written first" value="Always" note="Itemised, before we book anything surgical. Not a verbal figure in a corridor" highlight />
                <SpecRow label="If it will exceed by 10%" value="We ring you" note="From theatre, before doing it. Not afterwards on the invoice" highlight />
                <SpecRow label="If we cannot reach you" value="We do the minimum" note="Whatever is needed to wake the animal safely and no more, and we re-book the rest" highlight />
                <SpecRow label="If it comes in under" value="You pay the lower figure" note="Which happens about a third of the time and is not something we announce" />
                <SpecRow label="Second opinion" value="Encouraged" note="We will send the notes and the images the same day, to anybody, without asking why" />
              </SpecList>
            </div>

            <div className="mt-8">
              <SectionHeader eyebrow="Paying" title="Three things worth knowing" />
              <div className="mt-5">
                <KeyPoints title="Before you need any of them" points={[
                  "Direct insurance claims with most insurers — you pay the excess, not the whole bill.",
                  "Interest-free plans over £300, agreed before treatment rather than after the invoice. About one client in nine.",
                  "PDSA and RSPCA eligibility is a real route and we will tell you if you qualify rather than waiting to be asked.",
                ]} />
              </div>
              <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
                We have never sent a client to a debt collector. Twice in thirty-one years a bill
                has gone unpaid entirely, and on both occasions that was the right outcome.
              </p>
            </div>

            <div className="mt-8 rounded-lg border border-border bg-muted/50 p-5">
              <p className="text-base font-medium">What we refer, and where</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Complex orthopaedics, neurology, oncology and anything needing a CT or MRI. We refer
                to Lincoln and to Nottingham vet school, we have no financial relationship with
                either, and we will tell you what each will cost before you go. A referral to a
                hospital owned by the same group as the practice referring you is a thing that
                happens and it is worth asking anywhere you go.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="max-w-3xl">
            <SectionHeader eyebrow="Asked often" title="About treatment and cost" />
            <Faq className="mt-6" items={[
              { question: "Why is a dental such a wide range?", answer: "Because nobody can see the roots until the animal is asleep and X-rayed. £240 is a clean scale and polish; £420 is that plus six extractions and two of them molars. We ring from theatre with the actual number before doing it." },
              { question: "Is a nurse appointment really free?", answer: "Yes, and always has been. Weight checks, nail clips, post-op checks, diet and anal glands. It costs us about eleven minutes and it catches things early, which is cheaper for everybody." },
              { question: "Do you push pet insurance?", answer: "We recommend it and we do not sell it, take commission on it, or have a preferred provider. What we will tell you is which conditions your policy will exclude next year, because most people find that out at the worst moment." },
              { question: "What if I cannot afford treatment?", answer: "Say so, early and plainly. There is almost always a version — a plan, a staged approach, a different drug — and there are cases where the honest answer is that PDSA is the right route and we will help you get there. The one thing that does not help is not saying." },
              { question: "Do you sell food and flea treatment?", answer: "Yes, at about what the online price is, and we will tell you when the online one is cheaper. Prescription diets we stock; a routine wormer you can buy in Pets at Home for less and we would rather say so." },
              { question: "Will you write a prescription so I can buy elsewhere?", answer: "Yes, £16, which is the standard fee and is on this page rather than being something you have to ask about awkwardly. For a long-term drug it will usually save you more than that." },
            ]} />
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
