// research /methodology — how the numbers were made. A data page without
// this is an opinion page with digits; the trust IS the product, so sources,
// sample and exclusions get a page of their own, stated like facts.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { StatsBand } from "@/components/ui/stats-band";
import { DataTable } from "@/components/ui/data-table";
import { Faq } from "@/components/ui/faq";
import { Steps } from "@/components/ui/steps";
export const Route = createFileRoute("/methodology")({ component: P });
const CHROME = {
  name: "Wire the North", tagline: "Every broadband deal in S postcodes, priced honestly.",
  links: [{ label: "The numbers", href: "/" }, { label: "How we count", href: "/methodology" }],
};
function P() {
  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">How we count</h1>
        <p className="mt-2 max-w-xl text-muted-foreground">Every figure on the front page traces to this method. When the method changes, the change is dated below.</p>
        <StatsBand className="mt-8" items={[
          { value: "41", label: "Deals in the sample" },
          { value: "Weekly", label: "Repriced — Fridays, before noon" },
          { value: "18 mo", label: "Cost horizon, rises and exit fees in" }]} />
        <section className="mt-10">
          <h2 className="text-lg font-medium">The method, in order</h2>
          <Steps className="mt-4" items={[
            { title: "Collect", description: "Every advertised deal for the postcodes, from the ISP's own checkout — never an aggregator's feed." },
            { title: "Normalise", description: "Total 18-month cost: monthly price, announced mid-contract rises, setup and exit fees, minus honest-to-goodness credits." },
            { title: "Publish", description: "The table shows the normalised figure. The advertised monthly is shown beside it, never instead of it." },
          ]} />
        </section>
        <section className="mt-10">
          <h2 className="text-lg font-medium">What we exclude, and why</h2>
          <DataTable className="mt-3" columns={[{ key: "what", header: "Excluded" }, { key: "why", header: "Because" }]} rows={[
            { what: "New-customer-only vouchers", why: "Half never arrive; a price that depends on remembering to claim is not a price" },
            { what: "Social tariffs", why: "Listed separately — mixing them in flatters the averages" },
            { what: "Business lines", why: "Different contracts, different rises; not comparable" },
          ]} />
        </section>
        <section className="mt-10">
          <Faq items={[
            { question: "Do ISPs pay to appear?", answer: "No. Three have asked; the answer is what keeps the table worth reading." },
            { question: "Where does the speed number come from?", answer: "Ofcom's measured median for the technology, not the ISP's 'up to' figure." },
            { question: "Method changes?", answer: "One so far: 2026-05-09, exit fees added to the 18-month total. It moved BT down two places, which is rather the point." },
          ]} />
        </section>
      </div>
    </SiteChrome>
  );
}
