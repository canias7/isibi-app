// accountant/booking-hybrid /about — "the firm itself: history, regulation, how
// it charges; the page trust is checked against". For a vet in 2026 this page
// has one job the family did not anticipate: answering the ownership question
// properly, because the CMA spent two years establishing that most people
// cannot find out who owns their vet and that it changes what they are charged.
//
// The front page states it. This page proves it — the register numbers, the
// accreditation, the companies-house facts, and the offers we turned down.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { AwardBadge } from "@/components/ui/award-badge";
import { Faq } from "@/components/ui/faq";
import { Gallery } from "@/components/ui/gallery";
import { KeyPoints } from "@/components/ui/key-points";
import { PractitionerCard } from "@/components/ui/practitioner-card";
import { SectionHeader } from "@/components/ui/section-header";
import { SpecList, SpecRow } from "@/components/ui/spec-row";
import { TeamGrid } from "@/components/ui/team-grid";
import { Timeline } from "@/components/ui/timeline";
import { TrustStrip } from "@/components/ui/trust-strip";
export const Route = createFileRoute("/about")({ component: P });
function P() {
  return (
    <SiteChrome name="Marsh Lane Veterinary" tagline="Independent, RCVS accredited, and owned by the two vets who work here. Louth, Lincolnshire."
      links={[{ label: "Home", href: "#/" }, { label: "What we do and what it costs", href: "#/services" }, { label: "Book or ring", href: "#/contact" }]}
      action={{ label: "Book an appointment", href: "#/contact" }}>

      <div className="mx-auto max-w-6xl px-6 py-12">
        <SectionHeader eyebrow="The practice" title="Thirty-one years, one building, and no group behind it"
          description="This is the page people check, so it is the page where every claim on the rest of the site is written out with the number you would need to verify it." />

        {/* THE OWNERSHIP FACTS, CHECKABLE. The front page says independent;
            anybody can say independent. What makes it a claim rather than a
            slogan is a company number somebody can look up in forty seconds. */}
        <section className="mt-10 grid gap-10 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <SectionHeader eyebrow="Who owns this" title="In enough detail to check"
              description="The CMA's two-year review found that most people cannot establish who owns their vet practice and that it affects what they pay. This is our answer, with the numbers." />
            <div className="mt-6">
              <SpecList>
                <SpecRow label="Legal entity" value="Marsh Lane Veterinary Ltd" note="Company 03118447, incorporated 1996, registered in England" highlight />
                <SpecRow label="Shareholders" value="Two, both vets here" note="Prisha Nandra 50%, Callum Tait 50%. On the confirmation statement, filed annually" highlight />
                <SpecRow label="Persons with significant control" value="The same two" note="No holding company, no nominee, no trust. This is the line worth reading anywhere" highlight />
                <SpecRow label="Group membership" value="None" note="Not IVC Evidensia, not CVS, not VetPartners, not Medivet, not Linnaeus" />
                <SpecRow label="Referral relationships" value="No financial interest" note="We refer to Lincoln and to Nottingham vet school and receive nothing from either" />
                <SpecRow label="Buy-out offers received" value="Three, since 2019" note="2019, 2021 and 2024. Declined. We would tell registered clients before any sale completed" />
                <SpecRow label="Out-of-hours provider" value="Us" note="Not outsourced. Most practices this size now outsource and are not required to say so" />
              </SpecList>
            </div>
            <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
              None of that makes us better vets than a corporate practice, and we are not going to
              claim it does. It makes the answer findable, which is the thing the review was
              actually about — and it means the price of a consultation is decided in this building.
            </p>
          </div>

          <div>
            <SectionHeader eyebrow="Regulation" title="What we are accredited for, and by whom" />
            <div className="mt-6 flex flex-wrap gap-3">
              <AwardBadge title="RCVS Practice Standards — Small Animal General Practice" year={2025} issuer="Royal College of Veterinary Surgeons" />
              <AwardBadge title="Cat Friendly Clinic, Silver" year={2024} issuer="International Society of Feline Medicine" />
            </div>
            <div className="mt-6">
              <SpecList>
                <SpecRow label="RCVS accreditation" value="Since 2008" note="Voluntary scheme. Reinspected 2025; roughly half of UK practices are not in it" highlight />
                <SpecRow label="Controlled drugs" value="Home Office licensed" note="Register audited annually and inspected as part of the RCVS visit" />
                <SpecRow label="Waste and clinical disposal" value="Environment Agency" note="Registered carrier, consignment notes kept seven years" />
                <SpecRow label="Complaints" value="Written reply in 5 working days" note="Then the RCVS Professional Conduct route, which we will point you at rather than away from" />
                <SpecRow label="Insurance" value="Professional indemnity, VDS" note="Veterinary Defence Society. Certificate available on request" />
              </SpecList>
            </div>
            <div className="mt-6">
              <TrustStrip columns={1} items={[
                { title: "Both vets on the RCVS register", description: "7041882 and 7118440 — searchable on the public register in about forty seconds" },
                { title: "Every price published", description: "Consultation, surgery, dentals, out of hours, and what happens when an estimate is exceeded" },
                { title: "Notes released to anybody, same day", description: "For a second opinion, without being asked why. It is your animal's record and not ours" },
              ]} />
            </div>
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="The two of us" title="Named, with numbers you can check" />
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <PractitionerCard
              name="Prisha Nandra" role="Veterinary surgeon and co-owner" letters="BVetMed MRCVS"
              register="RCVS" registerNumber="7041882" registerUrl="#/about"
              treats={["Dogs", "Cats", "Rabbits", "Small furries"]}
              languages={["English", "Hindi"]}
              note="Royal Veterinary College, 2007. Here since 2011, an owner since 2016. Certificate in small animal medicine; runs the diabetic and thyroid clinics and does most of the soft-tissue surgery."
              accepting />
            <PractitionerCard
              name="Callum Tait" role="Veterinary surgeon and co-owner" letters="BVMS MRCVS"
              register="RCVS" registerNumber="7118440" registerUrl="#/about"
              treats={["Dogs", "Cats", "Sheep", "Cattle"]}
              languages={["English"]}
              note="Glasgow, 2012. Here since 2016, an owner since 2019. Does the farm work — cattle and sheep, on farm, Tuesday and Thursday mornings — which is why those afternoons are Prisha's."
              accepting />
          </div>
          <div className="mt-8">
            <SectionHeader eyebrow="And the rest of us" title="Five, and four of them have been here over a decade" />
            <div className="mt-6">
              <TeamGrid items={[
                { name: "Bev Astill", role: "Head nurse, RVN. Here since 2003 and knows every animal on the list by name" },
                { name: "Tomasz Wieczorek", role: "Veterinary nurse, RVN. Runs the free nurse clinics and the weight programme" },
                { name: "Sian Prydderch", role: "Veterinary nurse, RVN. Cat Friendly Clinic lead, which is why the waiting room has a separate half" },
                { name: "Maureen Dodds", role: "Practice manager. Does the insurance claims, and does them faster than any insurer expects" },
              ]} />
            </div>
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <SectionHeader eyebrow="How it got here" title="Thirty-one years, and two moments that mattered" />
              <div className="mt-6">
                <Timeline items={[
                  { when: "1994", title: "Opened by Geoffrey Wray", description: "One vet, one nurse, the same building, and a farm round that was most of the income." },
                  { when: "2008", title: "RCVS accredited", description: "Voluntary then and voluntary now. It cost a year of paperwork and it changed how the practice records things." },
                  { when: "2016", title: "Prisha buys in, Geoffrey retires", description: "The moment it could have been sold to a group instead. It was not, and that was a deliberate and slightly expensive choice." },
                  { when: "2019", title: "Callum buys in", description: "Fifty-fifty from then on, and the farm round comes back after a decade without one." },
                  { when: "2021 and 2024", title: "Two more offers", description: "Both declined. The 2024 one was substantial and we thought about it for about a fortnight." },
                  { when: "2025", title: "Reinspected, accreditation held", description: "And the price list published in full, which is the change we are most pleased with." },
                ]} />
              </div>
            </div>
            <div>
              <SectionHeader eyebrow="How we charge" title="Four rules, and they are on every page" />
              <div className="mt-6">
                <KeyPoints title="Written down so they can be held against us" points={[
                  "Every routine price is published, and it is the same on a Saturday.",
                  "Anything surgical gets a written itemised estimate before it is booked.",
                  "We ring from theatre before exceeding an estimate by 10%, not afterwards.",
                  "A follow-up for the same problem inside a fortnight is £28, not another £42.",
                ]} />
              </div>
              <div className="mt-6 rounded-lg border border-border bg-muted/50 p-5">
                <p className="text-base font-medium">What we are not good at</p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  We have no CT, no MRI and no overnight nursing — an animal that needs watching all
                  night goes to Lincoln, and we will say so rather than keep it here. We do not see
                  horses, exotics or birds beyond first aid. Two vets means that when one is on
                  holiday the diary is genuinely tighter, and in August it shows.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="The building" title="A former grain merchant's on Marsh Lane"
            description="Two consulting rooms, a theatre, a separate cat ward, and a car park that is free and never full. Step-free throughout, which for a client carrying a labrador matters more than it sounds." />
          <Gallery className="mt-8" columns={4} items={[
            { alt: "The practice from Marsh Lane", caption: "Marsh Lane, since 1994" },
            { alt: "The waiting room with its separate cat half", caption: "The cat half, which is a Silver requirement" },
            { alt: "A consulting room", caption: "Two consulting rooms, twenty minutes each" },
            { alt: "The theatre", caption: "Theatre — soft tissue and orthopaedics to cruciate" },
            { alt: "The in-house laboratory", caption: "Bloods run here, results in forty minutes" },
            { alt: "The cat ward, away from the dogs", caption: "The cat ward is a separate room, not a separate shelf" },
            { alt: "The dispensary", caption: "Dispensary, and the controlled drugs register" },
            { alt: "The car park", caption: "Free, and never full" },
          ]} />
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="max-w-3xl">
            <SectionHeader eyebrow="Asked often" title="About the practice itself" />
            <Faq className="mt-6" items={[
              { question: "How do I check any of this?", answer: "Company 03118447 at Companies House for the ownership, and the RCVS Find a Vet register for 7041882 and 7118440. Both are free, public, and take under a minute. We would rather you did than took our word for it." },
              { question: "Would you tell us if you sold?", answer: "Before it completed, to every registered client, by letter. That is a promise on a website and it is worth exactly what you think it is worth — which is why the three declined offers are listed with their years." },
              { question: "Is an independent practice cheaper?", answer: "Ours is cheaper than the two nearest group practices on consultations and dentals, and about the same on vaccinations. That is a fact about this practice rather than about independence, and you should compare rather than assume." },
              { question: "What happens if one of you is ill?", answer: "The other covers and the routine diary tightens, which is the honest cost of a two-vet practice. For a genuine emergency we have a mutual arrangement with a practice in Horncastle and it has been used four times in nine years." },
              { question: "Do you take new clients?", answer: "Yes, both vets are accepting. Bring or forward the notes from your previous practice — they are obliged to send them and they generally do within a day." },
              { question: "Why is there no online shop?", answer: "Because we would be worse at it than the places that do it properly, and the margin would tempt us to recommend things. We write prescriptions for £16 so you can buy elsewhere, and we will tell you when elsewhere is cheaper." },
            ]} />
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
