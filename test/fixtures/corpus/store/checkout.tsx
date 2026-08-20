// store — the basket becomes an order on ONE page, not a tunnel. Lines you
// can still change, delivery said with real dates and prices, payment as a
// pick not a form, and a single place-order bar that repeats the total it is
// about to charge. The confirmation replaces the page rather than redirecting
// away from it.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { CartLine } from "@/components/ui/cart-line";
import { CartSummary } from "@/components/ui/cart-summary";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PaymentPicker } from "@/components/ui/payment-picker";
import { PlaceOrderBar } from "@/components/ui/place-order-bar";
import { SectionHeader } from "@/components/ui/section-header";
import { ShippingOptions } from "@/components/ui/shipping-options";
import { StatusBadge } from "@/components/ui/status-badge";
export const Route = createFileRoute("/checkout")({ component: P });

type Line = { name: string; meta: string; price: number; quantity: number };

function P() {
  const [lines, setLines] = useState<Line[]>([
    { name: "The dimpled mug", meta: "Oat glaze", price: 28, quantity: 2 },
    { name: "Breakfast bowl", meta: "Storm glaze", price: 34, quantity: 1 },
  ]);
  const [ship, setShip] = useState("tracked48");
  const [pay, setPay] = useState("card");
  const [placed, setPlaced] = useState(false);

  const goods = lines.reduce((sum, l) => sum + l.price * l.quantity, 0);
  const post = goods >= 60 ? 0 : ship === "tracked24" ? 6.5 : 4.5;
  const total = goods + post;

  return (
    <SiteChrome name="Slipware" tagline="Small-batch stoneware, thrown in Leith."
      links={[{ label: "The range", href: "/" }, { label: "This month's piece", href: "/product" }]}
      action={{ label: "Keep shopping", href: "/" }}>

      {placed ? (
        <section className="mx-auto max-w-2xl px-6 py-24 text-center">
          <StatusBadge state="success">Order placed</StatusBadge>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">Thanks — it's ours to pack now</h1>
          <p className="mt-3 text-muted-foreground">Order SLP-2184. A confirmation is on its way to your inbox; the pieces are wrapped tomorrow morning and posted tracked. Change of heart? Reply to the email within the hour and we'll hold it.</p>
          <a className="mt-8 inline-block rounded-md border px-5 py-2.5 text-sm font-medium" href="/">Back to the range</a>
        </section>
      ) : (
        <section className="mx-auto max-w-5xl px-6 py-12">
          <SectionHeader eyebrow="Checkout" title="Your basket, then the door" description="Everything on one page — change a line here rather than starting again." />
          <div className="mt-8 grid gap-10 md:grid-cols-[3fr_2fr]">
            <div>
              <div className="divide-y rounded-xl border bg-card px-5">
                {lines.map((l, i) => (
                  <CartLine key={l.name} name={l.name} meta={l.meta} price={l.price} quantity={l.quantity}
                    onQuantity={(n) => setLines(lines.map((x, j) => (j === i ? { ...x, quantity: n } : x)))}
                    onRemove={() => setLines(lines.filter((_, j) => j !== i))} />
                ))}
                {lines.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Nothing in the basket — <a className="underline underline-offset-4" href="/">the range is this way</a>.</p>}
              </div>

              <div className="mt-8">
                <h2 className="text-base font-medium">Delivery</h2>
                <div className="mt-3">
                  <ShippingOptions value={ship} onChange={setShip} options={[
                    { value: "tracked48", label: "Tracked 48", arrives: "Thu–Fri", price: goods >= 60 ? 0 : 4.5, note: goods >= 60 ? "Free over £60" : undefined },
                    { value: "tracked24", label: "Tracked 24", arrives: "Wednesday", price: goods >= 60 ? 0 : 6.5 },
                    { value: "collect", label: "Collect from the studio", arrives: "Any open day", price: 0, note: "Halmyre Street, Leith" },
                  ]} />
                </div>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-1.5"><Label htmlFor="co-name">Name</Label><Input id="co-name" autoComplete="name" /></div>
                  <div className="grid gap-1.5"><Label htmlFor="co-post">Postcode</Label><Input id="co-post" autoComplete="postal-code" /></div>
                </div>
              </div>

              <div className="mt-8">
                <h2 className="text-base font-medium">Paying</h2>
                <div className="mt-3">
                  <PaymentPicker value={pay} onChange={setPay} methods={[
                    { id: "card", label: "Card" },
                    { id: "wallet", label: "Apple / Google Pay" },
                    { id: "bank", label: "Bank transfer", last4: undefined },
                  ]} />
                </div>
              </div>
            </div>

            <div className="md:sticky md:top-6 md:self-start">
              <CartSummary
                lines={[
                  { label: `Goods (${lines.reduce((n, l) => n + l.quantity, 0)} pieces)`, value: goods },
                  { label: "Delivery", value: post, note: post === 0 ? "free" : undefined },
                ]}
                total={total}
                note="VAT included. Nothing is charged until you place the order." />
              <div className="mt-4">
                <PlaceOrderBar totalMinor={Math.round(total * 100)} disabled={lines.length === 0}
                  note="Your pieces are held for an hour."
                  onPlace={async () => { await new Promise((r) => setTimeout(r, 600)); setPlaced(true); }} />
              </div>
            </div>
          </div>
        </section>
      )}
    </SiteChrome>
  );
}
