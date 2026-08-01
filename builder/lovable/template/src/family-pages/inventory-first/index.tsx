// inventory-first — filter rail + result grid; the search sits where a hero
// would. A letting agency: the results start immediately.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { FilterBar } from "@/components/ui/filter-bar";
import { PropertyCard } from "@/components/ui/property-card";
import { ResultCount } from "@/components/ui/result-count";
import { SearchInput } from "@/components/ui/search-input";
import { SortSelect } from "@/components/ui/sort-select";
export const Route = createFileRoute("/")({ component: P });
function P() {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("newest");
  return (
    <SiteChrome name="Loxley Lets" tagline="Rentals across the west of the city."
      links={[{ label: "Tenants", href: "#results" }, { label: "Landlords", href: "#/landlords" }]}
      action={{ label: "Value my property", href: "#results" }}>
      <div className="mx-auto max-w-5xl px-6 py-10">
        {/* No hero. The search is the first thing, results the second. */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-64 flex-1"><SearchInput value={q} onChange={setQ} placeholder="Area, postcode, or street" /></div>
          <SortSelect value={sort} onChange={setSort} options={[
            { value: "newest", label: "Newest" }, { value: "low", label: "Rent: low to high" }, { value: "high", label: "Rent: high to low" }]} />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <FilterBar filters={[{ key: "beds", label: "2+ beds" }, { key: "pets", label: "Pets OK" }]} onRemove={() => {}} onClear={() => {}} />
          <ResultCount total={34} from={1} to={4} noun="home" filtered />
        </div>
        <div id="results" className="mt-6 grid gap-5 sm:grid-cols-2">
          <PropertyCard price="£925 pcm" address="Flat 2, 14 Commonside, Walkley" beds={2} baths={1} area="61 m²" status="New this week" href="#/listing" image={null} />
          <PropertyCard price="£1,150 pcm" address="7 Greenhow Street, Crookes" beds={3} baths={1} area="84 m²" href="#/listing" image={null} />
          <PropertyCard price="£795 pcm" address="Flat 5, Loxley Court, Malin Bridge" beds={1} baths={1} area="48 m²" href="#/listing" image={null} />
          <PropertyCard price="£1,400 pcm" address="22 Den Bank Crescent, Crosspool" beds={4} baths={2} area="112 m²" status="Garden" href="#/listing" image={null} />
        </div>
      </div>
    </SiteChrome>
  );
}
