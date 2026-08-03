// estate-agent/date-picker /landlords — the second audience, and for a holiday
// business the owner's question is not "what is the fee" but "what will it
// actually earn". A letting agent's landlord page can lead with a percentage;
// a holiday-let manager's has to lead with occupancy, because 22 weeks at £700
// and 34 weeks at £520 are the same money and a very different year.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { BreakEvenNote } from "@/components/ui/break-even-note";
import { ContactForm } from "@/components/ui/contact-form";
import { Faq } from "@/components/ui/faq";
import { PricingTable } from "@/components/ui/pricing-table";
import { SectionHeader } from "@/components/ui/section-header";
import { StatsBand } from "@/components/ui/stats-band";
export const Route = createFileRoute("/landlords")({ component: P });
function P() {
  return (
    <SiteChrome name="Dales Lets" tagline="Twenty-two cottages, barns and huts in Upper Wharfedale. Booked direct."
      links={[{ label: "All the places", href: "#/" }, { label: "One cottage", href: "#/listing" }]}
      action={{ label: "Ring 01756 760 210", href: "tel:01756760210" }}>

      <div className="mx-auto max-w-6xl px-6 py-12">
        <SectionHeader eyebrow="Owners" title="31 weeks, not a percentage"
          description="Every management company leads with its fee. The number that decides your year is the occupancy — 22 weeks at £700 and 34 at £520 are the same money and completely different amounts of wear on a cottage." />

        <StatsBand className="mt-8" items={[
          { value: "31 wks", label: "Median occupancy across our 22" },
          { value: "18%", label: "Our fee, including VAT" },
          { value: "£19,400", label: "Median gross to the owner, last year" },
          { value: "3 of 22", label: "Owners who left in ten years" },
        ]} />

        <section className="mt-12 grid gap-10 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <SectionHeader eyebrow="The arithmetic" title="What a two-bed in Kettlewell actually did"
              description="Beck Cottage, last year, real figures. Not a model and not the best one — it is the median of the four two-beds we manage." />
            <div className="mt-6 overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-widest text-muted-foreground">
                    <th scope="col" className="py-2 pr-4 font-medium">What</th>
                    <th scope="col" className="py-2 text-right font-medium">A year</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Gross bookings, 31 weeks", "£21,340", "Average £688 a week across high and low season"],
                    ["Our fee, 18% including VAT", "−£3,841", "Marketing, the diary, the phone, the changeovers, the complaints"],
                    ["Cleaning and linen", "−£2,790", "£90 a changeover, 31 of them. Paid to the cleaner, not to us"],
                    ["Utilities and council tax", "−£2,180", "Business rates rather than council tax, with small business relief"],
                    ["Insurance and safety checks", "−£640", "Holiday-let insurance, gas certificate, PAT, and the legionella assessment"],
                    ["Maintenance and replacement", "−£1,900", "The real figure across four cottages. Some years it is £600 and some it is £4,000"],
                  ].map(([k, v, note]) => (
                    <tr key={k} className="border-b border-border/60 align-baseline">
                      <th scope="row" className="py-3 pr-4 text-left font-[inherit]">
                        <span className="font-medium">{k}</span>
                        <span className="block text-xs leading-relaxed text-muted-foreground">{note}</span>
                      </th>
                      <td className="py-3 text-right tabular-nums">{v}</td>
                    </tr>
                  ))}
                  <tr className="border-b-2 border-foreground align-baseline">
                    <th scope="row" className="py-3 pr-4 text-left text-base font-semibold">To the owner, before tax and any mortgage</th>
                    <td className="py-3 text-right text-base font-semibold tabular-nums">£9,989</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              That is a real cottage, a real year, and it is the median rather than the best. The
              best of the four cleared £14,200 and the worst £6,800 — the difference was almost
              entirely the hot tub, which cost £4,800 to put in and paid for itself in fourteen
              months.
            </p>
            <div className="mt-6">
              <BreakEvenNote units={11} unitNoun="weeks let" revenue={7570}
                atCurrentRate="reached by about the end of May in a normal year" />
            </div>
          </div>

          <div>
            <SectionHeader eyebrow="What we do" title="Three levels, and most people want the middle" />
            <PricingTable className="mt-6" tiers={[
              {
                name: "Marketing only", price: "9%", period: "of gross bookings",
                description: "We fill the diary and you do everything else. For owners who live nearby and have a cleaner.",
                features: ["Listed here and on the two platforms", "Photography, once, included", "The diary and the enquiries", "Payment taken and passed on monthly"],
                action: { label: "Talk about it", href: "#enquire" },
              },
              {
                name: "Full management", price: "18%", period: "of gross bookings", featured: true,
                description: "Everything, including the phone at eleven at night. What twenty of the twenty-two are on.",
                features: [
                  "Everything in marketing only",
                  "Changeovers arranged and inspected",
                  "The guest's phone number, not yours",
                  "Maintenance to £150 without ringing you",
                  "Gas, electrical and legionella tracked before they expire",
                  "The complaint, and the refund decision, handled",
                ],
                action: { label: "Talk about it", href: "#enquire" },
              },
              {
                name: "Guaranteed", price: "—", period: "we do not offer it",
                description: "A fixed annual figure whatever the diary does. We are asked for this constantly and we say no.",
                features: [
                  "Because it only pays when we are wrong about your cottage",
                  "And it always pays us more in a good year than you",
                  "Two companies in this dale offer it. Read what happens in year three",
                ],
                action: { label: "Why not", href: "#enquire" },
              },
            ]} />
          </div>
        </section>

        <section id="enquire" className="mt-14 border-t border-border pt-10">
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr]">
            <div>
              <SectionHeader eyebrow="Start" title="We will come and look, and sometimes say no"
                description="About one cottage in four we turn down — usually because it is in a spot that will not let for enough weeks to be worth anybody's time, and we would rather say so than take it on and disappoint you." />
              <ContactForm className="mt-6" askPhone onSubmit={() => undefined} />
            </div>
            <div>
              <SectionHeader eyebrow="Asked often" title="By owners" />
              <Faq className="mt-6" items={[
                { question: "Can I use it myself?", answer: "As much as you like — block the dates in the same diary you can see on this site. Owners average about five weeks a year and we have never charged for one." },
                { question: "What is the notice period?", answer: "Three months, and any booking already taken is honoured. There is no exit fee and no clause that keeps your photographs." },
                { question: "Who owns the reviews and the photographs?", answer: "You do, both. If you leave, the photographs come with you — we commissioned them and we are not going to hold them hostage." },
                { question: "Do you take a cut of the cleaning?", answer: "No. £90 a changeover goes to the cleaner and none of it comes here. A manager marking up cleaning has a reason to want more changeovers than your cottage can stand." },
                { question: "What about damage?", answer: "We do not take a deposit, deliberately — it deters more bookings than it saves. In ten years and roughly six thousand stays, damage above the £150 threshold has happened eleven times, and the insurance covered nine." },
                { question: "Would mine let?", answer: "Ring and we will tell you honestly, including no. The two things that decide it are how far it is from a pub and whether a dog can come — not the kitchen, which is what everybody spends the money on." },
              ]} />
            </div>
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
