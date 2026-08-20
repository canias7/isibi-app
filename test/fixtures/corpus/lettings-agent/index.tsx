// lettings-agent — WHAT-IT-COSTS-TO-MOVE-IN-FIRST, on a card grid. A tenant
// arrives braced to be stung for a £300 admin fee that has been illegal since
// 2019, so the up-front total is computed above the properties and the ban is
// stated as law rather than as a policy we are being generous about.
import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Faq } from "@/components/ui/faq";
import { FilterBar } from "@/components/ui/filter-bar";
import { LocationCard } from "@/components/ui/location-card";
import { PropertyCard } from "@/components/ui/property-card";
import { SearchFacets } from "@/components/ui/search-facets";
import { SectionHeader } from "@/components/ui/section-header";
import { TenancyCosts } from "@/components/ui/tenancy-costs";
export const Route = createFileRoute("/")({ component: P });
export const LETS = [
  { price: "£950 pcm", address: "Sharrow Vale Road, S11", beds: 2, baths: 1, area: "Available 1 Sept", status: "Let agreed" },
  { price: "£795 pcm", address: "Abbeydale Road, S7", beds: 2, baths: 1, area: "Available now" },
  { price: "£1,250 pcm", address: "Nether Edge Road, S7", beds: 3, baths: 2, area: "Available 14 Aug" },
  { price: "£675 pcm", address: "London Road, S2", beds: 1, baths: 1, area: "Available now" },
  { price: "£1,450 pcm", address: "Endcliffe Vale Road, S10", beds: 4, baths: 2, area: "Available 1 Oct" },
  { price: "£880 pcm", address: "Crookes Valley Road, S10", beds: 2, baths: 1, area: "Available 20 Aug" },
];
function P() {
  const [beds, setBeds] = React.useState<string[]>(["2"]);
  const [area, setArea] = React.useState<string[]>([]);
  const chips = [...beds.map((b) => ({ key: `b${b}`, label: `${b} bed` })), ...area.map((a) => ({ key: `a${a}`, label: a }))];
  return (
    <SiteChrome name="Sharrow Vale Lettings" tagline="Letting and managing 340 homes across south-west Sheffield since 2008."
      links={[{ label: "Landlords", href: "/landlords" }, { label: "Compliance", href: "/compliance" }, { label: "Find us", href: "#find-us" }]}
      action={{ label: "Ring 0114 266 1180", href: "tel:01142661180" }}>

      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid items-start gap-12 lg:grid-cols-[1fr_1.15fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">340 homes managed · ARLA Propertymark · client money protected</p>
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">
                No admin fee. It has been illegal since 2019
              </h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                And plenty of people still expect one, because agents charged three hundred pounds
                to process a form for twenty years. Here is every penny you need before the keys,
                worked out from the rent, with nothing after it.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <a className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" href="#available">See what is available</a>
                <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="/landlords">I am a landlord</a>
              </div>
            </div>
            {/* THE UP-FRONT TOTAL, COMPUTED, above the properties. */}
            <TenancyCosts monthlyRent={950} depositWeeks={5} holdingWeeks={1}
              alsoPayable={[
                "Rent, monthly in advance by standing order",
                "Council tax, unless the advert says otherwise",
                "Gas, electricity, water and broadband",
                "A tenancy you end early: the rent until it is re-let, and our actual re-letting cost, evidenced",
              ]}
              note="Worked on £950 a month, which is the two-bed on Sharrow Vale Road. Every property's own figure is on its page and it is this same arithmetic." />
          </div>
        </div>
      </section>

      <section id="available" className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="Available" title="Six now, and the let-agreed one stays up"
          description="Because a let-agreed property falling through is the commonest thing in this trade, and hiding it means the person who wanted it never hears." />
        <div className="mt-8 grid gap-10 lg:grid-cols-[220px_1fr]">
          <aside className="space-y-6">
            <SearchFacets title="Bedrooms" selected={beds} onToggle={(v) => setBeds((s) => s.includes(v) ? s.filter((x) => x !== v) : [...s, v])}
              options={[
                { value: "1", label: "1 bed", count: 1 },
                { value: "2", label: "2 bed", count: 3 },
                { value: "3", label: "3 bed", count: 1 },
                { value: "4", label: "4 bed or more", count: 1 },
              ]} />
            <SearchFacets title="Area" selected={area} onToggle={(v) => setArea((s) => s.includes(v) ? s.filter((x) => x !== v) : [...s, v])}
              options={[
                { value: "S7", label: "Nether Edge, S7", count: 2 },
                { value: "S10", label: "Broomhill, S10", count: 2 },
                { value: "S11", label: "Sharrow Vale, S11", count: 1 },
                { value: "S2", label: "Highfield, S2", count: 1 },
              ]} />
            <p className="text-sm leading-relaxed text-muted-foreground">
              We do not list anything we have not seen, and we do not list a property twice with two
              different photographs to make the page look busier.
            </p>
          </aside>
          <div>
            <FilterBar filters={chips} onRemove={(k) => { setBeds((s) => s.filter((b) => `b${b}` !== k)); setArea((s) => s.filter((a) => `a${a}` !== k)); }}
              onClear={() => { setBeds([]); setArea([]); }} />
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {LETS.map((l) => <PropertyCard key={l.address} {...l} href="/" />)}
            </div>
          </div>
        </div>
      </section>

      <section id="find-us" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr]">
            <div>
              <SectionHeader eyebrow="Asked often" title="By tenants" />
              <Faq className="mt-6" items={[
                { question: "Will you charge me a referencing fee?", answer: "No, and nobody may. The Tenant Fees Act 2019 prohibits admin, referencing, inventory, renewal and contract fees. An agent asking for one is breaking the law, and Trading Standards will act on it." },
                { question: "What is the holding deposit for?", answer: "It takes the property off the market while we reference you, and it is one week's rent at most. It comes off your first month — it is not an extra. You lose it only if you pull out, give false information, or fail a Right to Rent check you knew about." },
                { question: "How long does referencing take?", answer: "Two to five working days once we have everything. The delay is almost always an employer or a previous landlord not replying, and we will tell you which rather than saying 'it is in progress'." },
                { question: "What if I have no UK credit history?", answer: "Common with students and people who have just moved here, and it is not a refusal. A guarantor or rent in advance both work, and we will say which we need before you pay anything." },
                { question: "Can I have a pet?", answer: "On about a third of them, and each property's advert says. Where a landlord says yes we cannot charge a pet deposit — the cap is the cap — so it is usually a slightly higher rent instead, stated up front." },
                { question: "When do I get my deposit back?", answer: "Within ten days of agreeing the figure. It is in a government scheme within 30 days of you paying it, and you get the certificate. If we disagree, the scheme adjudicates for free and we abide by it." },
              ]} />
            </div>
            <div>
              <SectionHeader eyebrow="Where" title="Above the shop on Sharrow Vale Road" />
              <LocationCard className="mt-6" name="Sharrow Vale Lettings"
                address="184 Sharrow Vale Road, Sheffield, S11 8ZH"
                note="Open 09:00–17:30 weekdays and 10:00–14:00 on Saturdays. Viewings run until seven in the evening because people work; you do not need an appointment to come in and ask something." />
              <div className="mt-8 rounded-lg border border-border bg-card p-5">
                <p className="text-base font-medium">Client money protection, and what it means</p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  Your rent and your deposit sit in a separate client account, insured through
                  Propertymark. If this firm went under tomorrow, that money is not ours and no
                  creditor can reach it. It is a legal requirement and it is worth checking any
                  agent for — the certificate number is on the office wall and on every invoice.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </SiteChrome>
  );
}
