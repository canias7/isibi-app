// marketplace — AUDIENCE-FIRST: supply and demand share one page, and the
// toggle above the fold decides which you see. Neither side is the default,
// which is the whole discipline — a marketplace page that leads with buyers has
// no sellers in six months, and vice versa.
import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { AudienceSwitch } from "@/components/ui/audience-switch";
import { Faq } from "@/components/ui/faq";
import { SafeImage } from "@/components/ui/safe-image";
import { SearchInput } from "@/components/ui/search-input";
import { SectionHeader } from "@/components/ui/section-header";
import { SellerCard } from "@/components/ui/seller-card";
import { StatsBand } from "@/components/ui/stats-band";
import { Steps } from "@/components/ui/steps";
export const Route = createFileRoute("/")({ component: P });
export const MAKERS = [
  { name: "Ida Kolar", makes: "Chopping boards and spoons, in Yorkshire oak", location: "Rotherham", since: 2014, rating: 4.9, sales: 412, note: "Everything is cut from one tree at a time, and she says which tree." },
  { name: "Ben Achebe", makes: "Hand-thrown stoneware, mostly mugs", location: "Sheffield", since: 2019, rating: 4.8, sales: 260 },
  { name: "Rosa Lindqvist", makes: "Woven baskets from local willow", location: "Bakewell", since: 2011, rating: 5, sales: 88, note: "Cuts her own willow every February from a bed she planted." },
  { name: "Tam Oyelaran", makes: "Leather aprons and tool rolls", location: "Barnsley", since: 2021, rating: 4.7, sales: 149 },
  { name: "Priya Sandhu", makes: "Screen-printed linen, one colour at a time", location: "Sheffield", since: 2023, rating: 4.9, sales: 41 },
  { name: "Callum Frayn", makes: "Green-wood stools and shave horses", location: "Hathersage", since: 2025 },
];
function P() {
  const [side, setSide] = React.useState("buy");
  const [q, setQ] = React.useState("");
  const buying = side === "buy";
  return (
    <SiteChrome name="Made Round Here" tagline="A marketplace for things made within fifty miles of Sheffield."
      links={[{ label: "Browse", href: "#/browse" }, { label: "Sell with us", href: "#/sell" }]}
      action={{ label: buying ? "Browse everything" : "Start selling", href: buying ? "#/browse" : "#/sell" }}>

      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-14">
          {/* THE SWITCH IS THE FIRST THING, above both hero columns. Put it
              below either one and that one has become the default. */}
          <AudienceSwitch label="I want to" value={side} onChange={setSide} audiences={[
            { key: "buy", label: "Buy something", description: "Find a maker within fifty miles" },
            { key: "sell", label: "Sell what I make", description: "List for free, 6% when it sells" },
          ]} />

          <div className="mt-10 grid items-start gap-12 lg:grid-cols-[1.05fr_1fr]">
            <div>
              <h1 className="text-5xl font-semibold tracking-tight text-balance">
                {buying ? "Things made within fifty miles" : "Sell what you make, keep 94% of it"}
              </h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                {buying
                  ? "Four hundred makers in South Yorkshire and the Peak. Every listing names the person who made it, where they work and what they have sold — because that is what you are actually buying."
                  : "Free to list, no monthly fee, and 6% when something sells. You keep your own customer list and you can leave with it whenever you like."}
              </p>
              {buying ? (
                <div className="mt-7 max-w-md">
                  <SearchInput value={q} onChange={setQ} placeholder="Pottery, oak, aprons, Bakewell…" />
                  <p className="mt-2 text-sm text-muted-foreground">Or <a className="underline underline-offset-4" href="#/browse">browse everything</a>.</p>
                </div>
              ) : (
                <div className="mt-7 flex flex-wrap gap-3">
                  <a className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" href="#/sell">Start selling</a>
                  <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="#/sell">See the fees in full</a>
                </div>
              )}
              <StatsBand className="mt-8" items={buying ? [
                { value: 412, label: "Makers" },
                { value: "9,800", label: "Things listed" },
                { value: "50mi", label: "Everything within" },
                { value: "4.9", label: "Average rating" },
              ] : [
                { value: "6%", label: "When it sells" },
                { value: "£0", label: "To list" },
                { value: "3 days", label: "Payout" },
                { value: 412, label: "Makers already" },
              ]} />
            </div>
            <SafeImage src={null} alt={buying ? "A maker's bench" : "Packing an order"} ratio="4/3" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow={buying ? "How buying works" : "How selling works"}
          title={buying ? "Three steps, and the maker gets paid" : "Three steps, and you keep the relationship"}
          description={buying
            ? "You buy from the person, not from us. We take the payment, hold it until it arrives, and pass on 94%."
            : "Nothing here locks you in: no exclusivity, no minimum, and your customer list is yours to take."} />
        <Steps className="mt-8" items={buying ? [
          { title: "Find a maker", description: "Search by what you want or by where you are. Every result names a person." },
          { title: "Order from them", description: "We hold the money until it reaches you. Made-to-order takes as long as it says on the listing." },
          { title: "It arrives", description: "From them, in their packaging, usually with a note. Anything wrong and we refund from our own pocket." },
        ] : [
          { title: "List for nothing", description: "Photos, a price and a lead time. Ten minutes for the first one, two for the rest." },
          { title: "We send you buyers", description: "Search, the browse page and the weekly email. You do not pay for placement and you cannot buy it." },
          { title: "You get paid in three days", description: "6% comes off, the rest lands. No monthly fee and no listing fee, ever." },
        ]} />
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <SectionHeader eyebrow="The makers" title="People, not stock"
              description="A rating always carries the number of sales it came from. 4.9 from three sales and 4.9 from four hundred are different facts." />
            <a className="text-sm font-medium underline underline-offset-4" href="#/browse">All 412 makers →</a>
          </div>
          <div className="mt-8 grid gap-x-10 gap-y-8 md:grid-cols-2 lg:grid-cols-3">
            {MAKERS.map((m) => <SellerCard key={m.name} {...m} href="#/browse" />)}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <SectionHeader eyebrow="Asked often" title={buying ? "About buying" : "About selling"} />
            <Faq className="mt-6" items={buying ? [
              { question: "Is everything really made locally?", answer: "Within fifty miles of Sheffield city centre, and we check. A maker who resells bought-in goods is removed, which happens two or three times a year." },
              { question: "What if it does not arrive?", answer: "We hold your money until it does. If it never turns up we refund you and settle with the maker separately — that is our problem, not yours." },
              { question: "Can I commission something?", answer: "Message the maker. About a third of what sells here is made to order and the lead time is on every listing." },
              { question: "Do you mark anything up?", answer: "No. The price on the listing is the maker's price and 6% of it comes to us afterwards." },
            ] : [
              { question: "What does it actually cost?", answer: "6% when something sells, including the card fee. Nothing to list, nothing monthly, and no charge for photographs or placement." },
              { question: "Do I have to sell only here?", answer: "No. Most makers here also sell at markets and on their own site, and several are on the big platforms too. There is no exclusivity clause." },
              { question: "When do I get paid?", answer: "Three working days after it arrives with the buyer. Not thirty, and not on a schedule that suits our cashflow." },
              { question: "Can I take my customers with me?", answer: "They are yours already. We do not hide buyer addresses and we will export your order history whenever you ask." },
            ]} />
          </div>
          <div className="space-y-4">
            <SafeImage src={null} alt="A workshop in Rotherham" ratio="4/3" />
            <SafeImage src={null} alt="Stoneware, drying" ratio="4/3" />
          </div>
        </div>
      </section>
    </SiteChrome>
  );
}
