// marketplace /browse — what is for sale, filtered, with the maker beside each
// thing. The maker is not a byline under the product: on a marketplace of one-
// person workshops, who made it IS the product information.
import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { FilterBar } from "@/components/ui/filter-bar";
import { ResultCount } from "@/components/ui/result-count";
import { SafeImage } from "@/components/ui/safe-image";
import { SearchInput } from "@/components/ui/search-input";
import { SectionHeader } from "@/components/ui/section-header";
import { SellerCard } from "@/components/ui/seller-card";
import { MAKERS } from "./index";
export const Route = createFileRoute("/browse")({ component: P });
const THINGS = [
  { name: "Oak chopping board, end grain", price: "£68", maker: "Ida Kolar", lead: "In stock" },
  { name: "Serving spoon, cherry", price: "£24", maker: "Ida Kolar", lead: "In stock" },
  { name: "Breakfast mug, speckled", price: "£28", maker: "Ben Achebe", lead: "Made to order, 3 weeks" },
  { name: "Jug, 1.5 litre", price: "£62", maker: "Ben Achebe", lead: "In stock" },
  { name: "Willow log basket", price: "£145", maker: "Rosa Lindqvist", lead: "Made to order, 6 weeks" },
  { name: "Shopping basket, small", price: "£78", maker: "Rosa Lindqvist", lead: "In stock" },
  { name: "Leather apron, waxed", price: "£120", maker: "Tam Oyelaran", lead: "Made to order, 2 weeks" },
  { name: "Chisel roll, eight pockets", price: "£56", maker: "Tam Oyelaran", lead: "In stock" },
  { name: "Linen tea towel, two colours", price: "£18", maker: "Priya Sandhu", lead: "In stock" },
];
function P() {
  const [q, setQ] = React.useState("");
  const [filters, setFilters] = React.useState([
    { key: "within", label: "Within 25 miles" },
    { key: "stock", label: "In stock now" },
  ]);
  const shown = THINGS.filter((t) => !q.trim() || (t.name + t.maker).toLowerCase().includes(q.toLowerCase()));
  return (
    <SiteChrome name="Made Round Here" tagline="A marketplace for things made within fifty miles of Sheffield."
      links={[{ label: "Home", href: "#/" }, { label: "Sell with us", href: "#/sell" }]}
      action={{ label: "Sell with us", href: "#/sell" }}>

      <div className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="Browse" title="Nine thousand things, made by four hundred people"
          description="Filtered by distance by default, because a marketplace that ships everything from everywhere is a marketplace with no reason to exist." />

        <div className="mt-8 max-w-md">
          <SearchInput value={q} onChange={setQ} placeholder="Pottery, oak, aprons, Bakewell…" />
        </div>
        <FilterBar className="mt-4" filters={filters}
          onRemove={(k) => setFilters((f) => f.filter((x) => x.key !== k))}
          onClear={() => setFilters([])} />
        <ResultCount className="mt-4" total={shown.length} from={shown.length ? 1 : 0} to={shown.length}
          noun="thing" filtered={filters.length > 0} />

        <div className="mt-8 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((t) => (
            <article key={t.name}>
              <SafeImage src={null} alt={t.name} ratio="1/1" fallbackSeed={t.name} />
              <h3 className="mt-3 text-base font-medium">{t.name}</h3>
              <p className="mt-0.5 text-base tabular-nums">{t.price}</p>
              {/* THE MAKER, not a brand line. On a marketplace of one-person
                  workshops this is what the buyer is choosing between. */}
              <p className="mt-1 text-sm text-muted-foreground">{t.maker} · {t.lead}</p>
            </article>
          ))}
        </div>
        {!shown.length && (
          <p className="mt-10 text-base text-muted-foreground">
            Nothing matches that. Try a material rather than a product — "oak", "willow", "linen" —
            or <a className="underline underline-offset-4" href="#/browse">clear the search</a>.
          </p>
        )}

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="Or by maker" title="Start with the person instead"
            description="Plenty of people find a maker they like and buy everything from them. That is the point." />
          <div className="mt-8 grid gap-x-10 gap-y-8 md:grid-cols-2 lg:grid-cols-3">
            {MAKERS.map((m) => <SellerCard key={m.name} {...m} href="#/browse" />)}
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
