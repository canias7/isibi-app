// data-first — the numbers ARE the hero. A broadband comparison site: the
// headline figures before any prose, the trend beside them, the comparison
// above the fold, the calculator, and the method one tap away — every claim
// with its number beside it.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { CalculatorCard } from "@/components/ui/calculator-card";
import { ComparisonTable } from "@/components/ui/comparison-table";
import { CtaBand } from "@/components/ui/cta-band";
import { SectionHeader } from "@/components/ui/section-header";
import { Sparkline } from "@/components/ui/sparkline";
import { StatsBand } from "@/components/ui/stats-band";
export const Route = createFileRoute("/")({ component: P });
function P() {
  const [v, setV] = useState<Record<string, number>>({ people: 3, streams: 2 });
  const need = v.people * 15 + v.streams * 25;
  return (
    <SiteChrome name="Wire the North" tagline="Every broadband deal in S postcodes, priced honestly."
      links={[{ label: "Compare", href: "#compare" }, { label: "What do I need?", href: "#calc" }, { label: "How we count", href: "#/methodology" }, { label: "The report", href: "#/report" }]}>

      {/* Numbers first — the headline row IS the hero. */}
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-4xl px-6 py-12">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">41 deals · repriced every Friday · S1–S36</p>
          <h1 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight">The price of broadband here, measured weekly</h1>
          <StatsBand className="mt-8" items={[
            { value: "41", label: "Deals tracked" },
            { value: "£23.50", label: "Cheapest this week" },
            { value: "-£4.10", label: "Average drop since May" },
            { value: "3", label: "Mid-contract rises flagged" }]} />
          <div className="mt-4 flex items-center gap-3 text-sm text-muted-foreground">
            <Sparkline values={[31, 30.5, 29, 29, 27.8, 26.4, 25.1, 23.5]} label="Cheapest deal, last 8 weeks" />
            <span>Cheapest deal, last 8 weeks — the altnets are doing this</span>
          </div>
        </div>
      </section>

      <section id="compare" className="mx-auto max-w-4xl px-6 py-14">
        <SectionHeader eyebrow="Above the fold, as it should be" title="The three worth reading" description="18-month totals — rises, setup and exit fees included. The advertised monthly is beside the honest one, never instead of it." />
        <ComparisonTable className="mt-6" columns={["Ferret 150", "BT Fibre 2", "YouFibre 500"]} rows={[
          { feature: "Monthly", values: ["£23.50", "£29.99", "£26.99"] },
          { feature: "Speed (measured median)", values: ["150 Mb", "74 Mb", "500 Mb"] },
          { feature: "Mid-contract rise", values: [false, true, false] },
          { feature: "Exit fee", values: [false, true, false] },
          { feature: "Setup", values: [false, "£31.99", false] },
          { feature: "18-month total", values: ["£423", "£601", "£486"] }]} />
        <p className="mt-3 text-sm text-muted-foreground">Every figure computed by <a className="font-medium underline underline-offset-4" href="#/methodology">the public method</a> — disagree with one and you can re-derive it.</p>
      </section>

      <section id="calc" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-3xl px-6 py-14">
          <SectionHeader eyebrow="Right-sizing" title="What speed do you actually need?" description="Most households buy double what they use. The maths is four numbers." />
          <CalculatorCard className="mt-6" title="Your house, honestly" fields={[
            { key: "people", label: "People at home", min: 1, max: 8, unit: "people" },
            { key: "streams", label: "4K streams at once", min: 0, max: 5, unit: "streams" }]}
            values={v} onChange={(k, n) => setV({ ...v, [k]: n })}
            result={{ label: "You need about", value: `${need} Mb`, note: need > 150 ? "Full fibre territory — two of the three above qualify." : "Any deal above covers you with room to spare." }} />
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-14">
        <CtaBand title="The 2026 report is out" description="A year of weekly repricing condensed to 34 pages — the headline findings are free." action={{ label: "Read the findings", href: "#/report" }} />
      </section>
    </SiteChrome>
  );
}
