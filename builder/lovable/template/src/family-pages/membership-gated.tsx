// membership-gated — "logged-out is a pitch". The landed paywall leads.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Paywall } from "@/components/ui/paywall";
import { PricingTable } from "@/components/ui/pricing-table";
export const Route = createFileRoute("/")({ component: P });
function P() {
  return (
    <SiteChrome name="The Crucible Letter" tagline="Sheffield theatre, reviewed weekly."
      links={[{ label: "Archive", href: "#archive" }, { label: "Subscribe", href: "#plans" }]}
      action={{ label: "Subscribe", href: "#plans" }}>
      <article className="mx-auto max-w-2xl px-6 py-12">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Review · 1 August 2026</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">A Streetcar with the brakes off</h1>
        <p className="mt-1 text-sm text-muted-foreground">By R. Okafor · 9 min read</p>
        <div className="mt-8">
          <Paywall
            remaining={0}
            title="You've read your free review this week"
            message="Every stage in the city, every week, no ads. Members keep us honest."
            action={{ label: "Subscribe — £4/month", href: "#plans" }}
            secondary={{ label: "Sign in", href: "#plans" }}
            preview={
              <div className="space-y-4">
                <p>The first thing you notice is the heat. Chen's production opens with every window of the Kowalski flat nailed shut, and for two hours nobody on stage pretends otherwise.</p>
                <p>Blanche arrives not as a moth but as a magistrate — Adeyemi plays the first act as if she owns the deed to the place, which makes the unravelling…</p>
              </div>
            }>
            <p>…the rest of the review, for members.</p>
          </Paywall>
        </div>
        <div id="plans" className="mt-12">
          <PricingTable tiers={[
            { name: "Monthly", price: "£4", period: "/month", features: ["Every review", "The archive", "Comments"], action: { label: "Join monthly", href: "#plans" } },
            { name: "Annual", price: "£36", period: "/year", features: ["Everything monthly", "Two months free", "Season previews"], featured: true, action: { label: "Join yearly", href: "#plans" } },
          ]} />
        </div>
      </article>
    </SiteChrome>
  );
}
