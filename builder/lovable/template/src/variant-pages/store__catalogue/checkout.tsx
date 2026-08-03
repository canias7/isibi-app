// store/catalogue /checkout — the basket becomes an order. The catalogue
// difference is the CODE on every line and a purchase-order field: a builder
// checking a delivery note against an invoice matches codes, not descriptions,
// and half these orders are put on an account by somebody who is not the person
// who chose the parts.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { CartLine } from "@/components/ui/cart-line";
import { CartSummary } from "@/components/ui/cart-summary";
import { FormRow } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import { PaymentPicker } from "@/components/ui/payment-picker";
import { PlaceOrderBar } from "@/components/ui/place-order-bar";
import { SectionHeader } from "@/components/ui/section-header";
import { ShippingOptions } from "@/components/ui/shipping-options";
export const Route = createFileRoute("/checkout")({ component: P });
type Line = { code: string; name: string; finish: string; price: number; quantity: number };
function P() {
  const [lines, setLines] = useState<Line[]>([
    { code: "SH-2040", name: "Rim lock, 6 inch", finish: "Black iron", price: 48, quantity: 2 },
    { code: "SH-3014", name: "Cabinet knob, 32mm", finish: "Black iron", price: 6.2, quantity: 12 },
    { code: "SH-1120", name: "Butt hinge, 100mm", finish: "Polished brass", price: 4.2, quantity: 6 },
  ]);
  const [ship, setShip] = useState("next");
  const [pay, setPay] = useState("card1");
  const [po, setPo] = useState("");
  const sub = lines.reduce((s, l) => s + l.price * l.quantity, 0);
  const carriage = sub >= 75 ? 0 : ship === "next" ? 9.5 : 6.5;
  const vat = Math.round((sub + carriage) * 0.2 * 100) / 100;
  const total = Math.round((sub + carriage + vat) * 100) / 100;
  const setQty = (code: string, n: number) =>
    setLines((s) => (n <= 0 ? s.filter((l) => l.code !== code) : s.map((l) => (l.code === code ? { ...l, quantity: n } : l))));
  return (
    <SiteChrome name="Ellery Ironmongery" tagline="Period door and window furniture. 2,140 lines, 1,880 of them on the shelf."
      links={[{ label: "The catalogue", href: "#/" }, { label: "One product", href: "#/product" }]}
      action={{ label: "Keep looking", href: "#/" }}>

      <div className="mx-auto max-w-6xl px-6 py-10">
        <SectionHeader eyebrow="Basket" title="Three lines, twenty pieces"
          description="Codes are on every line because a delivery note and an invoice are matched by code, not by description — and 'butt hinge, 100mm' is four different products." />

        <div className="mt-8 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
          <div>
            {lines.map((l) => (
              <div key={l.code}>
                <CartLine name={l.name} meta={`${l.code} · ${l.finish}`} price={l.price} quantity={l.quantity}
                  onQuantity={(n) => setQty(l.code, n)} onRemove={() => setQty(l.code, 0)} />
              </div>
            ))}
            {lines.length === 0 && (
              <p className="py-10 text-center text-base text-muted-foreground">
                Nothing in it. <a className="underline underline-offset-4" href="#/">Back to the catalogue</a>.
              </p>
            )}

            <section className="mt-10 border-t border-border pt-8">
              <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Carriage</h2>
              <ShippingOptions className="mt-3" value={ship} onChange={setShip} options={[
                { value: "next", label: "Next working day", arrives: "Tomorrow if ordered before 15:00", price: sub >= 75 ? 0 : 9.5, note: sub >= 75 ? "Free — you are over £75" : "Free over £75, and you are £" + (75 - sub).toFixed(2) + " away" },
                { value: "std", label: "Two to three days", arrives: "Wednesday or Thursday", price: sub >= 75 ? 0 : 6.5 },
                { value: "collect", label: "Collect from the trade counter", arrives: "Ready in an hour", price: 0, note: "Attercliffe Road, 07:30–16:30 Monday to Friday" },
              ]} />
            </section>

            <section className="mt-10 border-t border-border pt-8">
              <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Paying</h2>
              <PaymentPicker className="mt-3" value={pay} onChange={setPay} methods={[
                { id: "card1", label: "Visa", last4: "4419", expires: "09/28" },
                { id: "account", label: "On account, 30 days — ELL-2214" },
                { id: "new", label: "A different card" },
              ]} />
              {/* THE PO FIELD. Half of a catalogue's orders are placed by
                  somebody who is not the person who chose the parts, and an
                  invoice with no PO on it sits in a finance inbox for a month. */}
              <div className="mt-5 max-w-sm">
                <FormRow label="Purchase order number" htmlFor="po"
                  hint="Optional, and worth filling in — an invoice with no PO on it sits in somebody's finance inbox for a month.">
                  <Input id="po" placeholder="e.g. PO-4471" value={po} onChange={(e) => setPo(e.target.value)} />
                </FormRow>
              </div>
            </section>
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <CartSummary lines={[
              { label: "Goods", value: sub },
              { label: "Carriage", value: carriage, note: carriage === 0 ? "free over £75" : ship === "next" ? "next day" : "2–3 days" },
              { label: "VAT at 20%", value: vat },
            ]} total={total}
              note="Prices on this site are ex VAT, which is stated on every page rather than sprung here. Trade and retail pay the same." />

            <div className="mt-5">
              <PlaceOrderBar totalMinor={Math.round(total * 100)} disabled={lines.length === 0}
                onPlace={async () => undefined}
                note={sub >= 75
                  ? "Carriage is free on this order. Ordered before 15:00 it leaves today."
                  : `£${(75 - sub).toFixed(2)} more and the carriage is free.`} />
            </div>

            <div className="mt-6 rounded-lg border border-border p-5">
              <p className="text-base font-medium">If a code is wrong, ring rather than guess</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                0114 272 3300, 07:30–16:30. Somebody who knows the range answers it, and a
                five-minute call is cheaper than a return — we will not charge you for our own
                restocking either way, but the door still has no lock on it in the meantime.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </SiteChrome>
  );
}
