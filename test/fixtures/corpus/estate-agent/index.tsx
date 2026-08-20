// estate-agent — CARD-GRID structure: a page for browsing, not reading.
// No hero, no bands, no section eyebrows — a search strip pinned at the top
// and then uniform cards wall to wall, the way a person actually hunts for
// a home. The skeleton IS the difference from a reading site.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { FilterBar } from "@/components/ui/filter-bar";
import { PropertyCard } from "@/components/ui/property-card";
import { ResultCount } from "@/components/ui/result-count";
import { SearchInput } from "@/components/ui/search-input";
import { SortSelect } from "@/components/ui/sort-select";
export const Route = createFileRoute("/")({ component: P });
const HOMES = [
  { price: "£925 pcm", address: "Flat 2, 14 Commonside, Walkley", beds: 2, baths: 1, area: "61 m²", status: "New this week" },
  { price: "£1,150 pcm", address: "7 Greenhow Street, Crookes", beds: 3, baths: 1, area: "84 m²" },
  { price: "£795 pcm", address: "Flat 5, Loxley Court, Malin Bridge", beds: 1, baths: 1, area: "48 m²" },
  { price: "£1,400 pcm", address: "22 Den Bank Crescent, Crosspool", beds: 4, baths: 2, area: "112 m²", status: "Garden" },
  { price: "£850 pcm", address: "Flat 1, 96 South Road, Walkley", beds: 2, baths: 1, area: "58 m²" },
  { price: "£1,050 pcm", address: "18 Toftwood Road, Crookes", beds: 3, baths: 1, area: "79 m²", status: "Students OK" },
  { price: "£975 pcm", address: "Flat 3, Burgoyne Road, Walkley", beds: 2, baths: 1, area: "63 m²" },
  { price: "£1,250 pcm", address: "41 Springvale Road, Crookes", beds: 3, baths: 2, area: "91 m²", status: "Just reduced" },
  { price: "£725 pcm", address: "Studio 6, Hillsborough Works", beds: 1, baths: 1, area: "39 m²" },
];
function P() {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("newest");
  return (
    <SiteChrome name="Loxley Lets" tagline="Rentals across the west of the city."
      links={[{ label: "Tenants", href: "#results" }, { label: "Landlords", href: "/landlords" }]}
      action={{ label: "Value my property", href: "/landlords" }}>

      {/* The search strip is the whole header story — results start at once. */}
      <div className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-64 flex-1"><SearchInput value={q} onChange={setQ} placeholder="Area, postcode, or street" /></div>
            <SortSelect value={sort} onChange={setSort} options={[
              { value: "newest", label: "Newest" }, { value: "low", label: "Rent: low to high" }, { value: "high", label: "Rent: high to low" }]} />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <FilterBar filters={[{ key: "beds", label: "2+ beds" }, { key: "pets", label: "Pets OK" }]} onRemove={() => {}} onClear={() => {}} />
            <ResultCount total={34} from={1} to={9} noun="home" filtered />
          </div>
        </div>
      </div>

      <div id="results" className="mx-auto max-w-6xl px-6 py-8">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {HOMES.map((h) => <PropertyCard key={h.address} {...h} href="/listing" image={null} />)}
        </div>
        <div className="mt-8 flex items-center justify-between border-t border-border pt-5 text-sm text-muted-foreground">
          <span>Showing 9 of 34 — new homes most weekday mornings</span>
          <a className="font-medium text-foreground underline underline-offset-4" href="#results">Next page →</a>
        </div>
        <p className="mt-10 rounded-lg border bg-muted/40 p-4 text-sm">Own a property round here? We manage 240 homes within three miles — <a className="font-medium underline underline-offset-4" href="/landlords">see what yours would let for →</a></p>
      </div>
    </SiteChrome>
  );
}
