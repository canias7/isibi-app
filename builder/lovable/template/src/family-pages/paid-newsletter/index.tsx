// paid-newsletter — EDITORIAL structure, because this one IS a publication:
// a masthead, a standfirst, the letter set in columns with the wall mid-
// column, and the plans as a rate card in the margin. Nothing centered,
// nothing banded — it reads like the thing it is selling.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { ArticleCard } from "@/components/ui/article-card";
import { LoginForm } from "@/components/ui/login-form";
import { Paywall } from "@/components/ui/paywall";
import { PricingTable } from "@/components/ui/pricing-table";
export const Route = createFileRoute("/")({ component: P });
function P() {
  return (
    <SiteChrome name="The Crucible Letter" tagline="Sheffield theatre, reviewed weekly."
      links={[{ label: "Sign in", href: "#signin" }, { label: "Subscribe", href: "#plans" }]}
      action={{ label: "Subscribe", href: "#plans" }}>

      {/* The masthead — a publication's front page, not a product's hero. */}
      <div className="border-b-2 border-foreground">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">No. 217 · 1 August 2026 · weekly</p>
          <h1 className="mt-2 text-6xl font-semibold tracking-tight">The Crucible Letter</h1>
          <p className="mt-2 text-sm text-muted-foreground">Every stage in the city · no ads · no free tickets accepted, ever · 2,900 members keeping it honest</p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-12 py-12 md:grid-cols-12">
          {/* The letter, in the reading column — wall and all. */}
          <article className="md:col-span-7">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">This week's letter · Crucible</p>
            <h2 className="mt-2 text-4xl font-semibold tracking-tight text-balance">A Streetcar with the brakes off</h2>
            <p className="mt-2 text-sm text-muted-foreground">By R. Okafor · 9 min read</p>
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

          {/* The margin: rate card and the archive, like a paper's rail. */}
          <aside className="md:col-span-4 md:col-start-9">
            <div id="plans">
              <p className="border-b-2 border-foreground pb-2 text-xs font-medium uppercase tracking-widest">The rate card</p>
              <PricingTable className="mt-4" tiers={[
                { name: "Monthly", price: "£4", period: "month", features: ["Every review", "The archive", "Comments"], action: { label: "Join monthly", href: "#plans" } },
                { name: "Annual", price: "£36", period: "year", features: ["Two months free", "Season previews"], featured: true, action: { label: "Join yearly", href: "#plans" } },
              ]} />
            </div>
            <div className="mt-10">
              <p className="border-b-2 border-foreground pb-2 text-xs font-medium uppercase tracking-widest">From the archive</p>
              <div className="mt-4 grid gap-4">
                <ArticleCard title="Standing at the Lyceum: the £12 seats that shouldn't work" excerpt="Row A of the gods, and why the sound beats the stalls." meta="25 July · 7 min" href="#plans" />
                <ArticleCard title="The fight director nobody credits" excerpt="Every fall you believed this year was hers." meta="11 July · 9 min" href="#plans" />
              </div>
              <p className="mt-3 text-xs text-muted-foreground">217 letters back to 2022 — membership opens all of them. <a className="font-medium underline underline-offset-4" href="#/letters">Peek at the signed-in side →</a></p>
            </div>
          </aside>
        </div>

        <div id="signin" className="grid gap-8 border-t border-border py-12 md:grid-cols-12">
          <div className="md:col-span-4">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Members</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Already one of us?</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Signing in lands you on this week's letters — the version of this site with no subscribe buttons anywhere.</p>
          </div>
          <div className="md:col-span-5 md:col-start-6">
            <LoginForm onSubmit={() => {}} forgotHref="#plans" />
          </div>
        </div>
      </div>
    </SiteChrome>
  );
}
