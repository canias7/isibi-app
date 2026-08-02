// software /pricing — the plans side by side, then the feature-by-feature
// truth table for the person who scrolls past the cards, then the money
// objections. One action per tier, same verb everywhere.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { ComparisonTable } from "@/components/ui/comparison-table";
import { CtaBand } from "@/components/ui/cta-band";
import { Faq } from "@/components/ui/faq";
import { PricingTable } from "@/components/ui/pricing-table";
export const Route = createFileRoute("/pricing")({ component: P });
const CHROME = {
  name: "Snicket", tagline: "Walking routes that prefer the alleys.",
  links: [{ label: "The app", href: "#/" }, { label: "Pricing", href: "#/pricing" }],
  action: { label: "Download", href: "#/" },
};
function P() {
  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-5xl px-6 py-14">
        <h1 className="text-3xl font-semibold tracking-tight">One price, no tiers of tiers</h1>
        <p className="mt-2 max-w-xl text-muted-foreground">Free is genuinely usable — it is the app, limited by count not by quality. Wanderer removes the counts.</p>
        <PricingTable className="mt-8" tiers={[
          { name: "Free", price: "£0", description: "For trying a city on foot.", features: ["Three saved routes", "One city offline", "Quiet scores everywhere"], action: { label: "Get the app", href: "#/" } },
          { name: "Wanderer", price: "£2.50", period: "month", featured: true, description: "For people who walk daily.", features: ["Unlimited saved routes", "Everywhere offline", "Quiet-first routing", "Route history and heatmap"], action: { label: "Start free month", href: "#/" } },
        ]} />
        <section className="mt-14">
          <h2 className="text-lg font-medium">Exactly what differs</h2>
          <ComparisonTable className="mt-4" columns={["Free", "Wanderer"]} rows={[
            { feature: "Saved routes", values: ["3", "Unlimited"] },
            { feature: "Offline maps", values: ["1 city", "Everywhere"] },
            { feature: "Quiet scores", values: [true, true] },
            { feature: "Quiet-first routing", values: [false, true] },
            { feature: "Route history", values: [false, true] },
            { feature: "Ads", values: [false, false] },
          ]} />
        </section>
        <section className="mx-auto mt-14 max-w-2xl">
          <Faq items={[
            { question: "Is the free month a card trap?", answer: "No card up front. When the month ends the app drops back to Free and keeps working." },
            { question: "Can I pay yearly?", answer: "£24 a year — two months free — from inside the app." },
            { question: "Family plan?", answer: "Not yet. It's the most-asked question and it's on the board." },
          ]} />
        </section>
        <CtaBand className="mt-14" title="Walk the quiet way" description="Free on both stores. The alleys are waiting." action={{ label: "Get Snicket", href: "#/" }} />
      </div>
    </SiteChrome>
  );
}
