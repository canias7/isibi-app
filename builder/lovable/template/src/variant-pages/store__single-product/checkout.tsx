// store/single-product /checkout — the basket becomes an order. On a shop of
// one there is never more than one line and the quantity is nearly always 1, so
// the whole page is delivery, payment and the amount — the "basket" itself is a
// single row and pretending otherwise wastes the screen.
import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { AddressFields, type Address } from "@/components/ui/address-fields";
import { CartLine } from "@/components/ui/cart-line";
import { CartSummary } from "@/components/ui/cart-summary";
import { PaymentPicker } from "@/components/ui/payment-picker";
import { PlaceOrderBar } from "@/components/ui/place-order-bar";
import { SectionHeader } from "@/components/ui/section-header";
import { ShippingOptions } from "@/components/ui/shipping-options";
export const Route = createFileRoute("/checkout")({ component: P });
function P() {
  const [qty, setQty] = React.useState(1);
  const [ship, setShip] = React.useState("standard");
  const [pay, setPay] = React.useState("visa");
  const [addr, setAddr] = React.useState<Address>({ line1: "", city: "", postcode: "" });
  const shipCost = ship === "express" ? 6 : 0;
  const goods = 84 * qty;
  const total = goods + shipCost;
  return (
    <SiteChrome name="Effingham No. 26" tagline="One carbon steel pan, made in Sheffield."
      links={[{ label: "Home", href: "#/" }, { label: "The pan", href: "#/product" }]}>

      <div className="mx-auto max-w-6xl px-6 py-14 pb-32">
        <SectionHeader eyebrow="Checkout" title="One pan, one page"
          description="No account needed, and we will not make one for you afterwards. Guest checkout is the only checkout." />

        <div className="mt-10 grid gap-12 lg:grid-cols-[1.3fr_1fr]">
          <div className="space-y-10">
            <section>
              <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Your basket</h2>
              {/* ONE LINE, and that is the whole basket. A shop of one does not
                  need a table, a "continue shopping" link or an empty state. */}
              <div className="mt-3 border-y border-border">
                <CartLine name="Effingham No. 26" meta="26cm carbon steel, bare" price={84}
                  quantity={qty} onQuantity={setQty} />
              </div>
            </section>

            <section>
              <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Where it goes</h2>
              <AddressFields className="mt-3" value={addr} onChange={setAddr} />
            </section>

            <section>
              <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">How it gets there</h2>
              <ShippingOptions className="mt-3" value={ship} onChange={setShip} currency="£" options={[
                { value: "standard", label: "Royal Mail Tracked 48", arrives: "Thursday or Friday", price: 0, note: "Free, and it is the one we would pick" },
                { value: "express", label: "Royal Mail Tracked 24", arrives: "Tomorrow if you order before 2pm", price: 6 },
                { value: "collect", label: "Collect from the workshop", arrives: "Any weekday, 9–4", price: 0, note: "Effingham Road, S4. Ring the bell on the blue door" },
              ]} />
            </section>

            <section>
              <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">How you pay</h2>
              <PaymentPicker className="mt-3" value={pay} onChange={setPay} onAdd={() => {}} methods={[
                { id: "visa", label: "Visa", last4: "4242", expires: "07/29" },
                { id: "amex", label: "American Express", last4: "0031", expires: "03/26", expired: true },
              ]} />
            </section>
          </div>

          <div className="lg:sticky lg:top-6 lg:self-start">
            <CartSummary
              lines={[
                { label: "Effingham No. 26" + (qty > 1 ? ` × ${qty}` : ""), value: goods },
                { label: ship === "express" ? "Tracked 24" : ship === "collect" ? "Collection" : "Tracked 48", value: shipCost || "Free" },
                { label: "VAT (included)", value: Math.round(total / 6 * 100) / 100 },
              ]}
              total={total}
              note="We take payment when you press the button, not on dispatch."
            />
            <div className="mt-6 space-y-3 text-sm text-muted-foreground">
              <p><span className="font-medium text-foreground">Thirty days to change your mind.</span> Used, seasoned, any state at all. We refund the postage you paid too.</p>
              <p><span className="font-medium text-foreground">Twenty-five year guarantee.</span> Warping, cracking or a handle failure and we replace it, whoever you are and whenever it was bought.</p>
              <p><span className="font-medium text-foreground">No account.</span> We do not create one, and the only email you get is the one with the tracking number in it.</p>
            </div>
          </div>
        </div>
      </div>

      <PlaceOrderBar totalMinor={total * 100} onPlace={async () => {}}
        note="You will be charged now. Dispatched the next working day." />
    </SiteChrome>
  );
}
