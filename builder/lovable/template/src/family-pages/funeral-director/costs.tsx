// funeral-director /costs — every price, itemised, with nothing hidden inside a
// package. The whole family rests on this page: asking what a funeral costs is
// the thing a bereaved person cannot bring themselves to do, so it is answered
// before anybody has to ask.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Faq } from "@/components/ui/faq";
import { PriceList } from "@/components/ui/price-list";
import { SectionHeader } from "@/components/ui/section-header";
export const Route = createFileRoute("/costs")({ component: P });
function P() {
  return (
    <SiteChrome name="Hartley & Vane" tagline="An independent funeral director in Walkley, Sheffield, since 1954."
      links={[{ label: "Home", href: "/" }, { label: "Planning ahead", href: "/plan" }]}
      action={{ label: "Call 0114 234 1954", href: "tel:01142341954" }}>

      <div className="mx-auto max-w-5xl px-6 py-14">
        <SectionHeader eyebrow="What it costs" title="Every price, in full"
          description="Three funerals, then everything that can be added to any of them, then the fees other people charge that we pay on your behalf. Nothing on this page is bundled and nothing is left out." />

        <section className="mt-12">
          <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">The three funerals</h2>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-muted-foreground">
            These are our charges only. The crematorium, the doctors and the minister charge
            separately and are listed further down at exactly what they cost us.
          </p>
          <PriceList className="mt-4" items={[
            { name: "Direct cremation", price: 1395, meta: "No service", description: "We collect them, care for them, and take them to the crematorium at a time the crematorium chooses. Nobody attends. Ashes back to you within a week." },
            { name: "Simple funeral", price: 2150, meta: "Most families", description: "A service at the crematorium or a church, at a time you pick. Hearse, four bearers, a coffin, and someone from here with you all day." },
            { name: "Full funeral", price: 3100, meta: "With cars", description: "As the simple funeral, plus a limousine for the family, printed orders of service, a notice in the Star, and flowers on the coffin." },
          ]} />
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Add anything to any of them</h2>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-muted-foreground">
            None of these are compulsory and nobody will suggest them to you on the day. If you want
            one, ask.
          </p>
          <PriceList className="mt-4" items={[
            { name: "Limousine", price: 260, meta: "Each, up to 6 people", description: "One is usually enough. Plenty of families use their own cars and it makes no difference to anything." },
            { name: "Extra bearers", price: 40, meta: "Each", description: "Four is standard. Family often want to carry, which costs nothing and is usually the right thing." },
            { name: "Embalming", price: 165, description: "Only needed if there will be a long wait or a viewing after several days. We will tell you plainly whether it is needed rather than offering it as standard." },
            { name: "Order of service", price: 1.9, meta: "Per copy, min 50", description: "Printed here. Send us the photographs and words and we will lay it out." },
            { name: "Notice in the Sheffield Star", price: 95, meta: "Approx", description: "Priced by them by the line. We pass on what they charge." },
            { name: "Flowers on the coffin", price: 140, meta: "From", description: "From Sylvia on Howard Road, who does ours. You can use your own florist and we will collect." },
            { name: "Live-streaming the service", price: 0, meta: "Free at most crematoria", description: "Sheffield's crematoria include it. We will not charge you to press a button." },
            { name: "Ashes casket", price: 55, meta: "From", description: "A plain scatter tube is included at no cost and is what most families use." },
          ]} />
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Coffins</h2>
          <PriceList className="mt-4" items={[
            { name: "Shroud", price: 95, description: "Permitted at every crematorium in Sheffield and at both natural burial grounds. It is the cheapest option by a distance and nobody will think anything of it." },
            { name: "Cardboard", price: 180, description: "Plain, or one you and the family can write on and draw on, which some people find helps." },
            { name: "Willow or seagrass", price: 690, description: "Woven, and the usual choice for a natural burial." },
            { name: "Veneered oak or elm", price: 420, description: "What most people picture. Chipboard core with a real veneer." },
            { name: "Solid oak", price: 1250, description: "Solid timber throughout. We will say honestly that at a cremation nobody sees the difference." },
          ]} />
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Fees other people charge</h2>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-muted-foreground">
            We pay these for you and pass them on at cost with the receipts attached. We add nothing
            to any of them and we never have.
          </p>
          <PriceList className="mt-4" items={[
            { name: "Sheffield crematorium fee", price: 1042, meta: "City Road or Grenoside", description: "Reduced for a service before 10am or after 3pm, and free for anybody under 18." },
            { name: "Burial in a new grave", price: 2340, meta: "Council cemeteries", description: "Includes the exclusive right of burial. A second interment in an existing grave is £1,120." },
            { name: "Natural burial", price: 1450, meta: "From", description: "At Wisewood Meadow or Ecclesfield. No headstone, a tree instead, and a plot you can walk to." },
            { name: "Medical examiner", price: 0, meta: "No charge", description: "Statutory review of the cause of death. There has been no fee for this since 2024." },
            { name: "Minister or celebrant", price: 250, meta: "Typical", description: "Set by them. A humanist celebrant is usually £250–£320, a Church of England vicar £220." },
            { name: "Doctor's certificate for cremation", price: 0, meta: "No charge", description: "Abolished with the medical examiner reforms. Some directors still list it; there is nothing to pay." },
          ]} />
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="rounded-xl border border-border bg-muted/50 p-7">
            <h2 className="text-2xl font-semibold tracking-tight">If the money is the problem</h2>
            <div className="mt-4 space-y-4 text-base leading-relaxed text-muted-foreground">
              <p>
                Say so at the start. Not at the end, when a bill arrives and it is too late to have
                arranged it differently — at the start, on the phone, before we have met.
              </p>
              <p>
                There is a government Funeral Expenses Payment for people on certain benefits, worth
                up to £1,000 towards our fees and the full cost of the cremation or burial. We will
                fill the form in with you. It is applied for after the funeral, which is why it is
                worth telling us first.
              </p>
              <p>
                The council also has a public health funeral for anybody with no family and no money.
                It is a real funeral with a real service and we will explain it without embarrassment.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="max-w-3xl">
            <SectionHeader eyebrow="Asked often" title="About the bill" />
            <Faq className="mt-6" items={[
              { question: "When do I pay?", answer: "The account comes about a fortnight after the funeral, payable within thirty days. The third-party fees — crematorium, minister — we ask for up front where we can, because we are paying them on your behalf." },
              { question: "Do you take a deposit?", answer: "Not from families we have arranged for before, and not where the estate will clearly cover it. Otherwise we ask for the disbursements only, never our own fee." },
              { question: "Can it be paid from the estate?", answer: "Yes. Most banks release funeral costs directly to us from the deceased's account before probate, on production of our invoice and the death certificate. We will send the invoice straight to them if it is easier." },
              { question: "Will the price change after we have agreed it?", answer: "Only if you change something. We write the whole figure down at the arrangement meeting, including the third-party fees, and that is the figure on the account." },
              { question: "Why are your prices on the website when most are not?", answer: "Because the Competition and Markets Authority made it compulsory in 2021, and because it was the right thing to do for about seventy years before that." },
            ]} />
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
