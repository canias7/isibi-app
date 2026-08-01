// product-first — the thing itself is the hero; proof in descending strength;
// one signup path repeated. A mobile app, in bands: the product working, the
// stores, features, who walks with it, the numbers, pricing, questions, and
// the same verb to close.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { CtaBand } from "@/components/ui/cta-band";
import { Faq } from "@/components/ui/faq";
import { FeatureGrid } from "@/components/ui/feature-grid";
import { HeroSplit } from "@/components/ui/hero-split";
import { LogoCloud } from "@/components/ui/logo-cloud";
import { PricingTable } from "@/components/ui/pricing-table";
import { SectionHeader } from "@/components/ui/section-header";
import { StatsBand } from "@/components/ui/stats-band";
import { StoreBadges } from "@/components/ui/store-badges";
import { Testimonial } from "@/components/ui/testimonial";
export const Route = createFileRoute("/")({ component: P });
function P() {
  return (
    <SiteChrome name="Snicket" tagline="Walking routes that prefer the alleys."
      links={[{ label: "Features", href: "#features" }, { label: "Pricing", href: "#/pricing" }, { label: "Support", href: "#/support" }]}
      action={{ label: "Download", href: "#get" }}>

      <HeroSplit title="The quiet way there"
        subtitle="Snicket routes you down ginnels, jitties and back lanes — the ways a city actually walks. Ten minutes longer, ten times better."
        image={null} imageAlt="The app, mid-route down a ginnel"
        action={{ label: "Get Snicket free", href: "#get" }} />
      <div id="get" className="mx-auto max-w-5xl px-6 pt-2">
        <StoreBadges label="Free on both" stores={[
          { key: "ios", name: "App Store", href: "#get" }, { key: "android", name: "Google Play", href: "#get" }]} />
      </div>

      <section id="features" className="mx-auto max-w-5xl px-6 py-16">
        <SectionHeader eyebrow="Why it's different" title="Built for walking, not driving-but-slower" />
        <FeatureGrid className="mt-8" columns={3} items={[
          { title: "Alleys first", description: "Routing weights the paths cars can't take — ginnels, snickets, towpaths, desire lines." },
          { title: "Works offline", description: "Whole cities cached before you leave the house. The moors too." },
          { title: "Quiet scores", description: "Every street rated by ear, not by map. The loud way is never the only way." },
          { title: "Honest timings", description: "Your pace, learned — not a fit twenty-something's." },
          { title: "GPX out", description: "Every walk exports. Your data is yours; there is no lock-in by design." },
          { title: "Battery-kind", description: "About 4% an hour, screen off, voice on." },
        ]} />
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-12">
          <LogoCloud label="Walked with" items={[{ name: "Ramblers" }, { name: "CPRE" }, { name: "Outdoor City" }, { name: "Peak Rangers" }]} />
          <StatsBand className="mt-10" items={[
            { value: "120k", label: "Walkers" },
            { value: "38", label: "Cities mapped by ear" },
            { value: "4.8★", label: "Across both stores" },
            { value: "0", label: "Ads, ever" }]} />
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-16">
        <Testimonial item={{ quote: "It sent me down a lane I'd driven past for eleven years. There was a heron. I moved house for less.", name: "App Store review", role: "March 2026" }} />
      </section>

      <section id="pricing" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <SectionHeader eyebrow="Pricing" title="Free is the app. Wanderer removes the counts." />
          <PricingTable className="mt-8" tiers={[
            { name: "Free", price: "£0", features: ["Three saved routes", "One city offline", "Quiet scores everywhere"], action: { label: "Get the app", href: "#get" } },
            { name: "Wanderer", price: "£2.50", period: "month", featured: true, features: ["Unlimited routes", "Everywhere offline", "Quiet-first routing", "Route history"], action: { label: "Start free month", href: "#get" } }]} />
          <p className="mt-4 text-center text-sm"><a className="underline underline-offset-4" href="#/pricing">Every difference, feature by feature →</a></p>
        </div>
      </section>

      <section className="mx-auto max-w-2xl px-6 py-16">
        <SectionHeader eyebrow="Questions" title="The two everyone asks" />
        <Faq className="mt-6" items={[
          { question: "Does it work outside cities?", answer: "Yes — bridleways and access land are first-class. The Peak is our test bed." },
          { question: "Battery?", answer: "About 4% an hour with the screen off, voice on. There's a deeper answer on the support page." }]} />
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-20">
        <CtaBand title="Walk the quiet way home tonight" description="Free on both stores. The alleys are waiting." action={{ label: "Get Snicket", href: "#get" }} />
      </section>
    </SiteChrome>
  );
}
