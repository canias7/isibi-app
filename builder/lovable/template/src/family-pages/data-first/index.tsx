// data-first — the numbers are the hero; the comparison sits above the fold;
// the calculator answers "what would I pay". A broadband comparison site.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { CalculatorCard } from "@/components/ui/calculator-card";
import { ComparisonTable } from "@/components/ui/comparison-table";
import { Sparkline } from "@/components/ui/sparkline";
import { StatsBand } from "@/components/ui/stats-band";
export const Route = createFileRoute("/")({ component: P });
function P() {
  const [v, setV] = useState<Record<string, number>>({ people: 3, streams: 2 });
  const need = v.people * 15 + v.streams * 25;
  return (
    <SiteChrome name="Wire the North" tagline="Every broadband deal in S postcodes, priced honestly."
      links={[{ label: "Compare", href: "#compare" }, { label: "What do I need?", href: "#calc" }, { label: "How we count", href: "#/methodology" }]}>
      <div className="mx-auto max-w-3xl px-6 py-12">
        {/* Numbers first — the headline row IS the hero. */}
        <StatsBand items={[
          { value: "41", label: "Deals tracked" }, { value: "£23.50", label: "Cheapest this week" },
          { value: "-£4.10", label: "Average drop since May" }, { value: "3", label: "Mid-contract rises flagged" }]} />
        <div className="mt-3 flex items-center gap-3 text-sm text-muted-foreground">
          <Sparkline values={[31, 30.5, 29, 29, 27.8, 26.4, 25.1, 23.5]} label="Cheapest deal, last 8 weeks" />
          <span>Cheapest deal, last 8 weeks</span>
        </div>
        <section id="compare" className="mt-10">
          <h2 className="text-lg font-medium">The three worth reading</h2>
          <ComparisonTable className="mt-4" columns={["Ferret 150", "BT Fibre 2", "YouFibre 500"]} rows={[
            { feature: "Monthly", values: ["£23.50", "£29.99", "£26.99"] },
            { feature: "Speed", values: ["150 Mb", "74 Mb", "500 Mb"] },
            { feature: "Mid-contract rise", values: [false, true, false] },
            { feature: "Exit fee", values: [false, true, false] },
            { feature: "18-month price", values: ["£423", "£569", "£486"] }]} />
        </section>
        <p className="mt-3 text-sm text-muted-foreground">18-month totals, rises and exit fees included — <a className="font-medium underline underline-offset-4" href="#/methodology">how we count</a>.</p>
        <section id="calc" className="mt-10">
          <CalculatorCard title="What speed do you actually need?" fields={[
            { key: "people", label: "People at home", min: 1, max: 8, unit: "people" },
            { key: "streams", label: "4K streams at once", min: 0, max: 5, unit: "streams" }]}
            values={v} onChange={(k, n) => setV({ ...v, [k]: n })}
            result={{ label: "You need about", value: `${need} Mb`, note: need > 150 ? "Full fibre territory." : "Any deal above covers you." }} />
        </section>
      </div>
    </SiteChrome>
  );
}
