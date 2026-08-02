// research — BENTO structure: the first screen is a dense grid of unequal
// tiles, and every tile is a NUMBER doing its job. A dashboard you read,
// not a landing page about one — the comparison and calculator live inside
// the grid rather than under it.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { BentoGrid } from "@/components/ui/bento-grid";
import { CalculatorCard } from "@/components/ui/calculator-card";
import { ComparisonTable } from "@/components/ui/comparison-table";
import { Sparkline } from "@/components/ui/sparkline";
export const Route = createFileRoute("/")({ component: P });
function P() {
  const [v, setV] = useState<Record<string, number>>({ people: 3, streams: 2 });
  const need = v.people * 15 + v.streams * 25;
  return (
    <SiteChrome name="Wire the North" tagline="Every broadband deal in S postcodes, priced honestly."
      links={[{ label: "How we count", href: "#/methodology" }, { label: "The report", href: "#/report" }]}>

      <div className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">41 deals · repriced every Friday · S1–S36</p>
        <h1 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight">The price of broadband here, measured weekly</h1>

        <BentoGrid className="mt-8" items={[
          { content: <div><p className="text-4xl font-semibold tabular-nums">£23.50</p><p className="mt-1 text-sm text-muted-foreground">cheapest this week</p></div> },
          { content: <div><p className="text-4xl font-semibold tabular-nums">-£4.10</p><p className="mt-1 text-sm text-muted-foreground">average drop since May</p></div> },
          { content: (
            <div>
              <Sparkline values={[31, 30.5, 29, 29, 27.8, 26.4, 25.1, 23.5]} label="Cheapest deal, last 8 weeks" />
              <p className="mt-2 text-sm text-muted-foreground">8 weeks, one direction — the altnets are doing this</p>
            </div>
          ) },
          { span: 2, tall: true, content: (
            <div className="flex h-full flex-col">
              <p className="font-medium">The three worth reading</p>
              <p className="mt-1 text-xs text-muted-foreground">18-month totals — rises, setup and exit fees included.</p>
              <ComparisonTable className="mt-3" columns={["Ferret 150", "BT Fibre 2", "YouFibre 500"]} rows={[
                { feature: "Monthly", values: ["£23.50", "£29.99", "£26.99"] },
                { feature: "Speed (measured)", values: ["150 Mb", "74 Mb", "500 Mb"] },
                { feature: "Mid-contract rise", values: [false, true, false] },
                { feature: "18-month total", values: ["£423", "£601", "£486"] }]} />
              <p className="mt-auto pt-3 text-xs text-muted-foreground">Every figure re-derivable from <a className="font-medium underline underline-offset-4" href="#/methodology">the public method</a>.</p>
            </div>
          ) },
          { tall: true, content: (
            <div className="flex h-full flex-col">
              <CalculatorCard title="What do you actually need?" fields={[
                { key: "people", label: "People at home", min: 1, max: 8, unit: "people" },
                { key: "streams", label: "4K streams at once", min: 0, max: 5, unit: "streams" }]}
                values={v} onChange={(k, n) => setV({ ...v, [k]: n })}
                result={{ label: "You need about", value: `${need} Mb`, note: need > 150 ? "Full fibre territory." : "Any deal above covers you." }} />
            </div>
          ) },
          { content: <div><p className="text-4xl font-semibold tabular-nums">3</p><p className="mt-1 text-sm text-muted-foreground">mid-contract rises flagged this week</p></div> },
          { content: <div><p className="text-4xl font-semibold tabular-nums">£171</p><p className="mt-1 text-sm text-muted-foreground">the average cost of loyalty, per year</p></div> },
          { span: 2, content: (
            <div className="flex h-full items-center justify-between gap-4">
              <div><p className="font-medium">The 2026 report is out</p><p className="mt-1 text-sm text-muted-foreground">A year of weekly repricing in 34 pages — headline findings free.</p></div>
              <a className="shrink-0 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground" href="#/report">Read the findings</a>
            </div>
          ) },
        ]} />
      </div>
    </SiteChrome>
  );
}
