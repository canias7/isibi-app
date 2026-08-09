// store — one product told fully. Pictures on the left, the decision on the
// right: price with the was-price honest, stock said plainly, the glaze
// choice, quantity, and the add. Everything after the fold answers the
// questions that stop a purchase — size, care, post, returns.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { AddToCart } from "@/components/ui/add-to-cart";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { CartBadge } from "@/components/ui/cart-badge";
import { Gallery } from "@/components/ui/gallery";
import { PriceTag } from "@/components/ui/price-tag";
import { ProductCard } from "@/components/ui/product-card";
import { SectionHeader } from "@/components/ui/section-header";
import { StockBadge } from "@/components/ui/stock-badge";
export const Route = createFileRoute("/product")({ component: P });

const GLAZES = ["Oat", "Storm", "Gloss black"] as const;

function P() {
  const [glaze, setGlaze] = useState<(typeof GLAZES)[number]>("Oat");
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  return (
    <SiteChrome name="Slipware" tagline="Small-batch stoneware, thrown in Leith."
      links={[{ label: "The range", href: "/" }, { label: "Basket", href: "/checkout" }]}
      action={{ label: "Checkout", href: "/checkout" }}>

      <section className="mx-auto max-w-5xl px-6 py-12">
        <a className="text-sm text-muted-foreground underline-offset-4 hover:underline" href="/">← Back to the range</a>
        <div className="mt-6 grid gap-10 md:grid-cols-[3fr_2fr]">
          <Gallery columns={2} items={[
            { src: null, alt: "Dimpled mug, oat glaze, in the morning light" },
            { src: null, alt: "The dimple — where a thumb goes" },
            { src: null, alt: "Four of them stacked, because they stack" },
            { src: null, alt: "The base, stamped and sanded smooth" },
          ]} />

          {/* The decision column — price, stock, options, the add. */}
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">This month's piece</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">The dimpled mug</h1>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <PriceTag price={28} size="lg" />
              <StockBadge quantity={7} />
            </div>
            <p className="mt-4 text-muted-foreground">350ml — a proper flat white with room for the crema. The dimple lands where your thumb already wanted to be. Dishwasher-hardy glaze; the handle takes three fingers.</p>

            <div className="mt-6">
              <p className="text-sm font-medium">Glaze — {glaze}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {GLAZES.map((g) => (
                  <Button key={g} size="sm" variant={g === glaze ? "default" : "outline"} onClick={() => setGlaze(g)}>{g}</Button>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <AddToCart quantity={qty} onQuantity={setQty} onAdd={() => setAdded(true)} />
              {added && (
                <p className="mt-3 text-sm">
                  In the basket — {qty} × {glaze.toLowerCase()}.{" "}
                  <a className="font-medium underline underline-offset-4" href="/checkout">Checkout →</a>
                </p>
              )}
              <div className="mt-4"><CartBadge count={added ? 2 + qty : 2} href="/checkout" /></div>
            </div>

            <Accordion type="single" collapsible className="mt-8">
              <AccordionItem value="size">
                <AccordionTrigger>Size and weight</AccordionTrigger>
                <AccordionContent>9cm tall, 8.5cm across, 310g empty. Holds 350ml to a sensible brim.</AccordionContent>
              </AccordionItem>
              <AccordionItem value="care">
                <AccordionTrigger>Living with it</AccordionTrigger>
                <AccordionContent>Dishwasher and microwave fine. The unglazed base softens with use — that's the stoneware, not a fault.</AccordionContent>
              </AccordionItem>
              <AccordionItem value="post">
                <AccordionTrigger>Post and returns</AccordionTrigger>
                <AccordionContent>Tracked 48 within the UK, £4.50 or free over £60. Thirty days to change your mind; breakages in the post replaced without a photo interrogation.</AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <SectionHeader eyebrow="Goes with" title="From the same firing" />
          <div className="mt-8 grid gap-5 sm:grid-cols-3">
            <ProductCard product={{ name: "Espresso cup", price: 22, was: 26, note: "Seconds — glaze runs" }} href="/product" />
            <ProductCard product={{ name: "Side plate, 21cm", price: 26, note: "Toast-sized" }} href="/product" />
            <ProductCard product={{ name: "Breakfast bowl", price: 34, note: "Wide enough for the weekend" }} href="/product" />
          </div>
        </div>
      </section>
    </SiteChrome>
  );
}
