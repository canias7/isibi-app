// store — the products ARE the page and the basket is always in reach. A
// small-batch ceramics shop: featured piece up top beside the promise, the
// range as a filterable grid with price and stock on every card, why-buy-here,
// kind words, and the closing band. Checkout is one page away at all times.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { CartBadge } from "@/components/ui/cart-badge";
import { CategoryNav } from "@/components/ui/category-nav";
import { CtaBand } from "@/components/ui/cta-band";
import { ProductCard, type Product } from "@/components/ui/product-card";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { Testimonial } from "@/components/ui/testimonial";
import { TrustStrip } from "@/components/ui/trust-strip";
export const Route = createFileRoute("/")({ component: P });

const RANGE: (Product & { category: string })[] = [
  { name: "Dimpled mug", price: 28, note: "Holds a proper flat white", category: "mugs" },
  { name: "Breakfast bowl", price: 34, note: "Wide enough for the weekend", category: "bowls" },
  { name: "Dinner plate, 27cm", price: 38, note: "The workhorse", category: "plates" },
  { name: "Espresso cup", price: 22, was: 26, note: "Seconds — glaze runs, full price feel", category: "mugs" },
  { name: "Serving bowl", price: 68, note: "One per kiln load", category: "bowls" },
  { name: "Side plate, 21cm", price: 26, note: "Toast-sized", category: "plates" },
  { name: "Teapot, two cups", price: 85, soldOut: true, note: "Back in the spring firing", category: "mugs" },
  { name: "Pasta bowl", price: 36, note: "Rim you can hold with a thumb", category: "bowls" },
];

function P() {
  const [cat, setCat] = useState<string | null>(null);
  const shown = cat ? RANGE.filter((p) => p.category === cat) : RANGE;
  return (
    <SiteChrome name="Slipware" tagline="Small-batch stoneware, thrown in Leith."
      links={[{ label: "The range", href: "#range" }, { label: "Why ours", href: "#why" }, { label: "Basket", href: "#/checkout" }]}
      action={{ label: "Checkout", href: "#/checkout" }}>

      {/* Hero: a real product beside the promise — never a slogan without goods. */}
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto grid max-w-5xl items-center gap-10 px-6 py-16 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Thrown · glazed · fired in Leith</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance">Stoneware you'll reach for every day</h1>
            <p className="mt-4 max-w-md text-lg text-muted-foreground">Eight shapes, four glazes, fired forty at a time. When a batch is gone it's gone until the kiln says otherwise.</p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" href="#range">Shop the range</a>
              <a className="rounded-md border px-5 py-2.5 text-sm font-medium" href="#/product">This month's piece</a>
              <CartBadge count={2} href="#/checkout" />
            </div>
          </div>
          <SafeImage src={null} alt="The dimpled mug in oat glaze" ratio="4/3" />
        </div>
      </section>

      <section id="why" className="mx-auto max-w-5xl px-6 py-10">
        <TrustStrip items={[
          { title: "Free UK post over £60", description: "Wrapped like it matters, because it does" },
          { title: "Seconds sold as seconds", description: "Named, discounted, never slipped in" },
          { title: "30-day no-quibble returns", description: "Chips in the post are on us" },
        ]} />
      </section>

      {/* The grid — the family's hero object. Price and stock live on the card. */}
      <section id="range" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHeader eyebrow="The range" title="What's out of the kiln" description="Every piece opens its own page — glaze, size, what it's like to live with." />
            <CategoryNav items={[
              { key: "mugs", label: "Mugs", count: 3 },
              { key: "bowls", label: "Bowls", count: 3 },
              { key: "plates", label: "Plates", count: 2 },
            ]} active={cat} onSelect={setCat} allLabel="Everything" />
          </div>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {shown.map((p) => (
              <ProductCard key={p.name} product={p} href="#/product" onAdd={p.soldOut ? undefined : () => { location.hash = "#/checkout"; }} />
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <SectionHeader eyebrow="Kind words" title="From other kitchens" />
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          <Testimonial item={{ quote: "The mug survived three years of a busy café before a customer finally got it. I bought six more.", name: "Dana Reyes", role: "Corner Room, Glasgow" }} />
          <Testimonial item={{ quote: "Arrived wrapped like a present to itself. The bowl is the one thing everyone asks about.", name: "Priya Nathan", role: "Ordered the serving bowl" }} />
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-20">
        <CtaBand title="Two things in your basket" description="The spring firing sells through — checkout holds your pieces for an hour." action={{ label: "Go to checkout", href: "#/checkout" }} />
      </section>
    </SiteChrome>
  );
}
