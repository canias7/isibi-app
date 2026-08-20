// store/catalogue — HUNDREDS OF SKUs. Same cart-first family, and the hero is
// replaced by the search: with eight products a grid IS browsable and a hero
// sells the range; with two thousand, nobody browses, they look for a thing.
// So search and facets lead, the grid behaves like inventory — stock, code and
// lead time on every card — and the result count is always visible.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { CartBadge } from "@/components/ui/cart-badge";
import { FilterBar } from "@/components/ui/filter-bar";
import { ProductCard, type Product } from "@/components/ui/product-card";
import { ResultCount } from "@/components/ui/result-count";
import { SearchFacets } from "@/components/ui/search-facets";
import { SearchInput } from "@/components/ui/search-input";
import { SortSelect } from "@/components/ui/sort-select";
import { TrustStrip } from "@/components/ui/trust-strip";
export const Route = createFileRoute("/catalogue")({ component: P });
// `price` is narrowed to a number here, not left as Product's `number | string`.
// The catalogue sorts by it, and a union that includes string turns `a.price -
// b.price` into a type error — which is the type system correctly refusing to
// subtract "£4.20" from "£3.80".
type Line = Omit<Product, "price"> & { price: number; code: string; family: string; finish: string; stock: number; lead: string };
export const CATALOGUE: Line[] = [
  { code: "SH-1120", name: "Butt hinge, 100mm", price: 4.2, family: "hinges", finish: "brass", stock: 340, lead: "Stocked", note: "Pair, loose pin" },
  { code: "SH-1122", name: "Butt hinge, 100mm", price: 3.8, family: "hinges", finish: "steel", stock: 0, lead: "5 working days", soldOut: true, note: "Pair, fixed pin" },
  { code: "SH-1310", name: "Parliament hinge, 4in", price: 11.5, family: "hinges", finish: "brass", stock: 62, lead: "Stocked" },
  { code: "SH-2040", name: "Rim lock, 6in", price: 48, family: "locks", finish: "iron", stock: 18, lead: "Stocked", note: "Reversible, right or left" },
  { code: "SH-2044", name: "Rim lock, 6in", price: 54, was: 61, family: "locks", finish: "brass", stock: 4, lead: "Stocked", note: "End of a batch" },
  { code: "SH-2210", name: "Mortice latch, 76mm", price: 9.4, family: "locks", finish: "steel", stock: 210, lead: "Stocked" },
  { code: "SH-3010", name: "Cabinet knob, 32mm", price: 5.6, family: "knobs", finish: "brass", stock: 880, lead: "Stocked" },
  { code: "SH-3014", name: "Cabinet knob, 32mm", price: 6.2, family: "knobs", finish: "iron", stock: 24, lead: "Stocked" },
  { code: "SH-3120", name: "Cupboard turn", price: 7.8, family: "knobs", finish: "brass", stock: 0, lead: "3 weeks", soldOut: true, note: "Cast to order in batches of 200" },
  { code: "SH-4020", name: "Casement stay, 10in", price: 14.5, family: "window", finish: "iron", stock: 96, lead: "Stocked" },
  { code: "SH-4110", name: "Sash lift", price: 8.9, family: "window", finish: "brass", stock: 140, lead: "Stocked" },
  { code: "SH-4114", name: "Sash fastener, Brighton", price: 16, family: "window", finish: "brass", stock: 7, lead: "Stocked", note: "Last of the pre-2024 casting" },
];
const FACETS = {
  family: [
    { value: "hinges", label: "Hinges", count: 3 },
    { value: "locks", label: "Locks and latches", count: 3 },
    { value: "knobs", label: "Knobs and turns", count: 3 },
    { value: "window", label: "Window furniture", count: 3 },
  ],
  finish: [
    { value: "brass", label: "Polished brass", count: 6 },
    { value: "steel", label: "Bright steel", count: 2 },
    { value: "iron", label: "Black iron", count: 3 },
  ],
};
export function useCatalogue() {
  const [q, setQ] = useState("");
  const [family, setFamily] = useState<string[]>([]);
  const [finish, setFinish] = useState<string[]>([]);
  const [inStock, setInStock] = useState(false);
  const [sort, setSort] = useState("relevance");
  const shown = CATALOGUE
    .filter((p) => !q || (p.name + p.code).toLowerCase().includes(q.toLowerCase()))
    .filter((p) => !family.length || family.includes(p.family))
    .filter((p) => !finish.length || finish.includes(p.finish))
    .filter((p) => !inStock || p.stock > 0)
    .sort((a, b) => (sort === "price-up" ? a.price - b.price : sort === "price-down" ? b.price - a.price : 0));
  return { q, setQ, family, setFamily, finish, setFinish, inStock, setInStock, sort, setSort, shown };
}
function P() {
  const s = useCatalogue();
  const toggle = (set: (f: (v: string[]) => string[]) => void) => (v: string) =>
    set((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]));
  const chips = [
    ...s.family.map((f) => ({ key: `f${f}`, label: FACETS.family.find((x) => x.value === f)?.label ?? f })),
    ...s.finish.map((f) => ({ key: `n${f}`, label: FACETS.finish.find((x) => x.value === f)?.label ?? f })),
    ...(s.inStock ? [{ key: "stock", label: "In stock only" }] : []),
  ];
  return (
    <SiteChrome name="Ellery Ironmongery" tagline="Period door and window furniture. 2,140 lines, 1,880 of them on the shelf."
      links={[{ label: "One product", href: "/product" }, { label: "Basket", href: "/checkout" }]}
      action={{ label: "Checkout", href: "/checkout" }}>

      {/* THE SEARCH IS THE HERO. With eight products a grid is browsable and a
          hero sells the range; with 2,140 nobody browses — they look for a
          thing, and a hero is a screen between them and it. */}
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-3xl font-semibold tracking-tight text-balance">2,140 lines. What are you after?</h1>
              <p className="mt-2 max-w-2xl text-base text-muted-foreground">
                Search by name or by our code. If you have the code off an old invoice or the back of
                a hinge, that is the fastest way in — and it will still find a line we discontinued
                in 2019 and tell you what replaced it.
              </p>
            </div>
            <CartBadge count={2} href="/checkout" />
          </div>
          <SearchInput className="mt-6" value={s.q} onChange={s.setQ} placeholder="Rim lock, SH-2040, brass butt hinge…" />
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid gap-10 lg:grid-cols-[240px_1fr]">
          <aside className="space-y-6">
            <SearchFacets title="Family" selected={s.family} onToggle={toggle(s.setFamily)} options={FACETS.family} />
            <SearchFacets title="Finish" selected={s.finish} onToggle={toggle(s.setFinish)} options={FACETS.finish} />
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-foreground" checked={s.inStock}
                onChange={(e) => s.setInStock(e.target.checked)} />
              In stock today only
            </label>
            {/* OUT OF STOCK STAYS VISIBLE BY DEFAULT, with a lead time. Hiding
                it makes the range look thinner than it is and sends a trade
                buyer to a competitor for something we could have had in five
                days — which is why this is opt-IN rather than opt-out. */}
            <p className="text-sm leading-relaxed text-muted-foreground">
              Out-of-stock lines are shown by default, with the real lead time on each. Hiding them
              would make the range look thinner than it is.
            </p>
          </aside>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <ResultCount total={s.shown.length} noun="line" filtered={s.shown.length !== CATALOGUE.length} />
              <SortSelect value={s.sort} onChange={s.setSort} options={[
                { value: "relevance", label: "Most relevant" },
                { value: "price-up", label: "Price, low to high" },
                { value: "price-down", label: "Price, high to low" },
              ]} />
            </div>
            {chips.length > 0 && (
              <FilterBar className="mt-3" filters={chips}
                onRemove={(k) => {
                  if (k === "stock") s.setInStock(false);
                  else if (k.startsWith("f")) s.setFamily((c) => c.filter((x) => x !== k.slice(1)));
                  else s.setFinish((c) => c.filter((x) => x !== k.slice(1)));
                }}
                onClear={() => { s.setFamily([]); s.setFinish([]); s.setInStock(false); }} />
            )}

            {s.shown.length === 0 ? (
              <div className="mt-8 rounded-lg border border-dashed border-border p-10 text-center">
                <p className="text-base font-medium">Nothing matches all of those</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Take the finish off first — it is the filter that empties a search most often.
                  Or ring 0114 272 3300 and describe it; we are quite good at that.
                </p>
              </div>
            ) : (
              <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {s.shown.map((p) => (
                  <div key={p.code} className="flex flex-col">
                    <ProductCard product={p} href="/product" />
                    {/* INVENTORY, NOT MERCHANDISING. Code, count and lead time
                        on every card — a trade buyer orders by code and plans
                        by lead time, and neither is a marketing decision. */}
                    <p className="mt-1.5 flex flex-wrap items-baseline gap-x-3 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground tabular-nums">{p.code}</span>
                      <span className="tabular-nums">
                        {p.stock > 0 ? `${p.stock} on the shelf` : "None on the shelf"}
                      </span>
                      <span>{p.lead}</span>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <section className="mt-14 border-t border-border pt-10">
          <TrustStrip items={[
            { title: "Free carriage over £75", description: "Trade and retail, same threshold, no account needed" },
            { title: "Ordered by 15:00, out the same day", description: "On anything showing stock. It is a real cut-off, not an aspiration" },
            { title: "We will match an old fitting", description: "Post us one and we will find it or tell you nobody makes it" },
          ]} />
        </section>
      </div>
    </SiteChrome>
  );
}
