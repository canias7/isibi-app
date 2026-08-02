// software — BENTO structure: the first screen is a dense grid of
// unequal tiles, each one fact or one door. The product tile is the biggest
// because the product is the hero; everything else earns its cell size.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { BentoGrid } from "@/components/ui/bento-grid";
import { CtaBand } from "@/components/ui/cta-band";
import { Faq } from "@/components/ui/faq";
import { PricingTable } from "@/components/ui/pricing-table";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { StoreBadges } from "@/components/ui/store-badges";
import { Testimonial } from "@/components/ui/testimonial";
export const Route = createFileRoute("/")({ component: P });
function P() {
  return (
    <SiteChrome name="Snicket" tagline="Walking routes that prefer the alleys."
      links={[{ label: "Pricing", href: "#/pricing" }, { label: "Support", href: "#/support" }]}
      action={{ label: "Download", href: "#get" }}>

      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Free on both stores</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">The quiet way there</h1>
        </div>
        {/* The bento IS the page — one product tile, then facts as tiles. */}
        <BentoGrid className="mt-8" items={[
          { span: 2, tall: true, content: (
            <div className="flex h-full flex-col">
              <SafeImage src={null} alt="The app, mid-route down a ginnel" ratio="16/9" />
              <p className="mt-4 text-lg font-medium">Snicket routes you down ginnels, jitties and back lanes — the ways a city actually walks.</p>
              <div id="get" className="mt-auto pt-4"><StoreBadges stores={[
                { key: "ios", name: "App Store", href: "#get" }, { key: "android", name: "Google Play", href: "#get" }]} /></div>
            </div>
          ) },
          { content: <div><p className="text-3xl font-semibold tabular-nums">120k</p><p className="mt-1 text-sm text-muted-foreground">walkers, zero ads, ever</p></div> },
          { content: <div><p className="font-medium">Alleys first</p><p className="mt-1 text-sm text-muted-foreground">Routing weights the paths cars can't take.</p></div> },
          { content: <div><p className="font-medium">Works offline</p><p className="mt-1 text-sm text-muted-foreground">Whole cities cached. The moors too.</p></div> },
          { content: <div><p className="font-medium">Quiet scores</p><p className="mt-1 text-sm text-muted-foreground">Every street rated by ear, not by map.</p></div> },
          { tall: true, content: (
            <div className="flex h-full flex-col">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">From the stores</p>
              <p className="mt-3 text-sm leading-relaxed">"It sent me down a lane I'd driven past for eleven years. There was a heron. I moved house for less."</p>
              <p className="mt-auto pt-3 text-sm font-medium">4.8★ across both stores</p>
            </div>
          ) },
          { content: <div><p className="font-medium">Honest timings</p><p className="mt-1 text-sm text-muted-foreground">Your pace, learned — not a fit twenty-something's.</p></div> },
          { content: <div><p className="font-medium">GPX out</p><p className="mt-1 text-sm text-muted-foreground">Every walk exports. No lock-in by design.</p></div> },
          { span: 2, content: (
            <div className="flex h-full items-center justify-between gap-4">
              <div><p className="font-medium">Wanderer — £2.50 a month</p><p className="mt-1 text-sm text-muted-foreground">Unlimited routes, everywhere offline, quiet-first routing.</p></div>
              <a className="shrink-0 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground" href="#/pricing">Compare plans</a>
            </div>
          ) },
        ]} />
      </div>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-4xl px-6 py-12">
          <Testimonial item={{ quote: "The only app that understands a walk isn't a failed drive.", name: "Outdoor City", role: "Apps of the year" }} />
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-5xl px-6 py-14">
        <SectionHeader eyebrow="Pricing" title="Free is the app. Wanderer removes the counts." />
        <PricingTable className="mt-8" tiers={[
          { name: "Free", price: "£0", features: ["Three saved routes", "One city offline", "Quiet scores everywhere"], action: { label: "Get the app", href: "#get" } },
          { name: "Wanderer", price: "£2.50", period: "month", featured: true, features: ["Unlimited routes", "Everywhere offline", "Quiet-first routing", "Route history"], action: { label: "Start free month", href: "#get" } }]} />
        <p className="mt-4 text-center text-sm"><a className="underline underline-offset-4" href="#/pricing">Every difference, feature by feature →</a></p>
      </section>

      <section className="mx-auto max-w-2xl px-6 pb-14">
        <Faq items={[
          { question: "Does it work outside cities?", answer: "Yes — bridleways and access land are first-class. The Peak is our test bed." },
          { question: "Battery?", answer: "About 4% an hour with the screen off, voice on. The deeper answer is on the support page." }]} />
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-16">
        <CtaBand title="Walk the quiet way home tonight" description="Free on both stores. The alleys are waiting." action={{ label: "Get Snicket", href: "#get" }} />
      </section>
    </SiteChrome>
  );
}
