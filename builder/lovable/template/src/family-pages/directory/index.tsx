// directory — SEARCH-FIRST: the search bar IS the homepage. Nothing appears
// until somebody asks for it, and the only furniture is recent searches and
// categories. A directory homepage full of featured listings is a directory
// that has stopped believing in its own search.
import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { CategoryNav } from "@/components/ui/category-nav";
import { RecentSearches } from "@/components/ui/recent-searches";
import { SearchInput } from "@/components/ui/search-input";
import { SearchSuggestions } from "@/components/ui/search-suggestions";
import { SectionHeader } from "@/components/ui/section-header";
export const Route = createFileRoute("/")({ component: P });
export const CATEGORIES = [
  { key: "trades", label: "Trades", count: 412 },
  { key: "food", label: "Food & drink", count: 288 },
  { key: "health", label: "Health", count: 174 },
  { key: "shops", label: "Shops", count: 361 },
  { key: "services", label: "Services", count: 233 },
  { key: "groups", label: "Clubs & groups", count: 156 },
  { key: "venues", label: "Venues", count: 94 },
  { key: "care", label: "Childcare & care", count: 88 },
];
const ALL_SUGGESTIONS = [
  { label: "Plumber", hint: "68 in Sheffield" },
  { label: "Plumber, emergency", hint: "24 open now" },
  { label: "Plasterer", hint: "41 in Sheffield" },
  { label: "Play group", hint: "19 in Sheffield" },
  { label: "Electrician", hint: "97 in Sheffield" },
  { label: "Dentist, NHS", hint: "12 taking patients" },
  { label: "Dog groomer", hint: "34 in Sheffield" },
];
function P() {
  const [q, setQ] = React.useState("");
  const asked = q.trim().length >= 2;
  const suggestions = asked
    ? ALL_SUGGESTIONS.filter((s) => s.label.toLowerCase().includes(q.trim().toLowerCase()))
    : [];
  return (
    <SiteChrome name="Sheffield Index" tagline="Every business, club and service in Sheffield. Free to list, free to search."
      links={[{ label: "Browse", href: "/results" }, { label: "A listing", href: "/listing" }]}
      action={{ label: "Add a listing", href: "/listing" }}>

      {/* NOTHING ABOVE THE SEARCH AND NOTHING BESIDE IT. The centred column and
          the empty space are the design: a directory homepage carrying six
          featured listings has told you its search does not work. */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-2xl px-6 py-24 text-center sm:py-32">
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            What are you looking for?
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            1,806 businesses, clubs and services in Sheffield. Nobody pays to be here and nobody
            pays to be higher up.
          </p>
          <div className="relative mt-8 text-start">
            <SearchInput value={q} onChange={setQ} placeholder="Plumber, nursery, five-a-side, S6…" />
            {suggestions.length > 0 && (
              <SearchSuggestions className="absolute inset-x-0 top-full z-10 mt-1"
                items={suggestions} query={q} onSelect={(label) => setQ(label)} />
            )}
            {asked && suggestions.length === 0 && (
              <p className="mt-3 text-sm text-muted-foreground">
                Nothing starts with that. Try a trade rather than a company name — the index is
                organised by what people do.
              </p>
            )}
          </div>
          <div className="mt-8 text-start">
            <RecentSearches
              items={["Emergency plumber", "Nursery S6", "Five-a-side pitch", "NHS dentist"]}
              onSelect={(s) => setQ(s)} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-14">
        <SectionHeader eyebrow="Or browse" title="Eight categories, and that is the whole furniture"
          description="Counts are live. A category with nothing in it is not shown, because an empty category is worse than a missing one." />
        <CategoryNav className="mt-6" items={CATEGORIES} onSelect={() => {}} />
        <div className="mt-10 grid gap-8 sm:grid-cols-3">
          {[
            ["Free to list", "For everybody, forever. There is no premium tier and no verified badge to buy."],
            ["Ordered by relevance", "Not by who paid. Placement is not for sale here and never will be."],
            ["Kept up to date", "Every listing is asked to confirm itself twice a year. Ones that do not answer are marked, not deleted."],
          ].map(([k, v]) => (
            <div key={k} className="border-t border-border pt-4">
              <p className="font-medium">{k}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{v}</p>
            </div>
          ))}
        </div>
      </section>
    </SiteChrome>
  );
}
