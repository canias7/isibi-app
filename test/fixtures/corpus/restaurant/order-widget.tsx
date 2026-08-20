// restaurant/order-widget — DELIVERY-NATIVE. Same family, same one page, and
// the order path sits ABOVE everything else — delivery-or-collect, the postcode
// check and the running basket are the first screen. A takeaway's visitor is
// not choosing a restaurant, they have already chosen; they are ordering, and
// every scroll between them and the basket is a percentage point.
import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { CartLine } from "@/components/ui/cart-line";
import { ClickCollect } from "@/components/ui/click-collect";
import { DishCard } from "@/components/ui/dish-card";
import { LocationCard } from "@/components/ui/location-card";
import { OpenNow } from "@/components/ui/open-now";
import { OpeningHours, type DayHours } from "@/components/ui/opening-hours";
import { OrderSummary } from "@/components/ui/order-summary";
import { PlaceOrderBar } from "@/components/ui/place-order-bar";
import { SectionHeader } from "@/components/ui/section-header";
export const Route = createFileRoute("/order-widget")({ component: P });
const HOURS: DayHours[] = [
  { day: 1, label: "Monday", open: null, close: null },
  { day: 2, label: "Tuesday", open: "17:00", close: "22:00" },
  { day: 3, label: "Wednesday", open: "17:00", close: "22:00" },
  { day: 4, label: "Thursday", open: "17:00", close: "22:00" },
  { day: 5, label: "Friday", open: "16:30", close: "23:00" },
  { day: 6, label: "Saturday", open: "16:30", close: "23:00" },
  { day: 0, label: "Sunday", open: "16:30", close: "21:30" },
];
const OPEN = HOURS.filter((h) => h.open && h.close).map((h) => ({ day: h.day, open: h.open!, close: h.close! }));
const DISHES = [
  { name: "Lamb chops, 4", price: "£12.50", description: "The thing people come for. Charcoal, sumac, and a lot of it", tags: ["Grill"] },
  { name: "Adana kofte", price: "£10.50", description: "Hand-minced, hot but not silly", tags: ["Grill"] },
  { name: "Chicken shish", price: "£10.00", description: "Marinated overnight in yoghurt", tags: ["Grill"] },
  { name: "Mixed grill for two", price: "£26.00", description: "Chops, kofte, chicken and wings. Feeds two properly or three lightly", tags: ["Grill", "Sharing"] },
  { name: "Falafel wrap", price: "£7.50", description: "Made here, fried to order, so it takes eight minutes", tags: ["Vegan"] },
  { name: "Imam bayildi", price: "£8.50", description: "Aubergine, slow. Vegan and the best thing on the menu that isn't meat", tags: ["Vegan"] },
  { name: "Hummus and pide", price: "£5.50", tags: ["Vegan", "Starter"] },
  { name: "Halloumi, grilled", price: "£6.00", tags: ["Starter"] },
  { name: "Chips with sumac", price: "£3.50", tags: ["Side"] },
  { name: "Bulgur pilaf", price: "£3.50", tags: ["Side", "Vegan"] },
  { name: "Baklava, 3", price: "£4.50", tags: ["Sweet"] },
  { name: "Ayran", price: "£2.50", tags: ["Drink"] },
];
function P() {
  const [mode, setMode] = React.useState<"delivery" | "collect">("delivery");
  const [lines, setLines] = React.useState([
    { name: "Lamb chops, 4", price: 12.5, quantity: 1, meta: "Charcoal grill" },
    { name: "Imam bayildi", price: 8.5, quantity: 1, meta: "Vegan" },
    { name: "Chips with sumac", price: 3.5, quantity: 2, meta: null as string | null },
  ]);
  const sub = lines.reduce((s, l) => s + l.price * l.quantity, 0);
  const fee = mode === "delivery" ? 2.5 : 0;
  const total = sub + fee;
  const setQty = (name: string, n: number) =>
    setLines((s) => (n <= 0 ? s.filter((l) => l.name !== name) : s.map((l) => (l.name === name ? { ...l, quantity: n } : l))));
  return (
    <SiteChrome name="Şahin Ocakbaşı" tagline="Charcoal grill on Abbeydale Road. Delivery and collection, five nights."
      links={[{ label: "Menu", href: "#menu" }, { label: "Find us", href: "#find-us" }]}
      action={{ label: "Order now", href: "#order" }}>

      {/* THE ORDER PATH, ABOVE EVERYTHING. The menu-first version of this
          family opens with the room; a takeaway's visitor has already chosen
          the restaurant and is now ordering, so delivery-or-collect, the
          postcode answer and the running basket are the first screen. */}
      <section id="order" className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="grid items-start gap-10 lg:grid-cols-[1.15fr_1fr]">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <OpenNow hours={OPEN} />
                <span className="text-sm text-muted-foreground">Kitchen is about 35 minutes behind tonight</span>
              </div>
              <h1 className="mt-4 text-5xl font-semibold tracking-tight text-balance">Order in ninety seconds</h1>
              <p className="mt-4 max-w-lg text-lg leading-relaxed text-muted-foreground">
                Direct, so the whole price goes to the kitchen rather than a third of it going to an
                app. Same food, same driver, and about £4 cheaper on an average order.
              </p>
              <div className="mt-7">
                <ClickCollect value={mode} onChange={setMode}
                  delivery={{ priceMinor: 250, when: "Tonight, about 45 minutes" }}
                  collect={{ place: "412 Abbeydale Road", when: "Ready in 25 minutes", hours: "Until 22:45", priceMinor: 0 }} />
              </div>
              <div className="mt-6 rounded-lg border border-border bg-muted/40 p-5">
                <p className="text-base font-medium">
                  {mode === "delivery" ? "We deliver to S7, S8, S11 and S17" : "Collection is £2.50 cheaper and 20 minutes quicker"}
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {mode === "delivery"
                    ? "£2.50 flat, our own drivers, no surge and no service charge. Outside those four we will say so rather than take the order and cancel it at nine."
                    : "Park on Shirebrook Road behind the shop — the two spaces at the front are for the flat upstairs and they do get blocked in."}
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-border p-6">
              <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Your order</h2>
              <div className="mt-3">
                {lines.map((l) => (
                  <CartLine key={l.name} name={l.name} meta={l.meta} price={l.price} quantity={l.quantity}
                    onQuantity={(n) => setQty(l.name, n)} onRemove={() => setQty(l.name, 0)} />
                ))}
                {lines.length === 0 && (
                  <p className="py-6 text-sm text-muted-foreground">Nothing in it yet. The menu is just below.</p>
                )}
              </div>
              <OrderSummary className="mt-5" lines={[
                { label: "Food", value: sub },
                { label: mode === "delivery" ? "Delivery" : "Collection", value: fee, note: mode === "delivery" ? "flat, no surge" : "free" },
              ]} total={total}
                note={mode === "delivery" ? "No service charge, and the driver keeps every tip." : "Pay at the counter or now — both fine."} />
              {/* The £15 floor lives HERE and nowhere else. MinOrderNote counts
                  ITEMS, so handing it a pound total reads "order quantity is
                  fine" under a money figure — measured on a render. */}
              <PlaceOrderBar className="mt-5" totalMinor={Math.round(total * 100)}
                disabled={sub < 15 || lines.length === 0}
                onPlace={async () => undefined}
                note={mode === "delivery"
                  ? (sub < 15 ? `£15 minimum on delivery — you are £${(15 - sub).toFixed(2)} short.` : "£15 minimum on delivery, and you are over it.")
                  : "No minimum on collection, ever."} />
            </div>
          </div>
        </div>
      </section>

      <section id="menu" className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="Menu" title="Twelve things, and the grill is the reason"
          description="Everything is cooked to order over charcoal, which is why it is thirty-five minutes and not fifteen. A kitchen promising a grill in fifteen is using a griddle." />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {DISHES.map((d) => <DishCard key={d.name} {...d} />)}
        </div>
        <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Allergens on request and we mean it — ask on the phone and somebody who cooked it will
          answer. The fryer is shared, so nothing fried is gluten free, and we would rather say that
          plainly than put an asterisk on it.
        </p>
      </section>

      <section id="find-us" className="border-t border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid gap-10 lg:grid-cols-[1fr_1fr]">
            <div>
              <SectionHeader eyebrow="Find us" title="412 Abbeydale Road" />
              <LocationCard className="mt-6" name="Şahin Ocakbaşı" address="412 Abbeydale Road, Sheffield, S7 1FQ"
                note="Collection at the counter, straight in and out. Park on Shirebrook Road — the two at the front belong to the flat and they do get blocked in." />
              <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
                There are eighteen covers inside if you would rather eat here, first come, no
                bookings. Most nights half of them are people waiting for a collection who changed
                their mind, which is the best advertisement the grill has.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">Opening hours</h3>
              <OpeningHours className="mt-5" days={HOURS} />
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                Closed Mondays. Last order is twenty minutes before we shut, and on a Friday at nine
                the kitchen genuinely is forty-five minutes behind — that number at the top of the
                page is live and it is the real one.
              </p>
            </div>
          </div>
        </div>
      </section>
    </SiteChrome>
  );
}
