// printer — SPEC-AND-QUANTITY-FIRST, with a persistent product rail.
//
// PRICE IS A FUNCTION OF QUANTITY AND THE PAGE HAS TO SAY SO. Almost every
// print shop publishes one number — "business cards from £24" — and every
// customer then has to email to find out what 500 costs. The break table IS the
// product page, and the line that sells the next break ("add 250 more and they
// are 6p each") is the one a static price list can never write.
//
// THE RAIL IS PERSISTENT BECAUSE PEOPLE ARRIVE KNOWING WHAT THEY WANT. Nobody
// browses a printer. They want cards, or a banner, or ten correx boards for a
// site fence, and a rail lets them get there in one click from any page.
import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { BulkPricing } from "@/components/ui/bulk-pricing";
import { TurnaroundNote } from "@/components/ui/turnaround-note";
import { PriceList } from "@/components/ui/price-list";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/")({ component: P });

const RAIL = [
  { name: "Business cards", note: "400gsm, matt or soft-touch", href: "/products" },
  { name: "Flyers and leaflets", note: "A6 to A4, folded or flat", href: "/products" },
  { name: "Posters", note: "A3 to A0, indoor and weatherproof", href: "/products" },
  { name: "Roller banners", note: "800 or 1000mm, cassette included", href: "/products" },
  { name: "Correx site boards", note: "4mm, eyelets, 8ft × 4ft down to A2", href: "/products" },
  { name: "Vinyl lettering", note: "Windows, vans and shop fronts", href: "/products" },
  { name: "Stickers and labels", note: "Kiss-cut on rolls or sheets", href: "/products" },
  { name: "T-shirts and workwear", note: "Screen print over 25, DTF under", href: "/products" },
];

// The two products that carry the point. Real breaks from a real trade.
const CARDS = [
  { min: 100, priceMinor: 32 },
  { min: 250, priceMinor: 17 },
  { min: 500, priceMinor: 11 },
  { min: 1000, priceMinor: 7 },
  { min: 2500, priceMinor: 5 },
];
const FLYERS = [
  { min: 250, priceMinor: 21 },
  { min: 500, priceMinor: 13 },
  { min: 1000, priceMinor: 8 },
  { min: 2500, priceMinor: 5 },
  { min: 5000, priceMinor: 4 },
];

