// gym/in-stock-near-you — RETAIL. The location-first family answers "which
// branch is nearest"; a retailer with branches answers a compound question —
// which branch has THIS, today. Nearest is only useful if the thing is there,
// so the locator becomes a per-branch stock answer and a branch with none is
// still shown, with when it will have some.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { LocationCard } from "@/components/ui/location-card";
import { OpenNow } from "@/components/ui/open-now";
import { PriceTag } from "@/components/ui/price-tag";
import { SafeImage } from "@/components/ui/safe-image";
import { SearchInput } from "@/components/ui/search-input";
import { SectionHeader } from "@/components/ui/section-header";
import { SpecList, SpecRow } from "@/components/ui/spec-row";
import { StatsBand } from "@/components/ui/stats-band";
import { cn } from "@/lib/utils";
export const Route = createFileRoute("/in-stock-near-you")({ component: P });
const HOURS = [
  { day: 1, open: "09:00", close: "17:30" }, { day: 2, open: "09:00", close: "17:30" },
  { day: 3, open: "09:00", close: "17:30" }, { day: 4, open: "09:00", close: "17:30" },
  { day: 5, open: "09:00", close: "17:30" }, { day: 6, open: "09:00", close: "17:00" },
  { day: 0, open: "10:00", close: "16:00" },
];
export type Branch = {
  key: string; name: string; address: string; distance: string; phone: string;
  stock: number; due: string | null; note: string; parking: string;
};
export const BRANCHES: Branch[] = [
  { key: "kelham", name: "Kelham Island", address: "Alma Street, Sheffield, S3 8SA", distance: "0.4 mi", phone: "0114 272 8800",
    stock: 3, due: null, note: "Two on the shop floor, one in the back. Ask at the counter and they will get it.", parking: "Two hours free on Alma Street" },
  { key: "heeley", name: "Heeley", address: "Broadfield Road, Sheffield, S8 0XQ", distance: "1.8 mi", phone: "0114 255 1120",
    stock: 0, due: "Thursday", note: "None today. The van comes Thursday morning and there are four on it.", parking: "Own car park, 18 spaces" },
  { key: "hillsborough", name: "Hillsborough", address: "Langsett Road, Sheffield, S6 2LW", distance: "2.3 mi", phone: "0114 234 6600",
    stock: 1, due: null, note: "One left, and it is the display model — £15 off and there is a scratch on the base.", parking: "On-street, free after 6pm" },
  { key: "peaks", name: "Crystal Peaks", address: "Ochre Dike Lane, Sheffield, S20 7HB", distance: "6.1 mi", phone: "0114 399 0400",
    stock: 6, due: null, note: "Six, and the biggest shop of the four if you want to see it beside the others.", parking: "Centre car park, free" },
];
function P() {
  const [q, setQ] = useState("Hario V60 grinder");
  const total = BRANCHES.reduce((s, b) => s + b.stock, 0);
  const nearestWith = BRANCHES.find((b) => b.stock > 0);
  return (
    <SiteChrome name="Foundry Coffee" tagline="Four shops in Sheffield. Beans roasted on Alma Street since 2012."
      links={[{ label: "One shop", href: "/location" }, { label: "Subscriptions", href: "/memberships" }]}
      action={{ label: "Ring 0114 272 8800", href: "tel:01142728800" }}>

      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-10 md:grid-cols-[1.15fr_1fr]">
        {/* THE COMPOUND QUESTION, ANSWERED PER BRANCH. Nearest is useless if
            the thing is not there — so the locator becomes a stock answer, and
            a branch with none is shown WITH ITS DELIVERY DAY rather than
            hidden, because Thursday is an answer and silence is not. */}
        <div className="self-start md:sticky md:top-20">
          <h1 className="text-3xl font-semibold tracking-tight text-balance">Who has one today?</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Counts are from the tills and they update every fifteen minutes. A shop with none is
            still listed, with the day its van comes — that is more use than leaving it out.
          </p>
          <SearchInput className="mt-5" value={q} onChange={setQ} placeholder="What are you after?" />

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <OpenNow hours={HOURS} />
            <span className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground tabular-nums">{total}</span> across the four
            </span>
          </div>

          <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
            {BRANCHES.map((b) => (
              <li key={b.key} className="px-4 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <span className="text-base font-medium">{b.name}</span>
                  {/* IN WORDS AND WEIGHT, never a colour. This is read on a
                      phone, in a car, deciding whether to drive there. */}
                  <span className={cn("text-sm", b.stock > 0 ? "font-semibold" : "text-muted-foreground")}>
                    {b.stock > 0 ? `${b.stock} in stock` : b.due ? `None — in ${b.due}` : "None, and none due"}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">{b.address} · {b.distance}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{b.note}</p>
                <p className="mt-1.5 text-sm">
                  <a className="underline underline-offset-4" href={`tel:${b.phone.replace(/\s/g, "")}`}>{b.phone}</a>
                  <span className="text-muted-foreground"> · {b.parking}</span>
                </p>
              </li>
            ))}
          </ul>

          <div className="mt-5 rounded-lg border border-border bg-muted/50 p-5">
            <p className="text-base font-medium">We will not hold it without a phone call</p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              Ring the shop and they will put your name on it for 24 hours, free. What we will not
              do is take a "reserve online" click and then find somebody sold it an hour earlier —
              which is what every reservation button in retail actually is.
            </p>
          </div>
        </div>

        <div className="grid gap-10">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Grinders · burr · hand</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-balance">Hario V60 hand grinder</h2>
            <div className="mt-4 flex flex-wrap items-baseline gap-4">
              <PriceTag price={68} size="lg" />
              <span className="text-sm text-muted-foreground">Same price in all four shops and online</span>
            </div>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-muted-foreground">
              Ceramic burrs, forty clicks of adjustment, and the one we sell more of than everything
              else together. It will grind fine enough for espresso if you are patient and it is not
              really meant to — for that, look at the Comandante, which is three times the price and
              worth it only if you make espresso every day.
            </p>
            {nearestWith && (
              <p className="mt-5 rounded-lg border border-border p-4 text-base">
                <span className="font-medium">Nearest with one: {nearestWith.name}</span>
                <span className="text-muted-foreground"> — {nearestWith.distance}, {nearestWith.stock} in stock.</span>
              </p>
            )}
            <div className="mt-6 grid grid-cols-2 gap-4">
              <SafeImage src={null} alt="The V60 grinder, whole" ratio="1/1" />
              <SafeImage src={null} alt="The burr, out of the body" ratio="1/1" />
            </div>
          </div>

          <div>
            <SectionHeader eyebrow="The detail" title="What you actually get" />
            <SpecList className="mt-5">
              <SpecRow label="Burrs" value="Ceramic conical" note="Will not rust and will not taint. Steel is faster and ceramic lasts longer" />
              <SpecRow label="Adjustment" value="40 clicks" note="Espresso is about 8, filter about 18, French press about 30" highlight />
              <SpecRow label="Capacity" value="24g" note="Two big cups of filter, and it is genuinely 24 rather than optimistic" />
              <SpecRow label="Time to grind 20g" value="About 70 seconds" note="Which is the honest reason people eventually buy an electric one" highlight />
              <SpecRow label="Dishwasher" value="No" note="Rinse and dry. The bearing does not like it" />
              <SpecRow label="Spares" value="All of them, from us" note="Burr set £22, handle £8. We keep both in every shop" />
              <SpecRow label="Guarantee" value="Two years" note="Bring it into any of the four. No receipt needed if you paid by card" />
            </SpecList>
          </div>

          <StatsBand columns={2} items={[
            { value: `${total}`, label: "In stock across four shops" },
            { value: "£68", label: "Same everywhere, always" },
            { value: "15 min", label: "How often these counts refresh" },
            { value: "2012", label: "Roasting on Alma Street since" },
          ]} />

          <div>
            <SectionHeader eyebrow="If none of them have it" title="Three honest options, in order" />
            <ol className="mt-5 divide-y divide-border border-y border-border text-base">
              <li className="py-3.5">
                <span className="font-medium">Wait for the van</span>
                <span className="block text-sm text-muted-foreground">Thursday at Heeley on this one. No deposit, no reservation, ring on the day and they will put it aside.</span>
              </li>
              <li className="py-3.5">
                <span className="font-medium">Have it sent</span>
                <span className="block text-sm text-muted-foreground">£4.50, next day, from the roastery rather than from a shop — so it does not take one off a shelf somebody is standing in front of.</span>
              </li>
              <li className="py-3.5">
                <span className="font-medium">Buy it somewhere else</span>
                <span className="block text-sm text-muted-foreground">If you need it today and we have none, the shop on Division Street stocks it. We would rather say that than have you drive to Crystal Peaks for nothing.</span>
              </li>
            </ol>
          </div>

          <LocationCard name="Foundry Coffee — Kelham Island" address="Alma Street, Sheffield, S3 8SA"
            note="The roastery and the biggest of the four. Open 09:00–17:30 weekdays, 10:00–16:00 Sunday. Two hours free on Alma Street and it is rarely full before ten." />
        </div>
      </div>
    </SiteChrome>
  );
}
