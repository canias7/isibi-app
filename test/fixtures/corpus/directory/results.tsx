// directory /results — what a search returns, counted, filtered, and honest
// when empty. The empty state is the page that matters: a directory that
// answers "no results" and stops has sent somebody to a search engine.
import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { CategoryNav } from "@/components/ui/category-nav";
import { ResultCount } from "@/components/ui/result-count";
import { SearchInput } from "@/components/ui/search-input";
import { SectionHeader } from "@/components/ui/section-header";
import { CATEGORIES } from "./index";
export const Route = createFileRoute("/results")({ component: P });
const RESULTS = [
  { name: "Hallam Plumbing & Heating", what: "Plumber · Gas Safe 512844", where: "Walkley, S6", open: "Open until 18:00", note: "Emergency callout, 24 hours" },
  { name: "R. Naylor & Son", what: "Plumber · Gas Safe 208177", where: "Hillsborough, S6", open: "Closed — opens 08:00", note: "Boilers and bathrooms, since 1974" },
  { name: "Rivelin Drains", what: "Drainage · WaterSafe", where: "Malin Bridge, S6", open: "Open until 20:00", note: "Drains and CCTV surveys only" },
  { name: "Kaur Heating", what: "Plumber · Gas Safe 663901", where: "Crookes, S10", open: "Open until 17:30", note: "Landlord certificates" },
  { name: "Broomhill Bathrooms", what: "Bathroom fitter", where: "Broomhill, S10", open: "Closed — opens Tuesday", note: "Fitting only, no supply" },
  { name: "Steel City Emergency Plumbers", what: "Plumber", where: "City centre, S3", open: "Open now", note: "Confirmed 14 months ago — details may be out of date" },
];
function P() {
  const [q, setQ] = React.useState("plumber");
  const [cat, setCat] = React.useState<string | null>("trades");
  const shown = RESULTS.filter((r) => !q.trim() || (r.name + r.what).toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <SiteChrome name="Sheffield Index" tagline="Every business, club and service in Sheffield. Free to list, free to search."
      links={[{ label: "Home", href: "/" }, { label: "A listing", href: "/listing" }]}
      action={{ label: "Add a listing", href: "/listing" }}>

      <div className="mx-auto max-w-4xl px-6 py-14">
        <div className="max-w-xl">
          <SearchInput value={q} onChange={setQ} placeholder="Plumber, nursery, five-a-side, S6…" />
        </div>
        <CategoryNav className="mt-4" items={CATEGORIES} active={cat} onSelect={setCat} />
        <ResultCount className="mt-4" total={shown.length} from={shown.length ? 1 : 0} to={shown.length}
          noun="listing" filtered={!!cat} />

        {shown.length > 0 ? (
          <ul className="mt-6 divide-y divide-border border-y border-border">
            {shown.map((r) => (
              <li key={r.name} className="py-5">
                <a href="/listing" className="group block">
                  <h2 className="text-lg font-medium underline-offset-4 group-hover:underline">{r.name}</h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">{r.what} · {r.where}</p>
                  <p className="mt-1 flex flex-wrap items-baseline gap-x-3 text-sm">
                    {/* Open/closed in WORDS. A green dot and a grey one are one
                        dot in greyscale and on a phone in daylight. */}
                    <span className={r.open.startsWith("Open") ? "font-medium" : "text-muted-foreground"}>{r.open}</span>
                    <span className="text-muted-foreground">{r.note}</span>
                  </p>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          /* THE EMPTY STATE IS THE PAGE THAT MATTERS. "No results" and a full
             stop is how a directory sends somebody to a search engine and
             loses them for good. */
          <div className="mt-8 max-w-xl">
            <SectionHeader eyebrow="Nothing found" title={`No listings for "${q}"`}
              description="Which is genuinely possible — the index is Sheffield only, and it is organised by what people do rather than by company name." />
            <ul className="mt-6 space-y-2 text-base">
              <li className="border-b border-border pb-2">Try the trade rather than the firm: "plasterer", not "Dave's Plastering"</li>
              <li className="border-b border-border pb-2">Try a postcode on its own — "S6" returns everything in Walkley and Hillsborough</li>
              <li className="border-b border-border pb-2">Browse a category above; there are 1,806 listings and eight ways in</li>
              <li className="border-b border-border pb-2">
                Know somebody who should be here? <a className="underline underline-offset-4" href="/listing">Add them, free</a> — most of the index arrived that way
              </li>
            </ul>
          </div>
        )}

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="How this is ordered" title="By relevance, and nothing else"
            description="Not by who paid, because nobody can pay. Within a search the order is how well the listing matches, then how recently it confirmed its own details." />
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            A listing that has not confirmed itself in over a year says so on its own row, as the
            last result above does. We do not delete them — a stale phone number is still more use
            than nothing — but we will not let one sit at the top pretending to be current.
          </p>
        </section>
      </div>
    </SiteChrome>
  );
}
