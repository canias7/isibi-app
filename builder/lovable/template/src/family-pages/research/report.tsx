// research /report — the annual deep-dive, gated the honest way: the
// headline findings are FREE (they're the proof it's worth an address), the
// full PDF costs an email. The taxonomy names this exact shape: "research
// report / whitepaper — gated download".
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { DownloadCard } from "@/components/ui/download-card";
import { EmailCapture } from "@/components/ui/email-capture";
import { StatsBand } from "@/components/ui/stats-band";
export const Route = createFileRoute("/report")({ component: P });
const CHROME = {
  name: "Wire the North", tagline: "Every broadband deal in S postcodes, priced honestly.",
  links: [{ label: "The numbers", href: "#/" }, { label: "How we count", href: "#/methodology" }, { label: "The report", href: "#/report" }],
};
function P() {
  const [got, setGot] = useState(false);
  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-2xl px-6 py-12">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Annual report · July 2026 · 34 pages</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">The State of South Yorkshire Broadband</h1>
        <p className="mt-2 text-muted-foreground">A year of weekly repricing, condensed. The headline findings are below for free — the PDF has the street-level maps and every table.</p>
        <StatsBand className="mt-8" items={[
          { value: "-14%", label: "Median price, year on year" },
          { value: "2.1×", label: "Altnet coverage growth" },
          { value: "£171", label: "Cost of loyalty — avg. overpay for not switching" }]} />
        <section className="mt-8 grid gap-3">
          <h2 className="text-lg font-medium">What the year showed</h2>
          <p className="text-sm text-muted-foreground"><strong className="text-foreground">The altnets did the work.</strong> Every price fall traces to a street gaining a second fibre network; where BT is still alone, prices ROSE 4%.</p>
          <p className="text-sm text-muted-foreground"><strong className="text-foreground">Mid-contract rises got quieter, not smaller.</strong> Three ISPs moved the rise from the headline to the basket. The report names them.</p>
          <p className="text-sm text-muted-foreground"><strong className="text-foreground">Loyalty is the most expensive tariff.</strong> The average out-of-contract household overpays £171 a year against the identical new-customer deal.</p>
        </section>
        <section className="mt-10 rounded-xl border bg-muted/40 p-6">
          {got ? (
            <div className="grid gap-3">
              <p className="text-sm font-medium">It's yours — and it's in your inbox too.</p>
              <DownloadCard name="wire-the-north-2026.pdf" description="34 pages, every table, street-level maps" size={6_400_000} href="#/report" />
            </div>
          ) : (
            <EmailCapture title="Get the full report" blurb="Free. The email is the price — one a quarter, no passing it on."
              cta="Send me the PDF" note="Unsubscribe in one click; the download works either way." onSubmit={() => setGot(true)} />
          )}
        </section>
        <p className="mt-8 text-sm text-muted-foreground">Every number in it is computed by <a className="font-medium underline underline-offset-4" href="#/methodology">the public method</a> — disagree with a figure and you can re-derive it.</p>
      </div>
    </SiteChrome>
  );
}
