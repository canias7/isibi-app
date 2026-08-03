// store/catalogue /product — one line, told as INVENTORY rather than as a
// story. A single-product shop's page is a narrative; a catalogue's is a spec
// sheet with a stock count, because the buyer already knows what a rim lock is
// and is checking whether this one fits the door they are standing in front of.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { AddToCart } from "@/components/ui/add-to-cart";
import { CartBadge } from "@/components/ui/cart-badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PriceTag } from "@/components/ui/price-tag";
import { ProductCard } from "@/components/ui/product-card";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { SpecList, SpecRow } from "@/components/ui/spec-row";
import { StockLevel } from "@/components/ui/stock-level";
import { CATALOGUE } from "./index";
export const Route = createFileRoute("/product")({ component: P });
type Variant = Record<string, unknown> & { code: string; finish: string; stock: number; price: string; lead: string };
const VARIANTS: Variant[] = [
  { code: "SH-2040", finish: "Black iron", stock: 18, price: "£48.00", lead: "Stocked" },
  { code: "SH-2044", finish: "Polished brass", stock: 4, price: "£54.00", lead: "Stocked" },
  { code: "SH-2046", finish: "Antique bronze", stock: 0, price: "£56.00", lead: "3 weeks" },
  { code: "SH-2048", finish: "Bright chrome", stock: 31, price: "£51.00", lead: "Stocked" },
];
function P() {
  const [qty, setQty] = useState(1);
  const columns: Column<Variant>[] = [
    { key: "code", header: "Code", cell: (v) => <span className="font-medium tabular-nums">{v.code}</span> },
    { key: "finish", header: "Finish" },
    { key: "stock", header: "On the shelf", numeric: true, cell: (v) => (
      <span className="tabular-nums">{v.stock > 0 ? v.stock : "—"}</span>
    ) },
    { key: "lead", header: "If we have none" },
    { key: "price", header: "Price", numeric: true },
  ];
  return (
    <SiteChrome name="Ellery Ironmongery" tagline="Period door and window furniture. 2,140 lines, 1,880 of them on the shelf."
      links={[{ label: "The catalogue", href: "#/" }, { label: "Basket", href: "#/checkout" }]}
      action={{ label: "Checkout", href: "#/checkout" }}>

      <div className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-sm text-muted-foreground">
          <a className="underline underline-offset-4" href="#/">Catalogue</a> · Locks and latches · SH-2040
        </p>

        <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_1fr]">
          <div className="grid grid-cols-2 gap-4">
            <SafeImage src={null} alt="Rim lock SH-2040, black iron, face on" ratio="1/1" className="col-span-2" />
            <SafeImage src={null} alt="The keep, mounted" ratio="1/1" />
            <SafeImage src={null} alt="The reverse, showing the fixing centres" ratio="1/1" />
          </div>

          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-balance">Rim lock, 6 inch</h1>
            <p className="mt-2 text-base text-muted-foreground">
              Cast iron case, brass lever, reversible for a left or right hand door. Supplied with a
              keep, two keys and the screws — which is worth saying because half the trade does not.
            </p>
            <div className="mt-5 flex flex-wrap items-baseline gap-4">
              <PriceTag price={48} />
              <span className="text-sm text-muted-foreground">Black iron, SH-2040</span>
            </div>
            <div className="mt-4">
              <StockLevel count={18} lowAt={10} />
            </div>
            <div className="mt-6 max-w-sm">
              <AddToCart quantity={qty} onQuantity={setQty} onAdd={() => undefined} />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Ordered by 15:00 and it goes out today. Free carriage over £75, and there is no trade
              account to open — the price on this page is the price everybody pays.
            </p>

            <div className="mt-8">
              <SpecList>
                <SpecRow label="Case" value="Cast iron, 152 × 102mm" />
                <SpecRow label="Backset" value="60mm" note="Measured from the edge of the door to the centre of the knob spindle" highlight />
                <SpecRow label="Spindle" value="8mm square" note="Takes any of our knobs and turns without an adaptor" />
                <SpecRow label="Handing" value="Reversible" note="Take the cover off and turn the latch. Two minutes and no parts" highlight />
                <SpecRow label="Keys" value="Two, cut to the lock" note="Further keys £6 each, cut from the number stamped inside" />
                <SpecRow label="Door thickness" value="35mm and up" note="Below 35mm the fixing screws break through. It happens" />
                <SpecRow label="Fixing centres" value="Shown in the third photograph" note="Match these against an old lock before ordering — they are not standard across makers" />
                <SpecRow label="Made" value="Sheffield, since 1974" />
              </SpecList>
            </div>
          </div>
        </div>

        {/* THE FINISHES AS A TABLE, not as swatches. A trade buyer picking a
            finish is really picking a CODE and a stock count, and a row of
            coloured circles answers neither. */}
        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="The same lock" title="Four finishes, four codes, four stock counts"
            description="Swatches look nicer and tell you nothing. What you actually need is which code to put on the order and whether it is on the shelf today." />
          <div className="mt-6">
            <DataTable columns={columns} rows={VARIANTS} rowKey={(v) => v.code}
              empty="No finishes listed — that is a data error, please ring us." />
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Antique bronze is cast to order in batches, which is why it is three weeks rather than
            out of stock. We will not take the order and then tell you.
          </p>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="Goes with" title="What people order alongside it"
            description="Not a recommendation engine — this is what actually went on the same invoices last year." />
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {CATALOGUE.filter((p) => p.family === "knobs" || p.code === "SH-1120" || p.code === "SH-1310").slice(0, 4).map((p) => (
              <div key={p.code} className="flex flex-col">
                <ProductCard product={p} href="#/product" />
                <p className="mt-1.5 flex flex-wrap items-baseline gap-x-3 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground tabular-nums">{p.code}</span>
                  <span className="tabular-nums">{p.stock > 0 ? `${p.stock} on the shelf` : "None on the shelf"}</span>
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
