// membership-gated — logged-out is a pitch whose proof is a taste of the
// real thing. The wall shows what it refuses, the plans sit under it, the
// archive teases what membership opens, and returners sign in right here.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { ArticleCard } from "@/components/ui/article-card";
import { LoginForm } from "@/components/ui/login-form";
import { Paywall } from "@/components/ui/paywall";
import { PricingTable } from "@/components/ui/pricing-table";
import { SectionHeader } from "@/components/ui/section-header";
import { StatsBand } from "@/components/ui/stats-band";
export const Route = createFileRoute("/")({ component: P });
function P() {
  return (
    <SiteChrome name="The Crucible Letter" tagline="Sheffield theatre, reviewed weekly."
      links={[{ label: "Sign in", href: "#signin" }, { label: "Subscribe", href: "#plans" }]}
      action={{ label: "Subscribe", href: "#plans" }}>

      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-2xl px-6 py-12">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Every stage in the city · every week · no ads</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">Theatre criticism worth £4 a month</h1>
          <StatsBand className="mt-8" items={[
            { value: "217", label: "Letters so far" },
            { value: "2,900", label: "Members keeping it honest" },
            { value: "0", label: "Free tickets accepted, ever" }]} />
        </div>
      </section>

      <article className="mx-auto max-w-2xl px-6 py-12">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Review · 1 August 2026</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight">A Streetcar with the brakes off</h2>
        <p className="mt-1 text-sm text-muted-foreground">By R. Okafor · 9 min read</p>
        <div className="mt-8">
          <Paywall
            remaining={0}
            title="You've read your free review this week"
            message="Every stage in the city, every week, no ads. Members keep us honest."
            action={{ label: "Subscribe — £4/month", href: "#plans" }}
            secondary={{ label: "Sign in", href: "#signin" }}
            preview={
              <div className="space-y-4">
                <p>The first thing you notice is the heat. Chen's production opens with every window of the Kowalski flat nailed shut, and for two hours nobody on stage pretends otherwise.</p>
                <p>Blanche arrives not as a moth but as a magistrate — Adeyemi plays the first act as if she owns the deed to the place, which makes the unravelling…</p>
              </div>
            }>
            <p>…the rest of the review, for members.</p>
          </Paywall>
        </div>
      </article>

      <section id="plans" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-3xl px-6 py-14">
          <SectionHeader eyebrow="Membership" title="Two prices, one product" description="Everything is in both — the annual simply costs ten months." />
          <PricingTable className="mt-8" tiers={[
            { name: "Monthly", price: "£4", period: "month", features: ["Every review", "The archive", "Comments"], action: { label: "Join monthly", href: "#plans" } },
            { name: "Annual", price: "£36", period: "year", features: ["Everything monthly", "Two months free", "Season previews"], featured: true, action: { label: "Join yearly", href: "#plans" } },
          ]} />
        </div>
      </section>

      <section className="mx-auto max-w-2xl px-6 py-12">
        <SectionHeader eyebrow="From the archive" title="What membership opens" description="Two hundred letters back to 2022, searchable, all of them this honest." />
        <div className="mt-6 grid gap-4">
          <ArticleCard title="Standing at the Lyceum: the £12 seats that shouldn't work" excerpt="Row A of the gods, and why the sound is better than the stalls." meta="25 July · 7 min" href="#plans" />
          <ArticleCard title="Interview: the fight director nobody credits" excerpt="Every fall you believed this year was hers." meta="11 July · 9 min" href="#plans" />
        </div>
      </section>

      {/* The other half of a two-state site: returners sign in right here. */}
      <section id="signin" className="border-t border-border bg-muted/40">
        <div className="mx-auto max-w-md px-6 py-14">
          <SectionHeader eyebrow="Members" title="Already one of us?" description="Signing in lands you on this week's letters — the version of this site with no subscribe buttons." />
          <LoginForm className="mt-6" onSubmit={() => {}} forgotHref="#plans" />
          <p className="mt-3 text-sm text-muted-foreground"><a className="font-medium underline underline-offset-4" href="#/letters">Peek at the signed-in side →</a></p>
        </div>
      </section>
    </SiteChrome>
  );
}
