// store/single-product /product — the same object, told as a SPECIFICATION
// rather than as a story. On a shop of one the homepage has already done the
// persuading, so this page is for the reader who is nearly convinced and wants
// numbers: dimensions, weight, materials, care, and what it will not do.
import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { AddToCart } from "@/components/ui/add-to-cart";
import { Faq } from "@/components/ui/faq";
import { Gallery } from "@/components/ui/gallery";
import { PriceTag } from "@/components/ui/price-tag";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { StockBadge } from "@/components/ui/stock-badge";
export const Route = createFileRoute("/product")({ component: P });
const SPEC = [
  ["Diameter", "26cm at the rim, 20cm across the base"],
  ["Depth", "5.2cm"],
  ["Weight", "1.42kg"],
  ["Thickness", "3mm, the same at the base and the walls"],
  ["Material", "AISI 1018 carbon steel, from Rotherham"],
  ["Handle", "One piece with the body — no rivets, no join"],
  ["Finish", "Bare. No coating, no pre-seasoning"],
  ["Oven", "To any temperature. There is nothing in it to melt"],
  ["Hob", "Induction, gas, electric, halogen, open fire"],
  ["Made", "Effingham Road, Sheffield S4"],
];
function P() {
  const [qty, setQty] = React.useState(1);
  return (
    <SiteChrome name="Effingham No. 26" tagline="One carbon steel pan, made in Sheffield."
      links={[{ label: "Home", href: "#/" }, { label: "Basket", href: "#/checkout" }]}
      action={{ label: "Buy — £84", href: "#buy" }}>

      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <SafeImage src={null} alt="Effingham No. 26, seasoned" ratio="4/3" />
            <Gallery className="mt-4" columns={4} items={[
              { src: null, alt: "New, out of the box" },
              { src: null, alt: "After one month" },
              { src: null, alt: "After four years" },
              { src: null, alt: "The handle join" },
            ]} />
            <p className="mt-3 text-sm text-muted-foreground">
              The same pan at a week, a month and four years old. Nobody photographs the middle one
              and it is the one that puts people off, so it is here.
            </p>
          </div>

          <div>
            <h1 className="text-4xl font-semibold tracking-tight">Effingham No. 26</h1>
            <p className="mt-2 text-lg text-muted-foreground">26cm carbon steel frying pan, one piece</p>
            <div className="mt-6 flex flex-wrap items-center gap-5">
              <PriceTag price={84} size="lg" />
              <StockBadge quantity={38} />
            </div>
            {/* NO OPTIONS PICKER. There is one size, one finish and one
                configuration — a variant selector with a single choice in it is
                furniture pretending to be a decision. */}
            <div id="buy" className="mt-6 max-w-xs">
              <AddToCart quantity={qty} onQuantity={setQty} onAdd={() => {}} />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Free UK delivery, dispatched next working day. Thirty days to return it in any state.
            </p>

            <h2 className="mt-10 text-sm font-medium uppercase tracking-widest text-muted-foreground">Specification</h2>
            <dl className="mt-3 divide-y divide-border border-y border-border text-sm">
              {SPEC.map(([k, v]) => (
                <div key={k} className="grid grid-cols-[8rem_1fr] gap-4 py-2.5">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>

            <h2 className="mt-10 text-sm font-medium uppercase tracking-widest text-muted-foreground">What it will not do</h2>
            <ul className="mt-3 divide-y divide-border border-y border-border text-sm">
              <li className="py-2.5">Come out of the box non-stick. That takes about a month of cooking.</li>
              <li className="py-2.5">Survive a dishwasher. One cycle and it rusts.</li>
              <li className="py-2.5">Stay looking new. It goes patchy brown, then black, and the black is the point.</li>
              <li className="py-2.5">Cook an acidic sauce for an hour without stripping some seasoning. Use something else for a ragù.</li>
              <li className="py-2.5">Weigh less. 1.42kg is what 3mm of steel weighs, and the weight is why it holds heat.</li>
            </ul>
          </div>
        </div>

        <section className="mt-14 border-t border-border pt-10">
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr]">
            <div>
              <SectionHeader eyebrow="Care" title="Thirty seconds, every time"
                description="This is the whole maintenance regime. Anybody telling you it is more complicated is selling a product to clean it with." />
              <ol className="mt-6 divide-y divide-border border-y border-border text-base">
                <li className="py-3"><span className="font-medium">Hot water and a brush.</span> Washing-up liquid is fine, whatever the internet says.</li>
                <li className="py-3"><span className="font-medium">Dry it on the hob.</span> Thirty seconds on a low flame. This is the step people skip and it is the one that matters.</li>
                <li className="py-3"><span className="font-medium">A smear of oil while warm.</span> Half a teaspoon, wiped almost all off.</li>
                <li className="py-3"><span className="font-medium">If it rusts, scrub it back.</span> Steel wool, re-season, carry on. Nothing about rust is fatal here.</li>
              </ol>
            </div>
            <div>
              <SectionHeader eyebrow="Asked often" title="About the pan itself" />
              <Faq className="mt-6" items={[
                { question: "Why 3mm and not 2?", answer: "Thin carbon steel warps on an induction hob and loses heat the moment food hits it. 3mm does neither, and it is why this weighs what it does." },
                { question: "Is carbon steel the same as cast iron?", answer: "Same seasoning, half the weight, and it heats far more evenly. It is what restaurant kitchens use and cast iron is not." },
                { question: "Do I need a special oil?", answer: "No. Any neutral oil with a high smoke point. Flaxseed makes a hard layer that chips; sunflower is what we use." },
                { question: "What if I wreck the seasoning?", answer: "You cannot wreck it permanently. Scrub back to bare steel and start again — that is the whole advantage over a coating." },
              ]} />
            </div>
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
