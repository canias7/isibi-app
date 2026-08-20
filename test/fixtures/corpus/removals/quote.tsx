// removals /quote — the full form, with photographs. The calculator repeats at
// the top, because somebody who arrived here from a search has not seen it and
// a form with no number above it is the thing this family exists to replace.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { ContactForm } from "@/components/ui/contact-form";
import { Faq } from "@/components/ui/faq";
import { QuoteCalculator } from "@/components/ui/quote-calculator";
import { SectionHeader } from "@/components/ui/section-header";
import { TrustStrip } from "@/components/ui/trust-strip";
export const Route = createFileRoute("/quote")({ component: P });
function P() {
  return (
    <SiteChrome name="Bramall & Sons Removals" tagline="A family removals firm in Sheffield since 1978."
      links={[{ label: "Home", href: "/" }, { label: "Moving day", href: "/moving-day" }]}
      action={{ label: "Get a price", href: "#top" }}>

      <div id="top" className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="A fixed price" title="Start with the range, then book the survey"
          description="The calculator gets within about ten percent. The survey turns that into a figure that does not move, and it takes twenty minutes on a video call." />

        <div className="mt-10">
          <QuoteCalculator onBookSurvey={() => {}} />
        </div>

        <section className="mt-14 border-t border-border pt-10">
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr]">
            <div>
              <SectionHeader eyebrow="Book the survey" title="Evenings and Saturdays too"
                description="Free, and there is nothing to sign at the end of it. Dave or Ellie will come back with three slots the same day." />
              <ContactForm className="mt-6" askPhone onSubmit={() => {}} />
            </div>
            <div>
              <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Photographs help more than words</h2>
              <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                If you would rather skip the survey entirely, send us pictures instead and we will
                quote off them. Six or seven is usually plenty, and a fixed price off photographs is
                as binding as one off a walk-round.
              </p>
              <ul className="mt-5 divide-y divide-border border-y border-border text-base">
                <li className="py-3">Each room, from the doorway, with nothing tidied</li>
                <li className="py-3">The loft, if anything is coming out of it</li>
                <li className="py-3">The garage, the shed and anything under a bed</li>
                <li className="py-3">The front of both houses, showing where a van can get to</li>
                <li className="py-3">Any staircase a wardrobe has to come down</li>
                <li className="py-3">Anything heavy, awkward or valuable, on its own</li>
              </ul>
              <p className="mt-4 text-sm text-muted-foreground">
                Send them to the address on the reply, or by WhatsApp to the number on the survey
                confirmation. We do not want them uploaded here — a form that swallows photographs
                is a form that loses them.
              </p>

              <h2 className="mt-10 text-sm font-medium uppercase tracking-widest text-muted-foreground">Worth telling us</h2>
              <ul className="mt-3 divide-y divide-border border-y border-border text-base">
                <li className="py-3">A completion date, even a provisional one</li>
                <li className="py-3">Whether either address has parking, and whether it needs a permit</li>
                <li className="py-3">Anything going into storage rather than to the new house</li>
                <li className="py-3">A piano, a safe, a pool table or a very large fish tank</li>
                <li className="py-3">Anything you would rather carry yourself</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <TrustStrip items={[
            { title: "Quote valid three months", description: "Not a price that expires in a week" },
            { title: "Change the date once, free", description: "At any notice, including on the morning" },
            { title: "Nothing to pay up front", description: "Settle on the day, by card or transfer" },
          ]} />
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="max-w-3xl">
            <SectionHeader eyebrow="Asked often" title="About the quote itself" />
            <Faq className="mt-6" items={[
              { question: "Why is the calculator a range and not a price?", answer: "Because an exact figure without seeing the house is a guess dressed up, and the ones that come back low are the ones that grow on the day. The range is honest about what we do not know yet." },
              { question: "Will the fixed price really not change?", answer: "Only if what is moving changes. If the loft turns out to be full or you add a shed, we will tell you before the day rather than at the end of it." },
              { question: "Do I have to pay a deposit?", answer: "No. Nothing until the job is done, and then by card or transfer on the day." },
              { question: "How does the video survey work?", answer: "A WhatsApp video call, twenty minutes, walking round with the phone. It is what most people choose now and the price is exactly as binding." },
              { question: "Can you beat another quote?", answer: "Sometimes, and we will say so plainly rather than making you haggle. If somebody is meaningfully cheaper, check their goods-in-transit cover and whether the crew are theirs." },
            ]} />
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
