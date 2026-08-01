// regulated — the gate is structural: nothing renders before it, and the
// terms are sections, not fine print. A bottle shop: the gate wraps the
// shelf, the shelf is worth gating, and the licence text sits in the open
// with a page of its own behind it.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { AgeGate } from "@/components/ui/age-gate";
import { ConsentCheckbox } from "@/components/ui/consent-checkbox";
import { PriceList } from "@/components/ui/price-list";
import { SectionHeader } from "@/components/ui/section-header";
import { TermsBlock } from "@/components/ui/terms-block";
import { Testimonial } from "@/components/ui/testimonial";
export const Route = createFileRoute("/")({ component: P });
function P() {
  const [consent, setConsent] = useState(false);
  return (
    <SiteChrome name="The Dram Room" tagline="Independent whisky, Abbeydale Road."
      links={[{ label: "The shelf", href: "#/" }, { label: "Tastings", href: "#/tastings" }, { label: "Terms of sale", href: "#/terms" }]}>

      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-2xl px-6 py-12">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">412 Abbeydale Road · licence 22/03412</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">Whisky worth the walk up Abbeydale Road</h1>
          <p className="mt-3 max-w-lg text-lg text-muted-foreground">Two hundred bottles, a third of them from casks we chose ourselves. Order online, collect in person, ID every time.</p>
        </div>
      </section>

      <div className="mx-auto max-w-2xl px-6 py-12">
        {/* The gate wraps the CONTENT, not the whole site — the name and the
            terms are legal to show; the shelf is not until the answer. */}
        <AgeGate minAge={18} what="The shelf" storageKey="dram-room-age">
          <SectionHeader eyebrow="This month" title="The shelf" description="Six on tasting pour this month — ask at the counter before you commit to a bottle." />
          <PriceList className="mt-6" items={[
            { name: "Abbeydale 12, single cask", description: "Our own pick — orchard fruit, then smoke", price: 58, meta: "70cl · 46%" },
            { name: "Islay farm bottling", description: "Peat like a bonfire three fields away", price: 74, meta: "70cl · 54.2%" },
            { name: "Yorkshire single malt, first release", description: "History in a glass, and actually good", price: 65, meta: "70cl · 46%" },
            { name: "Bourbon-cask Speyside, 9 yr", description: "The gateway bottle — buy this first", price: 42, meta: "70cl · 43%" },
          ]} />
          <div className="mt-6">
            <ConsentCheckbox checked={consent} onCheckedChange={setConsent} id="collect">
              I understand collection is in person, with ID matching the order name.
            </ConsentCheckbox>
          </div>
          <div className="mt-8 rounded-xl border bg-muted/40 p-5">
            <Testimonial item={{ quote: "They talked me OUT of the expensive bottle and into the right one. That's a shop.", name: "Google review", role: "4.9, two hundred of them" }} />
          </div>
          <p className="mt-6 text-sm"><a className="font-medium underline underline-offset-4" href="#/tastings">Tastings — six seats, twice a month →</a></p>
        </AgeGate>

        <TermsBlock className="mt-12" title="The legal bit, in full view" clauses={[
          "We sell alcohol only to persons aged 18 or over. Challenge 25 applies at collection.",
          "Licence 22/03412, Sheffield City Council. Licensee: The Dram Room Ltd.",
          "Drinkaware: for advice about alcohol, visit drinkaware.co.uk."]} />
        <p className="mt-4 text-sm"><a className="font-medium underline underline-offset-4" href="#/terms">The full terms of sale — refunds, ID, licensing →</a></p>
      </div>
    </SiteChrome>
  );
}
