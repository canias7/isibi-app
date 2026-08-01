// inventory-first — filter rail + result grid; the search sits where a hero
// would. A letting agency: a thin masthead states the promise, then the
// search surface, then results — browsing starts immediately. The second
// audience gets its own band at the bottom.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { CtaBand } from "@/components/ui/cta-band";
import { FilterBar } from "@/components/ui/filter-bar";
import { PropertyCard } from "@/components/ui/property-card";
import { ResultCount } from "@/components/ui/result-count";
import { SearchInput } from "@/components/ui/search-input";
import { SectionHeader } from "@/components/ui/section-header";
import { SortSelect } from "@/components/ui/sort-select";
import { TrustStrip } from "@/components/ui/trust-strip";
export const Route = createFileRoute("/")({ component: P });
function P() {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("newest");
  return (
    <SiteChrome name="Loxley Lets" tagline="Rentals across the west of the city."
      links={[{ label: "Tenants", href: "#results" }, { label: "Landlords", href: "#/landlords" }]}
      action={{ label: "Value my property", href: "#/landlords" }}>

      {/* Thin masthead — the family's hero IS the search below it. */}
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-10">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Walkley · Crookes · Crosspool · Hillsborough</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Thirty-four homes to let, west of the city</h1>
          <div className="mt-6 rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-64 flex-1"><SearchInput value={q} onChange={setQ} placeholder="Area, postcode, or street" /></div>
              <SortSelect value={sort} onChange={setSort} options={[
                { value: "newest", label: "Newest" }, { value: "low", label: "Rent: low to high" }, { value: "high", label: "Rent: high to low" }]} />
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <FilterBar filters={[{ key: "beds", label: "2+ beds" }, { key: "pets", label: "Pets OK" }]} onRemove={() => {}} onClear={() => {}} />
              <ResultCount total={34} from={1} to={6} noun="home" filtered />
            </div>
          </div>
        </div>
      </section>

      <section id="results" className="mx-auto max-w-5xl px-6 py-12">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <PropertyCard price="£925 pcm" address="Flat 2, 14 Commonside, Walkley" beds={2} baths={1} area="61 m²" status="New this week" href="#/listing" image={null} />
          <PropertyCard price="£1,150 pcm" address="7 Greenhow Street, Crookes" beds={3} baths={1} area="84 m²" href="#/listing" image={null} />
          <PropertyCard price="£795 pcm" address="Flat 5, Loxley Court, Malin Bridge" beds={1} baths={1} area="48 m²" href="#/listing" image={null} />
          <PropertyCard price="£1,400 pcm" address="22 Den Bank Crescent, Crosspool" beds={4} baths={2} area="112 m²" status="Garden" href="#/listing" image={null} />
          <PropertyCard price="£850 pcm" address="Flat 1, 96 South Road, Walkley" beds={2} baths={1} area="58 m²" href="#/listing" image={null} />
          <PropertyCard price="£1,050 pcm" address="18 Toftwood Road, Crookes" beds={3} baths={1} area="79 m²" status="Students OK" href="#/listing" image={null} />
        </div>
        <p className="mt-6 text-center text-sm text-muted-foreground">Showing 6 of 34 — new homes go up most weekday mornings.</p>
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <SectionHeader eyebrow="Renting with us" title="What tenants actually get" />
          <TrustStrip className="mt-6" items={[
            { title: "No tenant fees", description: "Not for referencing, not for renewals, not for anything" },
            { title: "Repairs in 48 hours", description: "Our own trades, not a call centre" },
            { title: "Deposits protected", description: "DPS, with the certificate emailed same-day" },
          ]} />
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-14">
        <CtaBand title="Own a property round here?" description="We manage 240 homes within three miles — nine days median to let, 0.4% arrears." action={{ label: "What yours would let for", href: "#/landlords" }} />
      </section>
    </SiteChrome>
  );
}
