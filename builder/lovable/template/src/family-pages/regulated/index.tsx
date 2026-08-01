// regulated — the gate is structural: nothing renders before it, and the terms
// are sections, not fine print. A bottle shop's online counter.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { AgeGate } from "@/components/ui/age-gate";
import { ConsentCheckbox } from "@/components/ui/consent-checkbox";
import { PriceList } from "@/components/ui/price-list";
import { TermsBlock } from "@/components/ui/terms-block";
export const Route = createFileRoute("/")({ component: P });
function P() {
  const [consent, setConsent] = useState(false);
  return (
    <SiteChrome name="The Dram Room" tagline="Independent whisky, Abbeydale Road."
      links={[{ label: "The shelf", href: "#/" }, { label: "Terms of sale", href: "#/terms" }]}>
      <div className="mx-auto max-w-2xl px-6 py-12">
        {/* The gate wraps the CONTENT, not the whole site — the name and the
            terms are legal to show; the shelf is not until the answer. */}
        <AgeGate minAge={18} what="The shelf" storageKey="dram-room-age">
          <h1 className="text-2xl font-semibold tracking-tight">This month's shelf</h1>
          <PriceList className="mt-4" items={[
            { name: "Abbeydale 12, single cask", price: 58, meta: "70cl · 46%" },
            { name: "Islay farm bottling", price: 74, meta: "70cl · 54.2%" },
            { name: "Yorkshire single malt, first release", price: 65, meta: "70cl · 46%" }]} />
          <div className="mt-6">
            <ConsentCheckbox checked={consent} onCheckedChange={setConsent} id="collect">
              I understand collection is in person, with ID matching the order name.
            </ConsentCheckbox>
          </div>
        </AgeGate>
        <p className="mt-8 text-sm"><a className="font-medium underline underline-offset-4" href="#/terms">The full terms of sale — refunds, ID, licensing →</a></p>
        <TermsBlock className="mt-12" title="The legal bit, in full view" clauses={[
          "We sell alcohol only to persons aged 18 or over. Challenge 25 applies at collection.",
          "Licence 22/03412, Sheffield City Council. Licensee: The Dram Room Ltd.",
          "Drinkaware: for advice about alcohol, visit drinkaware.co.uk."]} />
      </div>
    </SiteChrome>
  );
}
