// taxi /account — the other customer. A firm's account work is booked by
// somebody who is not travelling, paid monthly, and chosen on reliability
// rather than price, so the page answers different questions entirely.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { ContactForm } from "@/components/ui/contact-form";
import { Faq } from "@/components/ui/faq";
import { PriceList } from "@/components/ui/price-list";
import { SectionHeader } from "@/components/ui/section-header";
import { Steps } from "@/components/ui/steps";
import { Testimonial } from "@/components/ui/testimonial";
import { TrustStrip } from "@/components/ui/trust-strip";
export const Route = createFileRoute("/account")({ component: P });
function P() {
  return (
    <SiteChrome name="Hallam Cars" tagline="Private hire in Sheffield, 24 hours, licensed by the council."
      links={[{ label: "Home", href: "#/" }, { label: "Fixed fares", href: "#/fares" }]}
      action={{ label: "0114 266 2626", href: "tel:01142662626" }}>

      <div className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="Accounts" title="For the person booking, not the person travelling"
          description="One monthly invoice, a reference on every job, and no card handed to a driver. Free to open and there is no minimum spend." />

        <TrustStrip className="mt-10" items={[
          { title: "One invoice a month", description: "Itemised by reference and cost centre" },
          { title: "No minimum spend", description: "Two journeys a month is a real account" },
          { title: "30 days to pay", description: "Not 14, and no fee for a late one" },
        ]} />

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="Who has one" title="Four kinds of account, and they want different things"
            description="Which one you are decides what actually matters, so we set them up differently." />
          <div className="mt-8 grid gap-x-10 gap-y-8 md:grid-cols-2">
            {[
              ["Offices and firms", "Client runs, station pickups, the late one home. Cost centre on every job so it lands on the right budget, and a named contact who can book without a card."],
              ["Schools and councils", "Contracted runs, the same driver every day, enhanced DBS on file and a copy sent to you. We hold the risk assessment and the vehicle checks."],
              ["Hospitals and care", "Discharge and appointment runs, wheelchair accessible where needed, and drivers who will wait rather than ring once and go."],
              ["Hotels and venues", "A phone number your reception can ring at any hour and a car within ten minutes, charged to you or to the guest — your choice, per job."],
            ].map(([k, v]) => (
              <div key={k} className="border-t border-border pt-5">
                <h3 className="text-xl font-medium tracking-tight">{k}</h3>
                <p className="mt-2 text-base leading-relaxed text-muted-foreground">{v}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="What it costs" title="The same fares, and nothing added for having an account"
            description="An account is a way of paying, not a tariff. The only difference is the invoice." />
          <div className="mt-6 max-w-3xl">
            <PriceList items={[
              { name: "Journey fares", price: 0, meta: "Same as anybody", description: "Metered in the city, fixed everywhere else. Exactly the prices on the fares page." },
              { name: "Opening an account", price: 0, meta: "Free", description: "One form and a trade reference. Usually live the same week." },
              { name: "Monthly invoice", price: 0, meta: "Free", description: "Itemised: date, passenger, from, to, reference, cost centre. CSV as well as PDF if you want it." },
              { name: "Volume discount", price: 0, meta: "Over £1,500 a month", description: "5% off the whole invoice, applied automatically. We will not ask you to negotiate it." },
              { name: "Contracted runs", price: 0, meta: "Quoted", description: "The same journey every day at a fixed rate, usually below the fare. Priced against the round, not per job." },
            ]} />
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr]">
            <div>
              <SectionHeader eyebrow="Opening one" title="A form and a reference"
                description="Kath sets these up. Usually live within three working days, and you can book by phone from the first hour." />
              <Steps className="mt-6" items={[
                { title: "Tell us who you are", description: "The company, who can book, and where invoices go. One trade reference or a year's filed accounts." },
                { title: "We set the account up", description: "Reference codes and cost centres however you want them. You get a booking number that skips the queue." },
                { title: "Book by phone, email or the app", description: "No card, ever. A confirmation with the reference on it goes to whoever booked." },
              ]} />
              <ContactForm className="mt-8" askPhone onSubmit={() => {}} />
            </div>
            <div>
              <SectionHeader eyebrow="Asked often" title="Before you open one" />
              <Faq className="mt-6" items={[
                { question: "Is there a minimum spend?", answer: "None. Our smallest account is a solicitor who books about two journeys a month, and it is worth having because neither of us wants a card at the kerb." },
                { question: "Can we cap what staff spend?", answer: "Per journey, per person or per month, and we will refuse anything over it rather than bill you and argue later." },
                { question: "Do we get the same driver?", answer: "On a contracted run, yes, and the same named backup. On ad-hoc jobs it is whoever is nearest, which is what makes it ten minutes." },
                { question: "What about DBS?", answer: "Every driver is enhanced-DBS checked and council licensed. We will send you the certificates for the drivers on a school or care contract without being asked." },
                { question: "How do we cancel?", answer: "An email. No notice period, no termination clause, and we will invoice what you have used and nothing else." },
              ]} />
              <Testimonial className="mt-8" item={{ quote: "Twelve years of accounts with them. One invoice, always right, and when a driver got a client to Manchester through the snow nobody rang us to renegotiate the fare.", name: "Priya Raval", role: "Office manager, a law firm in the city centre" }} />
            </div>
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
