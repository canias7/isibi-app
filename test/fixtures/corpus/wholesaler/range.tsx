// wholesaler /range — the products with case and pallet pricing and the break
// quantities visible. A trade buyer is doing arithmetic, not browsing, so the
// unit price at each break is the page rather than a photograph of a tub.
import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { BulkPricing } from "@/components/ui/bulk-pricing";
import { DataTable } from "@/components/ui/data-table";
import { Faq } from "@/components/ui/faq";
import { QuantityBreak } from "@/components/ui/quantity-break";
import { SectionHeader } from "@/components/ui/section-header";
import { SpecList, SpecRow } from "@/components/ui/spec-row";
import { StockLevel } from "@/components/ui/stock-level";
import { TradeTerms } from "@/components/ui/trade-terms";
import { TERMS } from "./index";
export const Route = createFileRoute("/range")({ component: P });
type Line = Record<string, unknown> & {
  code: string; name: string; pack: string; unit: string; caseP: string; pallet: string;
};
const LINES: Line[] = [
  { code: "DG-1140", name: "Rapeseed oil", pack: "20L drum", unit: "£28.40", caseP: "£27.10", pallet: "£25.90" },
  { code: "DG-2205", name: "Plain flour, T55", pack: "16kg sack", unit: "£11.20", caseP: "£10.60", pallet: "£9.95" },
  { code: "DG-2310", name: "Caster sugar", pack: "25kg sack", unit: "£19.80", caseP: "£18.90", pallet: "£17.60" },
  { code: "CH-0410", name: "Mature cheddar block", pack: "5kg", unit: "£31.50", caseP: "£30.20", pallet: "—" },
  { code: "CH-0620", name: "Salted butter", pack: "10 × 250g", unit: "£17.90", caseP: "£17.10", pallet: "£16.40" },
  { code: "DS-1010", name: "Kraft takeaway box, 750ml", pack: "300", unit: "£38.00", caseP: "£36.20", pallet: "£33.50" },
  { code: "DS-1180", name: "Compostable cup, 12oz", pack: "1000", unit: "£62.00", caseP: "£59.40", pallet: "£55.00" },
  { code: "DS-2040", name: "Blue roll, 2-ply", pack: "6 rolls", unit: "£9.40", caseP: "£8.90", pallet: "£8.10" },
  { code: "CL-0330", name: "Degreaser concentrate", pack: "5L", unit: "£12.60", caseP: "£11.95", pallet: "£11.20" },
  { code: "CL-0510", name: "Machine dishwash tablets", pack: "200", unit: "£41.00", caseP: "£39.50", pallet: "£36.80" },
];
function P() {
  const [qty, setQty] = React.useState(14);
  return (
    <SiteChrome name="Attercliffe Catering Supplies" tagline="Dry goods, chilled and disposables to independent kitchens across South Yorkshire."
      links={[{ label: "Home", href: "/" }, { label: "Open an account", href: "/account" }]}
      action={{ label: "Open an account", href: "/account" }}>

      <div className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="The range" title="2,400 lines, and the arithmetic on all of them"
          description="Trade prices, before VAT, at three quantities. The break points are on the page because that is the only decision a buyer is actually making." />

        <section className="mt-10 grid gap-12 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Ten of them, as an example</h2>
            <div className="mt-3">
              <DataTable<Line>
                rowKey={(r) => r.code}
                columns={[
                  { key: "code", header: "Code" },
                  { key: "name", header: "Line" },
                  { key: "pack", header: "Pack" },
                  { key: "unit", header: "1–4", numeric: true },
                  { key: "caseP", header: "5–19", numeric: true },
                  { key: "pallet", header: "Pallet", numeric: true },
                ]}
                rows={LINES}
              />
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              A dash in the pallet column means it does not come on one — chilled cheese is a case
              product and a pallet of it would be out of date before anybody got through it. The
              full list is 2,400 lines and it is the PDF on the front page.
            </p>

            <h2 className="mt-8 text-sm font-medium uppercase tracking-widest text-muted-foreground">Worked example — kraft boxes</h2>
            <div className="mt-3 rounded-lg border border-border p-5">
              <SpecList>
                <SpecRow label="Line" value="DS-1010 · Kraft takeaway box, 750ml" />
                <SpecRow label="Pack" value="300 per case" />
                <SpecRow label="Material" value="Board, PE-lined" note="Recyclable in most South Yorkshire kerbside schemes; not compostable, and we will not say it is" />
                <SpecRow label="Lead time" value="On the van" note="Stocked. Nothing on this page is a special order" />
              </SpecList>
              <div className="mt-5">
                <StockLevel count={62} lowAt={20} />
              </div>
              <div className="mt-5">
                <label className="text-sm font-medium" htmlFor="qty">How many cases</label>
                <input id="qty" type="range" min={1} max={40} value={qty}
                  onChange={(e) => setQty(Number(e.target.value))}
                  className="mt-2 w-full accent-foreground" />
                <p className="mt-1 text-sm tabular-nums text-muted-foreground">{qty} cases</p>
              </div>
              <BulkPricing className="mt-5" quantity={qty} tiers={[
                { min: 1, priceMinor: 3800 },
                { min: 5, priceMinor: 3620 },
                { min: 20, priceMinor: 3350 },
              ]} />
              <QuantityBreak className="mt-4" quantity={qty} nextAt={20} nextPriceMinor={3350} />
            </div>
          </div>
          <div>
            <TradeTerms {...TERMS} columns={1} heading="Reminder of the terms"
              note="Every price on this page assumes an approved account. Collection is the same price with no minimum." />

            <h2 className="mt-8 text-sm font-medium uppercase tracking-widest text-muted-foreground">How ordering works</h2>
            <ol className="mt-3 divide-y divide-border border-y border-border text-base">
              <li className="py-3.5">
                <span className="font-medium">Email, phone or the order pad</span>
                <span className="block text-sm text-muted-foreground">There is no portal. Two hundred of our three hundred and forty accounts send a photograph of a handwritten list and it works perfectly.</span>
              </li>
              <li className="py-3.5">
                <span className="font-medium">Cut-off is 15:00 the day before the van</span>
                <span className="block text-sm text-muted-foreground">Monday for Tuesday, Wednesday for Thursday. After that it rolls to the next one and we will tell you rather than let you assume.</span>
              </li>
              <li className="py-3.5">
                <span className="font-medium">We ring back on anything short</span>
                <span className="block text-sm text-muted-foreground">Before the van loads, not after it arrives. Substitutions only if you say yes to the specific one.</span>
              </li>
              <li className="py-3.5">
                <span className="font-medium">Delivered between six and eleven</span>
                <span className="block text-sm text-muted-foreground">We do not give a narrower window because we cannot keep one. The driver rings twenty minutes out.</span>
              </li>
              <li className="py-3.5">
                <span className="font-medium">Invoice follows, 30 days</span>
                <span className="block text-sm text-muted-foreground">One a month if you would rather, which most kitchens prefer. No card fee, no early settlement discount and no late fee under fourteen days.</span>
              </li>
            </ol>
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="max-w-3xl">
            <SectionHeader eyebrow="Asked often" title="About the range and the prices" />
            <Faq className="mt-6" items={[
              { question: "How often do prices change?", answer: "The list is reissued monthly and held for that month. Dairy and oil are the two that genuinely move; if either jumps mid-month we absorb it until the next list rather than repricing an order somebody has already placed." },
              { question: "Do you price match?", answer: "No. One published list for everybody. If a competitor is cheaper on a line, tell us and we will either move the price for everybody or say honestly that we cannot get near it." },
              { question: "Can I mix cases to hit a break?", answer: "Within a product, yes — twenty cases of the same line gets the pallet price whether or not it comes on a pallet. Across different lines, no; the break is a handling saving on that line." },
              { question: "What if something is out of stock?", answer: "We ring before the van loads. You choose to wait, take a substitute we name, or drop it. Nothing gets swapped silently, which is the single most common complaint about the big wholesalers." },
              { question: "Do you do own-label?", answer: "Nine lines, mostly oil and disposables, and the spec sheets are in the download pack. They are the same factory as two national brands and about 15% less." },
              { question: "Can I get a sample?", answer: "One of anything under £30 a case, free, on the next van. Ask for it by code." },
            ]} />
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