function P() {
  const [cards, setCards] = React.useState(500);
  const [flyers, setFlyers] = React.useState(500);

  return (
    <SiteChrome
      name="Neepsend Print & Sign"
      tagline="Litho, digital and wide format on Rutland Road since 1994. Trade and public, same prices."
      links={[
        { label: "Products", href: "/products" },
        { label: "Send artwork", href: "/quote" },
        { label: "Questions", href: "#questions" },
      ]}
      action={{ label: "Send artwork", href: "/quote" }}
    >
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 lg:grid-cols-[15rem_1fr]">
        {/* THE PERSISTENT RAIL. Sticky, so it survives a long price table. */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            What are you after
          </p>
          <nav className="mt-4">
            <ul className="divide-y divide-border border-y border-border">
              {RAIL.map((r) => (
                <li key={r.name}>
                  <a className="block py-3" href={r.href}>
                    <span className="text-sm font-medium">{r.name}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{r.note}</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="mt-6 rounded-lg border border-border p-4">
            <p className="text-sm font-medium">Not on the list?</p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              Menus, order pads, NCR sets, foamex, magnetic van panels, exhibition graphics. Ring
              0114 272 6180 — Mick has printed nearly everything and will tell you if we cannot.
            </p>
          </div>
        </aside>

        <div className="min-w-0">
          <h1 className="text-4xl font-semibold tracking-tight text-balance">
            The price depends on how many, so here is how many
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Most printers publish "business cards from £24" and make you email to find out what 500
            costs. The setup is the expensive part of any print job — once the plates are on, the
            paper is pennies — which is why 1,000 cards cost barely more than 250.
          </p>
          <div className="mt-6">
            <TurnaroundNote
              from={3}
              to={5}
              busyNote="Election season, so correx boards are running at 7–8 days until mid-September"
            />
          </div>

          {/* THE TWO BREAK TABLES, LIVE. This is the page. */}
          <section className="mt-12">
            <SectionHeader
              eyebrow="How quantity moves the price"
              title="Pick a number and watch the per-item price fall"
              description="Prices are ex VAT, printed both sides, and include delivery in the S postcodes. There is no trade tier — a one-man band pays what an agency pays."
            />

            <div className="mt-8 grid gap-8 md:grid-cols-2">
              <div className="rounded-xl border border-border p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h3 className="text-lg font-medium">Business cards</h3>
                  <p className="text-sm text-muted-foreground">400gsm matt · 85 × 55mm</p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {[100, 250, 500, 1000, 2500].map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setCards(q)}
                      aria-pressed={cards === q}
                      className={
                        "cursor-pointer rounded-md border px-3 py-1.5 text-sm tabular-nums " +
                        (cards === q ? "border-foreground font-medium" : "border-border text-muted-foreground")
                      }
                    >
                      {q.toLocaleString("en-GB")}
                    </button>
                  ))}
                </div>
                <p className="mt-5 text-3xl font-semibold tabular-nums">
                  £{((cards * (CARDS.reduce((b, t) => (cards >= t.min ? t.priceMinor : b), CARDS[0].priceMinor))) / 100).toFixed(2)}
                  <span className="ml-2 text-base font-normal text-muted-foreground">for {cards.toLocaleString("en-GB")}</span>
                </p>
                <div className="mt-4">
                  <BulkPricing tiers={CARDS} quantity={cards} />
                </div>
              </div>

              <div className="rounded-xl border border-border p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h3 className="text-lg font-medium">A5 flyers</h3>
                  <p className="text-sm text-muted-foreground">170gsm silk · full colour both sides</p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {[250, 500, 1000, 2500, 5000].map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setFlyers(q)}
                      aria-pressed={flyers === q}
                      className={
                        "cursor-pointer rounded-md border px-3 py-1.5 text-sm tabular-nums " +
                        (flyers === q ? "border-foreground font-medium" : "border-border text-muted-foreground")
                      }
                    >
                      {q.toLocaleString("en-GB")}
                    </button>
                  ))}
                </div>
                <p className="mt-5 text-3xl font-semibold tabular-nums">
                  £{((flyers * (FLYERS.reduce((b, t) => (flyers >= t.min ? t.priceMinor : b), FLYERS[0].priceMinor))) / 100).toFixed(2)}
                  <span className="ml-2 text-base font-normal text-muted-foreground">for {flyers.toLocaleString("en-GB")}</span>
                </p>
                <div className="mt-4">
                  <BulkPricing tiers={FLYERS} quantity={flyers} />
                </div>
              </div>
            </div>

            <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Below the bottom break we still print it — 50 cards is a digital job rather than a
              litho one and it costs £18 whatever the quantity, so 50 and 100 are the same money.
              We will say so rather than take the order for 50.
            </p>
          </section>

          <section className="mt-14">
            <SectionHeader
              eyebrow="Fixed-price things"
              title="The jobs where quantity is one"
              description="Signs, banners and vehicle work are priced by size and material rather than by run length. These are ready prices, not from-prices."
            />
            <div className="mt-6">
              <PriceList
                items={[
                  { name: "Roller banner, 800 × 2000mm", description: "Cassette base, printed panel, carry bag. Replacement panels £34.", price: 68 },
                  { name: "Correx site board, 8ft × 4ft", description: "4mm, single sided, eyelets. Six or more is £46 each.", price: 58 },
                  { name: "Foamex panel, A1", description: "5mm, indoor or sheltered outdoor. Drilled free.", price: 29 },
                  { name: "Shop window lettering", description: "Cut vinyl, per square metre, fitted. Survey first and it is free.", price: 84, meta: "fitted" },
                  { name: "Van livery, small panel set", description: "Both doors and the rear. Cut vinyl on a plain van, one day in the unit.", price: 320 },
                  { name: "A-board with two printed panels", description: "Steel frame, weighted. The panels are replaceable for £24 the pair.", price: 96 },
                  { name: "PVC banner, 3m × 1m", description: "540gsm, hemmed, eyeletted every 500mm. Bigger is £26 a square metre.", price: 78 },
                  { name: "Artwork setup, per half hour", description: "Only if your file needs work. Most do not — see what we fix free.", price: 22, meta: "rarely charged" },
                ]}
              />
            </div>
          </section>

          <section id="questions" className="mt-14">
            <SectionHeader title="The four things everybody asks" />
            <div className="mt-6">
              <Faq
                items={[
                  {
                    question: "Can I see it before you print 2,000?",
                    answer:
                      "A PDF proof always, by email, usually within the hour. A printed proof on the real stock is £12 and comes off the invoice if you order — worth it for anything with a brand colour, because a screen and a press disagree about red.",
                  },
                  {
                    question: "Do you do same day?",
                    answer:
                      "Digital work, yes, if the file is right and it is in before eleven. Litho and anything laminated, no — the laminate needs 24 hours to settle or it curls. We will say which yours is when you send it.",
                  },
                  {
                    question: "Is there a minimum order?",
                    answer:
                      "No. We have printed one poster and one T-shirt and neither was a favour. Small runs are digital and priced accordingly, which is honest rather than a penalty.",
                  },
                  {
                    question: "What if it comes out wrong?",
                    answer:
                      "If it is our mistake we reprint it, free, and usually before you have finished the phone call. If it is a typo in the artwork you approved, we reprint at cost — which is about 40% — because everybody does it once.",
                  },
                ]}
              />
            </div>
            <p className="mt-8 text-sm text-muted-foreground">
              <a className="underline underline-offset-4" href="/products">Every product, stock and finish</a>
              {" · "}
              <a className="underline underline-offset-4" href="/quote">Send artwork</a>
            </p>
          </section>
        </div>
      </div>
    </SiteChrome>
  );
}
