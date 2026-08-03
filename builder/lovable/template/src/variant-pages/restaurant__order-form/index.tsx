// restaurant/order-form — BAKERY AND CATERING. Same one-page scroll, and the
// change is that a collect form rides BESIDE the menu rather than after it. A
// bakery's menu is not something you read and then leave: half of it is
// pre-order only, the lead time is the constraint, and a form three screens
// below the thing it orders loses the order.
import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { BusyButton } from "@/components/ui/busy-button";
import { CtaBand } from "@/components/ui/cta-band";
import { FormRow } from "@/components/ui/form-row";
import { Gallery } from "@/components/ui/gallery";
import { Input } from "@/components/ui/input";
import { LeadTime } from "@/components/ui/lead-time";
import { LocationCard } from "@/components/ui/location-card";
import { MenuSection } from "@/components/ui/menu-section";
import { MinOrderNote } from "@/components/ui/min-order-note";
import { OpenNow } from "@/components/ui/open-now";
import { OpeningHours, type DayHours } from "@/components/ui/opening-hours";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { SuccessPanel } from "@/components/ui/success-panel";
import { Textarea } from "@/components/ui/textarea";
export const Route = createFileRoute("/")({ component: P });
const HOURS: DayHours[] = [
  { day: 1, label: "Monday", open: null, close: null },
  { day: 2, label: "Tuesday", open: "07:00", close: "15:00" },
  { day: 3, label: "Wednesday", open: "07:00", close: "15:00" },
  { day: 4, label: "Thursday", open: "07:00", close: "15:00" },
  { day: 5, label: "Friday", open: "07:00", close: "16:00" },
  { day: 6, label: "Saturday", open: "07:30", close: "14:00" },
  { day: 0, label: "Sunday", open: "08:30", close: "13:00" },
];
const OPEN = HOURS.filter((h) => h.open && h.close).map((h) => ({ day: h.day, open: h.open!, close: h.close! }));
function P() {
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [when, setWhen] = React.useState("");
  const [items, setItems] = React.useState("");
  const [qty, setQty] = React.useState(6);
  const [sent, setSent] = React.useState(false);
  return (
    <SiteChrome name="Rivelin Bakehouse" tagline="Sourdough, viennoiserie and celebration cakes. Walkley."
      links={[{ label: "The counter", href: "#menu" }, { label: "Order ahead", href: "#order" }, { label: "Find us", href: "#find-us" }]}
      action={{ label: "Order ahead", href: "#order" }}>

      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Walkley · baking since 04:30 · closed Mondays</p>
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">
                Half of it sells out by ten
              </h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                Which is why the order form is beside the menu rather than at the bottom of it.
                Anything ordered by two the day before is put aside with your name on it, and there
                is no deposit and no minimum on the counter list.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <a className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" href="#order">Order ahead</a>
                <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="#menu">See what we bake</a>
                <OpenNow hours={OPEN} />
              </div>
              <div className="mt-6">
                <LeadTime cutoffHour={14} now={new Date(2026, 7, 3, 9, 40)}
                  before="for collection tomorrow morning."
                  after="Today's cut-off has gone — the next collection is the day after tomorrow." />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <SafeImage src={null} alt="Loaves out of the deck oven at six" ratio="3/4" />
              <div className="flex flex-col gap-4">
                <SafeImage src={null} alt="The pastry counter at half seven" ratio="1/1" />
                <SafeImage src={null} alt="A birthday cake, iced Friday" ratio="1/1" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="menu" className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeader eyebrow="What we bake" title="The counter, and the things you have to ask for"
          description="Everything in the first list is out from seven and gone when it is gone. Everything in the second is pre-order only — we do not bake it speculatively and never have." />
        {/* THE FORM BESIDE THE MENU, not below it. That is the whole variant:
            half this list is pre-order only, and an order form three screens
            down from the thing it orders loses the order. */}
        <div className="mt-10 grid gap-12 lg:grid-cols-[1.35fr_1fr]">
          <MenuSection groups={[
            { name: "On the counter, from 07:00", note: "First come. Saturdays it is thin by half nine", items: [
              { name: "Country sourdough, 1kg", price: 4.6, description: "Twenty-four hour ferment, dark bake. Half loaves after eleven if any are left" },
              { name: "Seeded rye, 800g", price: 5.2 },
              { name: "Focaccia, by the piece", price: 3.4, description: "Rosemary, or whatever the garden has" },
              { name: "Croissant", price: 3, description: "Laminated Tuesday and Friday. Never on a Sunday, ask us why and regret it" },
              { name: "Pain au chocolat", price: 3.3 },
              { name: "Morning bun", price: 3.6, description: "Cardamom and orange. The one people queue at seven for" },
              { name: "Sausage roll", price: 4.2, description: "From the butcher on South Road, out at nine" },
              { name: "Cinnamon knot", price: 3.5 },
            ] },
            { name: "Pre-order only", note: "24 hours for bread and pastry, 5 days for a cake", items: [
              { name: "Celebration cake, 8 inch", price: 46, description: "Sponge, and you choose the filling. Feeds about fourteen" },
              { name: "Celebration cake, 10 inch", price: 62, description: "Feeds about twenty-four" },
              { name: "Party box, 24 pastries", price: 68, description: "Mixed, our choice, and there is always one of everything" },
              { name: "Sandwich platter, 12 rounds", price: 42, description: "Four fillings, on our own bread. One is always vegan" },
              { name: "Bread for a wedding", price: null, meta: "Ring us", description: "We have done thirty and the answer depends on the number" },
              { name: "Gluten-free loaf", price: 5.8, description: "Baked in a separate space on Thursdays. Order by Tuesday" },
            ] },
          ]} />

          <div id="order" className="lg:sticky lg:top-24 lg:self-start">
            {sent ? (
              <SuccessPanel title="Got it — we'll text to confirm"
                description="Within the hour if we are open, first thing tomorrow if not. Nothing is charged now; you pay when you collect." />
            ) : (
              <div className="rounded-lg border border-border bg-muted/40 p-6">
                <h2 className="text-lg font-semibold tracking-tight">Order ahead</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  By 14:00 for tomorrow. No deposit, no card, and no charge if you change your mind
                  before we bake — just tell us.
                </p>
                <div className="mt-5 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormRow label="Name" htmlFor="o-name" required>
                      <Input id="o-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
                    </FormRow>
                    <FormRow label="Mobile" htmlFor="o-phone" required hint="We text when it is ready.">
                      <Input id="o-phone" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
                    </FormRow>
                  </div>
                  <FormRow label="Collection day and rough time" htmlFor="o-when" required>
                    <Input id="o-when" placeholder="Saturday, about nine" value={when} onChange={(e) => setWhen(e.target.value)} />
                  </FormRow>
                  <FormRow label="What you would like" htmlFor="o-items" required
                    hint="Copy from the list, or describe it. A cake needs the filling, the writing and the date it is for.">
                    <Textarea id="o-items" rows={5}
                      placeholder={"2 country sourdough\n6 morning buns\n1 eight-inch cake, lemon, 'Happy 40th Dad', for Sat 15th"}
                      value={items} onChange={(e) => setItems(e.target.value)} />
                  </FormRow>
                  <FormRow label="Pastries, if you want a box" htmlFor="o-qty"
                    hint="Boxes go in sixes. Loose pastries have no minimum at all.">
                    <Input id="o-qty" type="number" inputMode="numeric" min={0} step={1}
                      value={qty} onChange={(e) => setQty(Number(e.target.value) || 0)} />
                  </FormRow>
                  <MinOrderNote quantity={qty} min={6} multipleOf={6} />
                  <BusyButton disabled={!name || !phone || !when || !items} onClick={() => setSent(true)}>
                    Send the order
                  </BusyButton>
                </div>
              </div>
            )}
            <div className="mt-6 rounded-lg border border-border p-5">
              <p className="text-base font-medium">Cakes need five days, not one</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Because they are made in the gaps between the bread, and because a rushed one is a
                worse cake. Ring if it is sooner than that — we will usually say yes and we will
                always say honestly which it will be.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <SectionHeader eyebrow="The bakehouse" title="Two ovens, four of us, and a 4:30 start" />
          <Gallery className="mt-10" columns={3} items={[
            { alt: "The deck oven at five", caption: "Loaves in at five" },
            { alt: "Shaping the second bake", caption: "Second bake, about eight" },
            { alt: "The counter at seven", caption: "Out at seven, thin by ten" },
            { alt: "Lamination on a Tuesday", caption: "Croissants Tuesday and Friday" },
            { alt: "A cake being iced", caption: "Cakes go in the gaps" },
            { alt: "The shop from South Road", caption: "The blue door on South Road" },
          ]} />
        </div>
      </section>

      <section id="find-us" className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-10 lg:grid-cols-[1fr_1fr_1.1fr]">
          <div>
            <SectionHeader eyebrow="Find us" title="South Road, Walkley" />
            <LocationCard className="mt-6" name="Rivelin Bakehouse" address="118 South Road, Sheffield, S6 3TF"
              note="The blue door beside the hardware shop. Two spaces on the road outside and plenty on Highton Street. The 95 stops at the end." />
          </div>
          <div>
            <h3 className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">Opening hours</h3>
            <OpeningHours className="mt-5" days={HOURS} />
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Closed Mondays because the ovens need a day and so do we. Orders placed on a Sunday
              are collected Wednesday at the earliest.
            </p>
          </div>
          <SafeImage src={null} alt="The blue door on South Road" ratio="4/5" />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <CtaBand title="If it is on the counter, we cannot save it"
          description="Only pre-orders get put aside. Everything else is first come, and on a Saturday that genuinely means before nine."
          action={{ label: "Order ahead", href: "#order" }} />
      </section>
    </SiteChrome>
  );
}
