// wholesaler — DO-I-QUALIFY-FIRST: the minimum, the carriage-paid line, the
// delivery days and whether an account is needed, before any product. Every
// trade site hides those behind a login and wastes both parties' morning.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { DownloadCard } from "@/components/ui/download-card";
import { Faq } from "@/components/ui/faq";
import { LeadTime } from "@/components/ui/lead-time";
import { SectionHeader } from "@/components/ui/section-header";
import { SpecList, SpecRow } from "@/components/ui/spec-row";
import { TradeTerms } from "@/components/ui/trade-terms";
export const Route = createFileRoute("/")({ component: P });
export const TERMS = {
  minimumOrder: 150,
  carriagePaid: 400,
  paymentTerms: "30 days from invoice, once approved",
  accountRequired: true,
  deliveryDays: ["Tuesday", "Thursday"],
};
function P() {
  return (
    <SiteChrome name="Attercliffe Catering Supplies" tagline="Dry goods, chilled and disposables to independent kitchens across South Yorkshire."
      links={[{ label: "The range", href: "#/range" }, { label: "Open an account", href: "#/account" }, { label: "Terms", href: "#terms" }]}
      action={{ label: "Open an account", href: "#/account" }}>

      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid items-start gap-12 lg:grid-cols-[1fr_1.2fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Trade only · since 1987 · 340 accounts</p>
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">
                Can you buy from us?
              </h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                Answered before the products rather than after a registration form and a three-day
                wait. If the minimum is wrong for you, we would both rather know now — and there
                are two other suppliers in the city we will name.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <a className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" href="#/account">Open an account</a>
                <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="#/range">See the range and prices</a>
              </div>
              <div className="mt-8">
                <LeadTime cutoffHour={15} now={new Date(2026, 7, 3, 11, 20)}
                  before="today and it is on Tuesday's van."
                  after="Today's cut-off has gone — this order goes on Thursday's van." />
              </div>
            </div>
            {/* THE FOUR FACTS. A buyer who does not qualify should find out in
                ten seconds, not after an approval queue. */}
            <TradeTerms {...TERMS} columns={1}
              note="Prices on this site are trade, before VAT, and they are the prices — there is no tier system and no negotiation, which means the small kitchen pays what the chain pays. First order is pro forma while credit is checked; after that, thirty days." />
          </div>
        </div>
      </section>

      <section id="terms" className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-12 lg:grid-cols-[1fr_1fr]">
          <div>
            <SectionHeader eyebrow="Who we supply" title="Independent kitchens, mostly"
              description="Cafés, pubs, restaurants, a dozen schools and about forty care homes. Not the public, and not because we are precious about it — the packs are catering sizes and a 5kg tub of mayonnaise helps almost nobody at home." />
            <SpecList className="mt-6">
              <SpecRow label="Trading since" value="1987" />
              <SpecRow label="Live accounts" value="340" note="About 90 of them order every week" />
              <SpecRow label="Lines carried" value="2,400" />
              <SpecRow label="Delivery area" value="S, DN and part of HD" note="Two vans, Tuesday and Thursday" />
              <SpecRow label="Minimum order" value="£150" unit="ex VAT" highlight />
              <SpecRow label="Free delivery over" value="£400" unit="ex VAT" highlight />
              <SpecRow label="Own transport" value="Two 7.5t, both chilled" note="No third-party pallet networks — we have never lost a chilled order" />
              <SpecRow label="Collection" value="Mon–Fri 07:00–16:00" note="From the unit at Attercliffe. No minimum on collection" />
            </SpecList>
          </div>
          <div>
            <SectionHeader eyebrow="Paperwork" title="The things a buyer will be asked for"
              description="All downloadable rather than requested by email and sent when somebody gets round to it." />
            <div className="mt-6 space-y-3">
              <DownloadCard name="Price list — August 2026.pdf" size={1_840_000}
                description="Full range, trade prices, case and pallet breaks" href="#/range" />
              <DownloadCard name="Account application.pdf" size={210_000}
                description="Two pages. Trade references and a VAT number" href="#/account" />
              <DownloadCard name="Allergen and specification pack.zip" size={6_200_000}
                description="Spec sheets for every own-label line" href="#/range" />
              <DownloadCard name="Food hygiene certificate.pdf" size={140_000}
                description="Rated 5, inspected March 2026" href="#/account" />
              <DownloadCard name="Public and product liability.pdf" size={95_000}
                description="£10m and £5m, renewed January" href="#/account" />
            </div>
            <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
              If your own auditor wants something not on this list, email and it comes back the same
              day. We have been through enough BRC audits with customers to have most of it ready.
            </p>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="max-w-3xl">
            <SectionHeader eyebrow="Asked often" title="Before you apply" />
            <Faq className="mt-6" items={[
              { question: "Why is there a minimum at all?", answer: "A van drop costs us about £22 whatever is on it. Below £150 the order loses money, and pretending otherwise would mean putting the price up for everybody who orders properly." },
              { question: "What if I only want £80 of stock?", answer: "Collect it — there is no minimum on collection and the unit is open seven to four, Monday to Friday. Or order fortnightly, which is what most small cafés do." },
              { question: "Do I have to have an account?", answer: "To have it delivered, yes, and it takes two working days. To collect and pay by card, no — turn up with a VAT number or a food business registration and buy at the same prices." },
              { question: "Are your prices negotiable?", answer: "No, and that is deliberate. One price list, published, so a two-site café pays what a twelve-site group pays. Negotiated pricing means somebody is being overcharged to fund somebody else's discount." },
              { question: "How quickly can I get an emergency order?", answer: "Collection, same hour. Delivery, only on the next van — Tuesday or Thursday. We do not do special runs and any supplier who says they will is either charging you for it or about to let you down." },
              { question: "Do you deliver outside South Yorkshire?", answer: "No. Two vans, two days, and a radius we can actually serve. Beyond that we will give you the number of a wholesaler who covers it properly." },
            ]} />
          </div>
        </div>
      </section>
    </SiteChrome>
  );
}
