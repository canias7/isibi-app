// product-first — the thing itself is the hero; proof in descending strength;
// one signup path repeated. A mobile app.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Faq } from "@/components/ui/faq";
import { FeatureGrid } from "@/components/ui/feature-grid";
import { HeroSplit } from "@/components/ui/hero-split";
import { LogoCloud } from "@/components/ui/logo-cloud";
import { PricingTable } from "@/components/ui/pricing-table";
import { StoreBadges } from "@/components/ui/store-badges";
export const Route = createFileRoute("/")({ component: P });
function P() {
  return (
    <SiteChrome name="Snicket" tagline="Walking routes that prefer the alleys."
      links={[{ label: "Features", href: "#features" }, { label: "Pricing", href: "#pricing" }]}
      action={{ label: "Download", href: "#get" }}>
      <HeroSplit title="The quiet way there" subtitle="Snicket routes you down ginnels, jitties and back lanes — the ways a city actually walks." image={null} imageAlt="The app, mid-route down a ginnel" action={{ label: "Get Snicket", href: "#get" }} />
      <div id="get" className="mx-auto max-w-5xl px-6 pt-6"><StoreBadges label="Free on both" stores={[
        { key: "ios", name: "App Store", href: "#get" }, { key: "android", name: "Google Play", href: "#get" }]} /></div>
      <section id="features" className="mx-auto max-w-5xl px-6 py-16">
        <FeatureGrid columns={3} items={[
          { title: "Alleys first", description: "Routing weights the paths cars can't take." },
          { title: "Works offline", description: "Whole cities cached; the moors too." },
          { title: "Quiet scores", description: "Every street rated by ear, not by map." }]} />
      </section>
      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-10">
          <LogoCloud label="Walked with" items={[{ name: "Ramblers" }, { name: "CPRE" }, { name: "Outdoor City" }, { name: "Peak Rangers" }]} />
        </div>
      </section>
      <section id="pricing" className="mx-auto max-w-5xl px-6 py-16">
        <PricingTable tiers={[
          { name: "Free", price: "£0", features: ["Three saved routes", "One city offline"], action: { label: "Get the app", href: "#get" } },
          { name: "Wanderer", price: "£2.50", period: "/month", featured: true, features: ["Unlimited routes", "Everywhere offline", "Quiet-first routing"], action: { label: "Start free month", href: "#get" } }]} />
      </section>
      <section className="mx-auto max-w-2xl px-6 pb-16">
        <Faq items={[
          { question: "Does it work outside cities?", answer: "Yes — bridleways and access land are first-class. The Peak is our test bed." },
          { question: "Battery?", answer: "About 4% an hour with the screen off, voice on." }]} />
      </section>
    </SiteChrome>
  );
}
