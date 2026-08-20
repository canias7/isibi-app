// estate-agent/date-picker — TRAVEL AND HOTEL. The search-first family opens
// with a filter rail over a result grid; a place booked by the NIGHT cannot
// show a result at all until it knows the dates, because a listing with no
// dates has no price and may not even be available. So dates and party size
// come first, and the results below are priced FOR those dates.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { FacetRange } from "@/components/ui/facet-range";
import { FilterBar } from "@/components/ui/filter-bar";
import { PropertyCard } from "@/components/ui/property-card";
import { ResultCount } from "@/components/ui/result-count";
import { SearchFacets } from "@/components/ui/search-facets";
import { SectionHeader } from "@/components/ui/section-header";
import { SortSelect } from "@/components/ui/sort-select";
export const Route = createFileRoute("/date-picker")({ component: P });
export type Let = {
  key: string; name: string; where: string; sleeps: number; beds: number; baths: number;
  perNight: number; kind: string; dogs: boolean; hotTub: boolean; free: boolean; note: string;
};
export const LETS: Let[] = [
  { key: "beck", name: "Beck Cottage", where: "Kettlewell, Wharfedale", sleeps: 4, beds: 2, baths: 1, perNight: 132, kind: "cottage", dogs: true, hotTub: false, free: true, note: "Two minutes from the pub, and the beck is at the bottom of the garden" },
  { key: "byre", name: "The Byre", where: "Arncliffe, Littondale", sleeps: 2, beds: 1, baths: 1, perNight: 108, kind: "barn", dogs: true, hotTub: false, free: true, note: "One room, one very good bed, and no phone signal at all" },
  { key: "mill", name: "Mill House", where: "Hebden, Wharfedale", sleeps: 8, beds: 4, baths: 3, perNight: 265, kind: "house", dogs: false, hotTub: true, free: true, note: "The one people book for a birthday. Sleeps eight properly rather than optimistically" },
  { key: "shep", name: "Shepherd's hut", where: "Buckden", sleeps: 2, beds: 1, baths: 1, perNight: 88, kind: "hut", dogs: true, hotTub: false, free: false, note: "Taken for your dates — free again from the 24th" },
  // Taken, and it sleeps 6 — deliberately, because the panel at the foot of
  // this page argues that a taken place should STAY on the page, and the only
  // other unavailable one sleeps 2. At the default party size of four it was
  // filtered out before the reader ever saw the case being made.
  { key: "fold", name: "Fold Barn", where: "Starbotton", sleeps: 6, beds: 3, baths: 2, perNight: 198, kind: "barn", dogs: true, hotTub: true, free: false, note: "Taken until the 22nd — free from the 23rd, and that week is the quiet one" },
  { key: "green", name: "Green End", where: "Grassington", sleeps: 4, beds: 2, baths: 2, perNight: 145, kind: "cottage", dogs: false, hotTub: false, free: true, note: "In the village, on the square, and parking is fifty yards away rather than outside" },
];
function P() {
  const [when, setWhen] = useState("3n");
  const [guests, setGuests] = useState(4);
  const [kind, setKind] = useState<string[]>([]);
  const [extras, setExtras] = useState<string[]>([]);
  const [price, setPrice] = useState({ from: 80, to: 300 });
  const [sort, setSort] = useState("price-up");
  const nights = when === "2n" ? 2 : when === "3n" ? 3 : when === "7n" ? 7 : 4;
  const shown = LETS
    .filter((l) => l.sleeps >= guests)
    .filter((l) => !kind.length || kind.includes(l.kind))
    .filter((l) => !extras.includes("dogs") || l.dogs)
    .filter((l) => !extras.includes("tub") || l.hotTub)
    .filter((l) => l.perNight >= price.from && l.perNight <= price.to)
    .sort((a, b) => (sort === "price-up" ? a.perNight - b.perNight : sort === "price-down" ? b.perNight - a.perNight : b.sleeps - a.sleeps));
  const chips = [
    { key: "when", label: `${nights} nights from Fri 14 Aug` },
    { key: "guests", label: `${guests} people` },
    ...kind.map((k) => ({ key: `k${k}`, label: k })),
    ...extras.map((e) => ({ key: `e${e}`, label: e === "dogs" ? "Dogs welcome" : "Hot tub" })),
  ];
  return (
    <SiteChrome name="Dales Lets" tagline="Twenty-two cottages, barns and huts in Upper Wharfedale. Booked direct."
      links={[{ label: "One cottage", href: "/listing" }, { label: "Owners", href: "/landlords" }]}
      action={{ label: "Ring 01756 760 210", href: "tel:01756760210" }}>

      {/* DATES BEFORE ANY RESULT. A property with no dates has no price and may
          not be available at all, so showing a grid first shows six things that
          might be nothing. The base family can open with results because a
          house for sale is available on every date there is. */}
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <h1 className="text-3xl font-semibold tracking-tight text-balance">When, and how many of you?</h1>
          <p className="mt-2 max-w-2xl text-base text-muted-foreground">
            Everything below is priced for the dates you pick and nothing that is already taken is
            shown as available. A cottage with no dates against it has no price — which is why this
            comes before the pictures rather than after them.
          </p>
          <div className="mt-6 flex flex-wrap items-end gap-x-8 gap-y-5">
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">How long</p>
              <DateRangePicker className="mt-2" value={when} onChange={setWhen} options={[
                { value: "2n", label: "2 nights" },
                { value: "3n", label: "3 nights" },
                { value: "4n", label: "4 nights" },
                { value: "7n", label: "A week" },
              ]} />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Arriving</p>
              <p className="mt-2 text-lg font-semibold tabular-nums">Friday 14 August</p>
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-widest text-muted-foreground" htmlFor="guests">
                How many
              </label>
              <input id="guests" type="number" min={1} max={8} value={guests}
                onChange={(e) => setGuests(Math.max(1, Number(e.target.value) || 1))}
                className="mt-2 block h-9 w-24 rounded-md border border-border bg-background px-3 text-base tabular-nums" />
            </div>
            <p className="text-sm text-muted-foreground">
              Three-night minimum on a Friday, two on a Sunday, seven in the school holidays.
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid gap-10 lg:grid-cols-[240px_1fr]">
          <aside className="space-y-6">
            <SearchFacets title="Kind" selected={kind}
              onToggle={(v) => setKind((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]))}
              options={[
                { value: "cottage", label: "Cottage", count: 2 },
                { value: "barn", label: "Barn conversion", count: 2 },
                { value: "house", label: "House", count: 1 },
                { value: "hut", label: "Shepherd's hut", count: 1 },
              ]} />
            <SearchFacets title="Must have" selected={extras}
              onToggle={(v) => setExtras((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]))}
              options={[
                { value: "dogs", label: "Dogs welcome", count: 4 },
                { value: "tub", label: "Hot tub", count: 2 },
              ]} />
            <FacetRange label="Per night" min={80} max={300} value={price} onChange={setPrice}
              format={(n) => `£${n}`} buckets={[2, 1, 1, 1, 1]} />
            <p className="text-sm leading-relaxed text-muted-foreground">
              Prices are the whole property, not per person, and they include the cleaning. There is
              no booking fee and no card fee.
            </p>
          </aside>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <ResultCount total={shown.length} noun="place" filtered={shown.length !== LETS.length} />
              <SortSelect value={sort} onChange={setSort} options={[
                { value: "price-up", label: "Price, low to high" },
                { value: "price-down", label: "Price, high to low" },
                { value: "sleeps", label: "Sleeps the most" },
              ]} />
            </div>
            <FilterBar className="mt-3" filters={chips}
              onRemove={(k) => {
                if (k.startsWith("k")) setKind((s) => s.filter((x) => x !== k.slice(1)));
                else if (k.startsWith("e")) setExtras((s) => s.filter((x) => x !== k.slice(1)));
              }}
              onClear={() => { setKind([]); setExtras([]); }} />

            {shown.length === 0 ? (
              <div className="mt-8 rounded-lg border border-dashed border-border p-10 text-center">
                <p className="text-base font-medium">Nothing free for those dates at that size</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Try the Sunday rather than the Friday — it is a two-night minimum and about half
                  the diary opens up. Or ring; we usually know of a cancellation before the system does.
                </p>
              </div>
            ) : (
              <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {shown.map((l) => (
                  <div key={l.key} className="flex flex-col">
                    {/* THE PRICE IS FOR THE DATES, not a nightly rate the
                        reader has to multiply. That is the whole reason dates
                        come first — "from £132" answers nothing. */}
                    <PropertyCard href="/listing" image={null}
                      price={`£${l.perNight * nights} for ${nights} nights`}
                      address={`${l.name}, ${l.where}`}
                      beds={l.beds} baths={l.baths}
                      area={`Sleeps ${l.sleeps}`}
                      status={l.free ? undefined : "Taken for these dates"} />
                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                      <span className="tabular-nums">£{l.perNight}</span> a night · {l.note}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-10 rounded-lg border border-border bg-muted/50 p-5">
              <p className="text-base font-medium">A place shown as taken stays on the page</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                With the date it comes free again. Hiding it means somebody who would happily have
                moved by a week never learns the option exists — and about one booking in six here
                is somebody shifting their dates rather than their choice.
              </p>
            </div>
          </div>
        </div>

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="Booking direct" title="No fee, no platform, and the owner's phone number"
            description="Every one of these is managed by us and owned by somebody local. You get their name at booking, which is the thing a platform will not give you and the thing that matters at eleven at night when the boiler stops." />
        </section>
      </div>
    </SiteChrome>
  );
}
