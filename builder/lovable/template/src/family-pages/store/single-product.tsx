// store / single-product — the whole site sells ONE thing. Not a shop front
// with one item in it: there is no grid, no categories and no browsing, because
// there is nothing to browse between. The long product story IS the homepage
// and the buy moment sits at the bottom of it and again at the top.
import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { AddToCart } from "@/components/ui/add-to-cart";
import { Faq } from "@/components/ui/faq";
import { PriceTag } from "@/components/ui/price-tag";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { StockBadge } from "@/components/ui/stock-badge";
import { Testimonial } from "@/components/ui/testimonial";
export const Route = createFileRoute("/single-product")({ component: P });
export const STORY = [
  {
    head: "It is one pan",
    body: "Twenty-six centimetres, three millimetres of carbon steel, one piece of steel folded into a handle. No coating to wear off, no rivets to work loose, no plastic anywhere. It is the pan a kitchen uses for everything and replaces never.",
    alt: "The pan, from above",
  },
  {
    head: "Made in Sheffield, by four people",
    body: "Pressed, spun and hand-finished in a workshop on Effingham Road. The steel comes from Rotherham, eleven miles away. Nothing about it is assembled anywhere else and nothing about it is a story we bought.",
    alt: "Spinning the blank",
  },
  {
    head: "It arrives raw, and that is deliberate",
    body: "A pre-seasoned pan is one somebody sprayed for you. Yours comes bare with half an hour of instructions, because the layer you build is better than the layer we could, and because you will know how to fix it in three years.",
    alt: "Seasoning, first coat",
  },
  {
    head: "Guaranteed for twenty-five years",
    body: "Not a returns policy — a guarantee. If it warps, cracks or the handle fails, we replace it. In nine years we have replaced four, and two of those were dropped down a fire escape.",
    alt: "The stamp on the handle",
  },
];
function P() {
  const [qty, setQty] = React.useState(1);
  return (
    <SiteChrome name="Effingham No. 26" tagline="One carbon steel pan, made in Sheffield."
      links={[{ label: "The pan", href: "#/product" }, { label: "Basket", href: "#/checkout" }]}
      action={{ label: "Buy — £84", href: "#buy" }}>

      {/* NO GRID AND NO CATEGORY NAV. Both are in the base family's component
          list and both are wrong here: there is nothing to browse between, and
          a nav offering "shop all" to a shop of one is a joke at the visitor's
          expense. */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid items-center gap-12 lg:grid-cols-[1fr_1fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Made in Sheffield · 25-year guarantee · one product, since 2017</p>
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance sm:text-6xl">
                We make one pan
              </h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                Carbon steel, 26cm, one piece. It is the only thing we have ever made and the only
                thing we are going to make, which is why it is as good as it is.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-5">
                <PriceTag price={84} />
                <StockBadge quantity={38} />
              </div>
              <div id="buy" className="mt-6 max-w-xs">
                <AddToCart quantity={qty} onQuantity={setQty} onAdd={() => {}} />
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                Free delivery in the UK, dispatched next working day. Thirty days to send it back
                for any reason, including having changed your mind.
              </p>
            </div>
            <SafeImage src={null} alt="Effingham No. 26" ratio="1/1" />
          </div>
        </div>
      </section>

      {/* THE LONG STORY DOWN THE PAGE — this is the variant. A grid page has
          nowhere to put any of this; a one-product page has nothing else to do
          with the space. */}
      <section className="mx-auto max-w-6xl px-6 py-14">
        <div className="space-y-16">
          {STORY.map((s, i) => (
            <article key={s.head} className={`grid items-center gap-10 lg:grid-cols-2 ${i % 2 ? "lg:[&>*:first-child]:order-2" : ""}`}>
              <div>
                <h2 className="text-3xl font-semibold tracking-tight text-balance">{s.head}</h2>
                <p className="mt-4 max-w-prose text-lg leading-relaxed text-muted-foreground">{s.body}</p>
              </div>
              <SafeImage src={null} alt={s.alt} ratio="4/3" fallbackSeed={s.head} />
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <SectionHeader eyebrow="Nine years of it" title="What people say after a year, not after a week"
            description="We only ask for a review twelve months in. A pan is easy to like in week one." />
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <Testimonial item={{ quote: "Four years in and it is black as a bible and slicker than anything with a coating I ever owned. I have thrown out three non-stick pans in that time.", name: "Marek", role: "Bought 2022" }} />
            <Testimonial item={{ quote: "The instructions told me it would look terrible for a month. It did, and then it stopped, exactly as they said.", name: "Cerys", role: "Bought 2025" }} />
            <Testimonial item={{ quote: "Handle came loose after a house move — turned out I had put it through a dishwasher. They replaced it anyway and told me not to do that again.", name: "Fola", role: "Bought 2019" }} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-14">
        <SectionHeader eyebrow="Before you buy" title="The awkward questions"
          description="A shop with one product has nowhere to hide, which is a good discipline." />
        <Faq className="mt-6" items={[
          { question: "Is it non-stick?", answer: "It becomes non-stick, after about a month of use. Out of the box it is bare steel and eggs will stick to it. If you want something non-stick tonight, buy something else — genuinely." },
          { question: "Can it go in the dishwasher?", answer: "No, and it will rust within a day if it does. Hot water, a brush, dry it on the hob. About thirty seconds." },
          { question: "Induction, gas, oven?", answer: "All three, plus a campfire. There is no plastic and no coating, so there is no temperature it cannot take." },
          { question: "Why only one size?", answer: "Because a second size means a second set of tooling and a second set of compromises, and 26cm is the one that does the most jobs. We have been asked for a 20cm for nine years and we still say no." },
          { question: "What if I hate it?", answer: "Send it back within thirty days, used, seasoned, whatever state it is in. We refund the lot including the postage you paid." },
        ]} />
        <div className="mt-10 max-w-xs">
          <AddToCart quantity={qty} onQuantity={setQty} onAdd={() => {}} />
        </div>
      </section>
    </SiteChrome>
  );
}
