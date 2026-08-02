// lettings-agent /landlords — the fee as a percentage, published. "Competitive
// rates" is what every agent's landlord page says, and a landlord ringing four
// agents to get four numbers is the friction this page removes.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { ContactForm } from "@/components/ui/contact-form";
import { Faq } from "@/components/ui/faq";
import { PricingTable } from "@/components/ui/pricing-table";
import { SectionHeader } from "@/components/ui/section-header";
export const Route = createFileRoute("/landlords")({ component: P });
function P() {
  return (
    <SiteChrome name="Sharrow Vale Lettings" tagline="Letting and managing 340 homes across south-west Sheffield since 2008."
      links={[{ label: "Home", href: "#/" }, { label: "Compliance", href: "#/compliance" }]}
      action={{ label: "Ring 0114 266 1180", href: "tel:01142661180" }}>

      <div className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="Landlords" title="8%, 11% or 14% — published"
          description="Rather than 'competitive rates', which means the number depends on how much you sound like you have shopped around. Every figure below includes VAT, because a fee quoted without it is 20% larger than it looks." />

        <section className="mt-10">
          <PricingTable tiers={[
            {
              name: "Let only", price: "8%", period: "of the first year's rent, once",
              description: "We find the tenant and then it is yours. For landlords who want to manage it themselves and know what that involves.",
              features: [
                "Advertised on Rightmove and Zoopla",
                "Accompanied viewings, seven days",
                "Full referencing and Right to Rent checks",
                "The tenancy agreement drawn and signed",
                "Deposit registered in a scheme, certificate to you",
                "Inventory and check-in with photographs",
              ],
              action: { label: "Talk about let only", href: "#enquire" },
            },
            {
              name: "Rent collection", price: "11%", period: "of the rent, monthly", featured: true,
              description: "Everything in let only, plus we chase the money. The tier most landlords with one or two properties should be on.",
              features: [
                "Everything in let only",
                "Rent collected and paid over within 3 working days",
                "Arrears chased from day one, by a person",
                "Annual rent review with the local comparables",
                "Statements monthly, and the year-end one your accountant wants",
                "Section 13 and Section 21 served correctly when needed",
              ],
              action: { label: "Talk about rent collection", href: "#enquire" },
            },
            {
              name: "Full management", price: "14%", period: "of the rent, monthly",
              description: "Everything above, plus the phone calls at eleven at night. For landlords who do not live nearby or do not want to be the person a boiler failure reaches.",
              features: [
                "Everything in rent collection",
                "Repairs handled to £250 without ringing you",
                "24-hour emergency line, answered by us not a call centre",
                "Quarterly inspections with a written report and photographs",
                "Gas safety, EICR and EPC booked and tracked before they expire",
                "Deposit dispute handled end to end if it comes to that",
              ],
              action: { label: "Talk about full management", href: "#enquire" },
            },
          ]} />
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr]">
            <div>
              <SectionHeader eyebrow="And nothing else" title="The charges other agents add"
                description="Listed here because you will be quoted them elsewhere and they are the reason a headline 10% becomes 15%." />
              <ul className="mt-6 divide-y divide-border border-y border-border text-base">
                <li className="py-3">
                  <span className="font-medium">Tenancy set-up fee — we do not charge one</span>
                  <span className="block text-sm text-muted-foreground">Commonly £200–£400. It is the same work the percentage already pays for.</span>
                </li>
                <li className="py-3">
                  <span className="font-medium">Renewal fee — we do not charge one</span>
                  <span className="block text-sm text-muted-foreground">Charging again for a tenant who has simply stayed is the one that annoys landlords most, and rightly.</span>
                </li>
                <li className="py-3">
                  <span className="font-medium">Inspection fee — included</span>
                  <span className="block text-sm text-muted-foreground">Quarterly on full management. Some agents charge £60 a visit on top of the percentage.</span>
                </li>
                <li className="py-3">
                  <span className="font-medium">Repair commission — we do not take one</span>
                  <span className="block text-sm text-muted-foreground">The plumber's invoice is the plumber's invoice. A 10% mark-up on repairs is standard in this trade and it is a quiet incentive to find more repairs.</span>
                </li>
                <li className="py-3">
                  <span className="font-medium">Court and eviction work — £480, at cost</span>
                  <span className="block text-sm text-muted-foreground">The one thing that is genuinely extra. It is weeks of work and it happened four times last year across 340 properties.</span>
                </li>
              </ul>
            </div>
            <div id="enquire">
              <SectionHeader eyebrow="Start" title="A valuation, and an honest one"
                description="We will tell you what it will actually let for, which is sometimes less than the agent down the road said. Over-valuing wins the instruction and loses the first six weeks." />
              <ContactForm className="mt-6" askPhone onSubmit={() => undefined} />
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                No sole agency tie-in, no minimum term, and two months' notice to leave us — which
                you should never need to use, and which is the point of not needing a contract to
                keep somebody.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="max-w-3xl">
            <SectionHeader eyebrow="Asked often" title="By landlords" />
            <Faq className="mt-6" items={[
              { question: "Is the fee on the rent or on the gross?", answer: "On the rent actually collected, so if a tenant does not pay, we do not earn. An agent charging on rent due rather than rent received has no reason to chase it, and you should ask every agent this." },
              { question: "Is that including VAT?", answer: "Yes, all three. A fee quoted at 10% plus VAT is 12%, and quoting it the other way is how agents look cheaper than they are." },
              { question: "How long is the contract?", answer: "There isn't one beyond the current tenancy. Two months' notice either way. We have never had a landlord leave and come back, which is either a good sign or a bad one." },
              { question: "Who holds the deposit?", answer: "We do, in an insured scheme, in a client account that is not ours. You can hold it yourself if you would rather — plenty of landlords do — and then registering it within 30 days is your legal duty, not ours." },
              { question: "What happens if the tenant stops paying?", answer: "We chase from day one, in writing at day seven, and talk to you at day fourteen about the options. Most arrears are a payday that moved. The ones that are not need a Section 8 and we will be straight with you about how long that takes, which is months." },
              { question: "Do you do rent guarantee insurance?", answer: "We can arrange it, about £180 a year, and we take no commission on it. Whether it is worth it depends on whether one missed month would actually hurt you." },
            ]} />
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
