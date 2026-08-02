// marketplace /sell — the other side in full. The fees are the page: a maker
// deciding between platforms is comparing percentages and payout terms, and
// every site in this trade makes them dig for both.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { ContactForm } from "@/components/ui/contact-form";
import { Faq } from "@/components/ui/faq";
import { PriceList } from "@/components/ui/price-list";
import { SectionHeader } from "@/components/ui/section-header";
import { SellerCard } from "@/components/ui/seller-card";
import { StatsBand } from "@/components/ui/stats-band";
import { Steps } from "@/components/ui/steps";
import { MAKERS } from "./index";
export const Route = createFileRoute("/sell")({ component: P });
function P() {
  return (
    <SiteChrome name="Made Round Here" tagline="A marketplace for things made within fifty miles of Sheffield."
      links={[{ label: "Home", href: "#/" }, { label: "Browse", href: "#/browse" }]}
      action={{ label: "Start selling", href: "#form" }}>

      <div className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="Sell with us" title="6% when it sells, and nothing else"
          description="No listing fee, no monthly fee, no paid placement, and no clause stopping you selling anywhere else. The whole arrangement is on this page." />

        <StatsBand className="mt-8" items={[
          { value: "6%", label: "When it sells" },
          { value: "£0", label: "To list" },
          { value: "3 days", label: "To get paid" },
          { value: "0", label: "Exclusivity clauses" },
        ]} />

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="The fees" title="Every charge there is"
            description="This is the complete list. If a charge is not here, it does not exist — and we will not invent one without telling every seller a month ahead." />
          <div className="mt-6 grid gap-x-12 gap-y-8 lg:grid-cols-2">
            <PriceList items={[
              { name: "Commission", price: "6%", meta: "When something sells", description: "Card processing is inside this, not on top. A £68 board pays £4.08 and you keep £63.92." },
              { name: "Listing", price: 0, meta: "Free", description: "As many as you like, up and down whenever you like. Photographs are yours and we do not touch them." },
              { name: "Monthly fee", price: 0, meta: "There isn't one", description: "This line is here because everybody asks — the big platforms charge one and we do not." },
              { name: "Paid placement", price: 0, meta: "Not for sale", description: "Search order is by relevance and rating. You cannot buy your way up it and neither can anybody else." },
            ]} />
            <PriceList items={[
              { name: "Payout", price: 0, meta: "Three working days", description: "After it arrives with the buyer. Straight to your bank, no minimum threshold." },
              { name: "Refunds", price: 0, meta: "We cover the fee", description: "If an order is refunded you get the 6% back too. Charging commission on a sale that unwound is indefensible." },
              { name: "Leaving", price: 0, meta: "No notice", description: "Delete your listings whenever. We will export your order history and your customer addresses the same day." },
              { name: "Photography", price: 45, meta: "Optional, half a day", description: "Only if you want it. Ross comes to your workshop and the pictures are yours to use anywhere, including on a rival site." },
            ]} />
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="Getting started" title="About twenty minutes for the first listing"
            description="Photographs are the slow bit. Everything else is a price, a lead time and a paragraph." />
          <Steps className="mt-8" items={[
            { title: "Tell us what you make", description: "One form. We check you are within fifty miles and that you make the things yourself — that is the only rule." },
            { title: "List the first thing", description: "Four photographs, a price, a lead time. Twenty minutes for the first and about two for the ones after." },
            { title: "We start sending buyers", description: "Search, the browse page and the Thursday email. Nothing is paid placement, so it takes a week or two to build." },
          ]} />
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr]">
            <div id="form">
              <SectionHeader eyebrow="Apply" title="Tell us what you make and where"
                description="A person reads these — usually Ruth, usually the same week. There is no automated onboarding sequence." />
              <ContactForm className="mt-6" askPhone onSubmit={() => {}} />
            </div>
            <div>
              <SectionHeader eyebrow="Asked often" title="Before you apply" />
              <Faq className="mt-6" items={[
                { question: "Do I have to make everything myself?", answer: "Yes, or with people you employ in your own workshop. Reselling bought-in goods is the one thing that gets a seller removed, and it happens two or three times a year." },
                { question: "What counts as within fifty miles?", answer: "Fifty miles from Sheffield city centre, measured to your workshop. Bakewell, Barnsley, Doncaster and Chesterfield are all in; Leeds is on the line and we say yes." },
                { question: "Can I set my own prices?", answer: "Entirely, including higher than you charge elsewhere. We will never run a sale on your work without asking you first." },
                { question: "Who handles postage?", answer: "You do, in your own packaging. We show your postage cost on the listing rather than hiding it until checkout." },
                { question: "What if a buyer is difficult?", answer: "Send them to us. We settle it and, where the buyer is plainly wrong, we cover the refund ourselves rather than taking it out of your payment." },
                { question: "Is there a waiting list?", answer: "Not usually. Applications are read weekly and about four in five are accepted — the ones that are not are almost always outside the radius." },
              ]} />
            </div>
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="Already here" title="Some of the people you would be joining" />
          <div className="mt-8 grid gap-x-10 gap-y-8 md:grid-cols-2 lg:grid-cols-3">
            {MAKERS.map((m) => <SellerCard key={m.name} {...m} href="#/browse" />)}
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
