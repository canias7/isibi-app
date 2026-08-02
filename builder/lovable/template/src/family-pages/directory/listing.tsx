// directory /listing — one entry in full: who, where, when, and how to reach
// them. A directory entry is not a marketing page for the business; it is the
// four facts somebody came for, and everything else is below them.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { CategoryNav } from "@/components/ui/category-nav";
import { LocationCard } from "@/components/ui/location-card";
import { OpeningHours } from "@/components/ui/opening-hours";
import { SectionHeader } from "@/components/ui/section-header";
import { CATEGORIES } from "./index";
export const Route = createFileRoute("/listing")({ component: P });
function P() {
  return (
    <SiteChrome name="Sheffield Index" tagline="Every business, club and service in Sheffield. Free to list, free to search."
      links={[{ label: "Home", href: "#/" }, { label: "Search results", href: "#/results" }]}
      action={{ label: "Add a listing", href: "#add" }}>

      <div className="mx-auto max-w-4xl px-6 py-14">
        <p className="text-sm text-muted-foreground">
          <a href="#/results" className="underline underline-offset-4">Trades</a> · Plumbers · Walkley
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance">Hallam Plumbing &amp; Heating</h1>
        <p className="mt-2 text-lg text-muted-foreground">Plumber and heating engineer · Gas Safe 512844</p>

        {/* The four facts, first and together. Everything a directory visitor
            came for is above this fold and nothing else is. */}
        <dl className="mt-8 grid gap-x-10 gap-y-5 border-y border-border py-6 sm:grid-cols-2">
          {[
            ["Phone", <a key="p" href="tel:01142660188" className="underline underline-offset-4">0114 266 0188</a>],
            ["Address", "42 South Road, Walkley, Sheffield, S6 3TA"],
            ["Right now", "Open until 18:00"],
            ["Emergency", "24 hours, same number"],
            ["Registered", "Gas Safe 512844 · checked on the public register"],
            ["Confirmed", "Details confirmed by the business, 3 weeks ago"],
          ].map(([k, v], i) => (
            <div key={i}>
              <dt className="text-sm text-muted-foreground">{k}</dt>
              <dd className="mt-0.5 text-base font-medium">{v}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_1fr]">
          <div>
            <SectionHeader eyebrow="What they do" title="Domestic plumbing and gas" />
            <ul className="mt-4 divide-y divide-border border-y border-border text-base">
              <li className="py-2.5">Boiler service, repair and replacement</li>
              <li className="py-2.5">Bathrooms, supplied and fitted</li>
              <li className="py-2.5">Landlord gas safety certificates</li>
              <li className="py-2.5">Leaks, blockages and emergency callout</li>
              <li className="py-2.5">Radiators, valves and power flushing</li>
            </ul>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Written by the business. We do not edit it and we do not rank on it — this is a
              directory entry, not an advert, and everybody's is the same size.
            </p>

            <h2 className="mt-10 text-sm font-medium uppercase tracking-widest text-muted-foreground">Also listed under</h2>
            <CategoryNav className="mt-3" items={CATEGORIES.slice(0, 3)} active="trades" onSelect={() => {}} />
          </div>

          <div>
            <SectionHeader eyebrow="When" title="Opening hours" />
            <OpeningHours className="mt-4" days={[
              { day: 1, label: "Monday", open: "08:00", close: "18:00" },
              { day: 2, label: "Tuesday", open: "08:00", close: "18:00" },
              { day: 3, label: "Wednesday", open: "08:00", close: "18:00" },
              { day: 4, label: "Thursday", open: "08:00", close: "18:00" },
              { day: 5, label: "Friday", open: "08:00", close: "17:00" },
              { day: 6, label: "Saturday", open: "09:00", close: "13:00" },
              { day: 0, label: "Sunday" },
            ]} />
            <p className="mt-3 text-sm text-muted-foreground">
              Emergency callout runs outside these hours on the same number.
            </p>
            <LocationCard className="mt-6" name="Hallam Plumbing &amp; Heating"
              address="42 South Road, Walkley, Sheffield, S6 3TA"
              note="Yard and office. Not a shop — ring before turning up." />
          </div>
        </div>

        <section id="add" className="mt-14 border-t border-border pt-10">
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <SectionHeader eyebrow="Is this you?" title="Claim it, or correct it"
                description="Every listing can be claimed by the business, free, and edited from then on. Until it is, we keep it accurate ourselves and mark how old the details are." />
              <div className="mt-6 flex flex-wrap gap-3">
                <a className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" href="#add">Claim this listing</a>
                <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="#add">Something is wrong</a>
              </div>
            </div>
            <div>
              <SectionHeader eyebrow="Not here yet?" title="Add a business, free"
                description="Any Sheffield business, club or service. There is no paid tier, so adding it is the only thing there is to do." />
              <a className="mt-6 inline-block rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="#/results">Add a listing</a>
            </div>
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
