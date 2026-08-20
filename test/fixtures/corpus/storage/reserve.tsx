// storage /reserve — pick the unit and the start date. The free/taken state
// from the home page repeats here, because "which one" and "is it still there"
// are the same question and sending somebody back for the answer loses them.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { ContactForm } from "@/components/ui/contact-form";
import { Faq } from "@/components/ui/faq";
import { PriceList } from "@/components/ui/price-list";
import { SectionHeader } from "@/components/ui/section-header";
import { TrustStrip } from "@/components/ui/trust-strip";
import { UnitCard } from "@/components/ui/unit-card";
export const Route = createFileRoute("/reserve")({ component: P });
function P() {
  return (
    <SiteChrome name="Neepsend Self Store" tagline="Self-storage in a former steel works, five minutes from Sheffield city centre."
      links={[{ label: "Home", href: "/" }, { label: "Size guide", href: "/sizes" }]}
      action={{ label: "Reserve a unit", href: "#form" }}>

      <div className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="Reserve" title="Hold one for a fortnight, free"
          description="No card, no deposit, no obligation. We take it off the board for two weeks and if you do not turn up it goes back on — that is the whole arrangement." />

        <TrustStrip className="mt-10" items={[
          { title: "Free to hold", description: "Fourteen days, no card details" },
          { title: "Move in the same day", description: "If the unit is empty, it is yours" },
          { title: "Cancel by text", description: "We will not ring you about it" },
        ]} />

        <section className="mt-14">
          <SectionHeader eyebrow="Pick one" title="What is free this morning"
            description="Straight off the board in the office. A size showing none free has none — the waiting list is real and it usually moves inside a month." />
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <UnitCard size="Locker" dimensions="1.2m × 1.2m × 1.5m" price={22} available={7}
              fits="Paperwork, a few boxes, a bike with the front wheel off." />
            <UnitCard size="25 sq ft" dimensions="1.5m × 1.5m × 2.4m" price={38} available={3}
              fits="A studio flat's worth — a single bed, a wardrobe, fifteen boxes." />
            <UnitCard size="50 sq ft" dimensions="2.3m × 2.0m × 2.4m" price={58} available={1}
              fits="A one-bed flat, or a motorbike and the rest of a garage." />
            <UnitCard size="75 sq ft" dimensions="3.0m × 2.3m × 2.4m" price={79} available={4}
              fits="A two-bed house, or the contents of a small shop." />
            <UnitCard size="125 sq ft" dimensions="4.6m × 2.5m × 2.4m" price={124} available={0}
              fits="A three or four-bed house, including the garden furniture and the loft." />
            <UnitCard size="Container" dimensions="6.0m × 2.4m × 2.6m" price={165} available={2}
              fits="A four-bed house with room left, or a car off the road for the winter." />
          </div>
        </section>

        <section id="form" className="mt-14 border-t border-border pt-10">
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr]">
            <div>
              <SectionHeader eyebrow="Tell us" title="Which size and roughly when"
                description="Somebody in the office reads these, usually within the hour during opening times. There is no automated sequence and nobody will ring you twice." />
              <ContactForm className="mt-6" askPhone onSubmit={() => {}} />
            </div>
            <div>
              <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">What happens next</h2>
              <ol className="mt-4 divide-y divide-border border-y border-border text-base">
                <li className="py-3"><span className="font-medium">We reply</span> — confirming the size is there and holding it for fourteen days.</li>
                <li className="py-3"><span className="font-medium">You come in</span> — bring one photo ID and one proof of address. That is the only paperwork.</li>
                <li className="py-3"><span className="font-medium">Pay the first month</span> — card or bank transfer, no deposit, no admin fee.</li>
                <li className="py-3"><span className="font-medium">Buy a padlock, or bring one</span> — £9 in the office, and we never hold a key.</li>
                <li className="py-3"><span className="font-medium">Move in</span> — trolleys, the pallet truck and the loading bay are all free and need no booking.</li>
              </ol>

              <h2 className="mt-10 text-sm font-medium uppercase tracking-widest text-muted-foreground">The only extras</h2>
              <PriceList className="mt-3" items={[
                { name: "Padlock", price: 9, description: "Closed-shackle, the kind that cannot be cut easily. Bring your own if you would rather." },
                { name: "Extra insurance", price: 4, meta: "Per £5,000 a month", description: "The first £5,000 is in the price. Check your home policy first — it often covers goods in storage already." },
                { name: "Boxes and tape", price: 0, meta: "At cost", description: "We do not make anything on these and we will take back the ones you do not use." },
                { name: "Admin fee", price: 0, meta: "There isn't one", description: "No sign-up fee, no exit fee, no deposit. This line is here because everybody asks." },
              ]} />
            </div>
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="max-w-3xl">
            <SectionHeader eyebrow="Asked often" title="Before you reserve" />
            <Faq className="mt-6" items={[
              { question: "What ID do I need?", answer: "One photo ID and one proof of address dated within three months. A driving licence and a bank statement is the usual pair." },
              { question: "Can somebody else access my unit?", answer: "Only if you give them the gate code and a key to your padlock. We cannot let anybody in, including you, because we do not hold a key." },
              { question: "What if I need it for one week?", answer: "The minimum charge is a month, but we refund the unused days when you leave. A week costs about £14 in a locker once the refund lands." },
              { question: "Do you take business customers?", answer: "About a third of the site is trade. We will sign for deliveries during office hours at no charge." },
              { question: "Is it damp?", answer: "The ground floor is a former steel works and it is dry, but it is not heated. Anything upholstered wants a cover, and paper wants to be off the floor on a pallet." },
            ]} />
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
