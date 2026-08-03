// lettings-agent /compliance — the certificates a landlord legally needs, with
// the DEADLINE on each. Most of these carry criminal liability or void a
// Section 21, and the ones that bite are the ones with a lead time nobody
// planned for.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { EntryRequirements } from "@/components/ui/entry-requirements";
import { Faq } from "@/components/ui/faq";
import { PricingTable } from "@/components/ui/pricing-table";
import { SectionHeader } from "@/components/ui/section-header";
export const Route = createFileRoute("/compliance")({ component: P });
function P() {
  return (
    <SiteChrome name="Sharrow Vale Lettings" tagline="Letting and managing 340 homes across south-west Sheffield since 2008."
      links={[{ label: "Home", href: "#/" }, { label: "Landlords", href: "#/landlords" }]}
      action={{ label: "Ring 0114 266 1180", href: "tel:01142661180" }}>

      <div className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="Compliance" title="Eleven things, and four of them are criminal"
          description="Not a checklist we invented — this is the law as it stands, and the penalty column is why it is on a page rather than in a welcome pack. On full management we book and track all of it; on the other tiers it is yours." />

        <section className="mt-10 grid gap-12 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <EntryRequirements heading="Before a tenant moves in"
              intro="Every one of these has to be done before the tenancy starts, and three of them have a lead time long enough to delay a move-in if left to the week before."
              requirements={[
                {
                  what: "Gas safety certificate (CP12)",
                  by: "Before move-in, then every 12 months",
                  legal: true,
                  detail: "Criminal offence to let without one, and it voids a Section 21. A copy to the tenant within 28 days of the check, and to a new tenant before they move in. Gas Safe engineers book two weeks out in autumn.",
                },
                {
                  what: "Electrical installation report (EICR)",
                  by: "Before move-in, then every 5 years",
                  legal: true,
                  detail: "Up to £30,000 civil penalty. Any C1 or C2 fault has to be fixed within 28 days and evidenced — which is where the cost is, not in the report itself.",
                },
                {
                  what: "Energy performance certificate, E or above",
                  by: "Before advertising, valid 10 years",
                  legal: true,
                  detail: "It must be on the advert, not just in the file. Below an E you cannot legally let at all without a registered exemption.",
                },
                {
                  what: "Smoke alarm on every storey, CO alarm in every room with a fuel appliance",
                  by: "Working on day one",
                  legal: true,
                  detail: "Tested in front of the tenant on the day and recorded on the inventory. £5,000 penalty and, far worse, it is the one on this list that kills people.",
                },
                {
                  what: "Deposit protected in a government scheme",
                  by: "Within 30 days of receiving it",
                  legal: true,
                  detail: "Prescribed information to the tenant in the same 30 days. Miss it and you owe up to three times the deposit AND cannot serve a Section 21 until it is returned.",
                },
                {
                  what: "Right to Rent check on every adult",
                  by: "Before the tenancy starts",
                  legal: true,
                  detail: "Original documents seen, or a share code checked online. Unlimited fine and up to five years for a knowing breach. Follow-up checks where somebody has time-limited leave.",
                },
                {
                  what: "How to Rent guide, current edition",
                  by: "At the start, and again on renewal if it has changed",
                  legal: true,
                  detail: "The single most commonly missed one. Serving an old edition voids a Section 21, and the guide is reissued without much announcement.",
                },
                {
                  what: "Selective licence, where the council requires one",
                  by: "Before letting — applications take 8–12 weeks",
                  legal: true,
                  detail: "Parts of Sheffield are designated and parts are not. Letting unlicensed is a rent repayment order of up to twelve months' rent, and the lead time is the reason to check now.",
                },
                {
                  what: "Legionella risk assessment",
                  by: "Before move-in, reviewed every 2 years",
                  legal: true,
                  detail: "A written assessment, not a test. On a normal flat it takes twenty minutes and no landlord has ever been prosecuted for the assessment — only for what it would have found.",
                },
                {
                  what: "Consent from your lender and your insurer",
                  by: "Before the first tenancy",
                  legal: false,
                  detail: "Not a criminal matter, but letting on a residential mortgage breaches its terms and letting on residential buildings insurance means a claim gets refused.",
                },
                {
                  what: "Inventory with photographs, signed",
                  by: "On the day, before keys",
                  legal: false,
                  detail: "House rule, and the single thing that decides a deposit dispute. Without one the adjudicator finds for the tenant, essentially always.",
                },
              ]} />
          </div>
          <div>
            <SectionHeader eyebrow="Who does it" title="Depends on your tier"
              description="Worth being blunt about, because 'we handle compliance' means three different things at three different price points." />
            <PricingTable className="mt-6" columns={1} tiers={[
              {
                name: "Let only", price: "Yours", period: "all of it",
                description: "We check the certificates exist before we advertise and will not market a property without them. After that it is your calendar.",
                features: ["We refuse to advertise without gas, EICR and EPC", "Copies filed and given to the tenant", "No reminders after the tenancy starts"],
                action: { label: "See the fees", href: "#/landlords" },
              },
              {
                name: "Rent collection", price: "Shared", period: "we remind, you book",
                description: "You get a reminder eight weeks before anything expires, with the number of somebody who can do it.",
                features: ["Eight-week expiry reminders", "How to Rent reissued on renewal", "Deposit registered and evidenced by us"],
                action: { label: "See the fees", href: "#/landlords" },
              },
              {
                name: "Full management", price: "Ours", period: "booked and tracked", featured: true,
                description: "We book it, let the tenant in, pay the invoice from the rent and file the certificate. You see it on the statement.",
                features: ["Everything booked before expiry, never after", "Contractors we use every week, at trade rates with no mark-up", "C1 and C2 remedials quoted and done inside 28 days", "A compliance sheet per property, sent every January"],
                action: { label: "See the fees", href: "#/landlords" },
              },
            ]} />
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="max-w-3xl">
            <SectionHeader eyebrow="Asked often" title="About the legal side" />
            <Faq className="mt-6" items={[
              { question: "Which of these actually gets people prosecuted?", answer: "Gas safety and licensing, by a distance. The alarms one is rarely prosecuted and is the one that causes actual deaths. The rest mostly bite by voiding a Section 21 at the moment you most need it to work." },
              { question: "What does a void Section 21 mean in practice?", answer: "You cannot get the property back by the no-fault route until the breach is fixed, and for a deposit breach that means returning the deposit first. It turns a two-month process into a six-month one." },
              { question: "Do I need a licence?", answer: "Parts of Sheffield are in a selective licensing area and parts are not, and the boundaries are street by street. Tell us the postcode and we will check it in a minute — it takes eight to twelve weeks to get one, so it is not something to find out about in September." },
              { question: "What if the EICR comes back with faults?", answer: "C1 is dangerous and gets fixed the same day. C2 is potentially dangerous and has 28 days. C3 is a recommendation and is not required at all — plenty of electricians quote for C3 work as though it were, and we will tell you which is which." },
              { question: "How much does all of it cost a year?", answer: "About £180 for the gas certificate, £45 amortised for the EICR, £25 for the EPC, and the alarms. Call it £250 a year on a normal two-bed, plus whatever the remedials turn out to be the first time." },
              { question: "Can you just do the compliance without managing it?", answer: "No — it needs access, contractor relationships and someone tracking dates, and unbundled it is more expensive than the management fee it comes inside. We would be selling you something worse than the thing next to it." },
            ]} />
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
