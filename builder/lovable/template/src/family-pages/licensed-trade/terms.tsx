// licensed-trade /terms — the disclosures as a first-class page. Real sections
// with real headings — delivery, returns, licensing — because on a regulated
// site the compliance text IS content, and burying it is the design smell
// the family exists to avoid. No gate here: terms are legal to read at any age.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { DataTable } from "@/components/ui/data-table";
import { Faq } from "@/components/ui/faq";
import { TermsBlock } from "@/components/ui/terms-block";
export const Route = createFileRoute("/terms")({ component: P });
const CHROME = {
  name: "The Dram Room", tagline: "Independent whisky, Abbeydale Road.",
  links: [{ label: "The shelf", href: "#/" }, { label: "Terms", href: "#/terms" }],
};
function P() {
  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">Terms of sale</h1>
        <p className="mt-2 text-muted-foreground">Written to be read. If anything here surprises you at collection, we got this page wrong — tell us.</p>
        <section className="mt-8">
          <h2 className="text-lg font-medium">Collection and ID</h2>
          <TermsBlock className="mt-3" clauses={[
            "Collection is in person from the shop, within 14 days of the order.",
            "Photo ID matching the order name is checked every time — Challenge 25 applies, with no exceptions for regulars.",
            "An order that cannot be collected with matching ID is refunded in full, less nothing.",
          ]} />
        </section>
        <section className="mt-8">
          <h2 className="text-lg font-medium">Refunds, plainly</h2>
          <DataTable className="mt-3" columns={[{ key: "when", header: "Situation" }, { key: "what", header: "What happens" }]} rows={[
            { when: "Changed your mind, unopened", what: "Full refund within 30 days" },
            { when: "Corked or faulty bottle", what: "Replacement or refund, your choice — bring what's left" },
            { when: "Failed ID at collection", what: "Full refund, automatic" },
            { when: "Opened and just not to taste", what: "No refund — but come tell us; tasting is free" },
          ]} />
        </section>
        <section className="mt-8">
          <h2 className="text-lg font-medium">Licensing</h2>
          <TermsBlock className="mt-3" clauses={[
            "Premises licence 22/03412, issued by Sheffield City Council.",
            "Licensee: The Dram Room Ltd, 412 Abbeydale Road, Sheffield S7 1FR.",
            "We are obliged to refuse sale where we believe alcohol is being bought for a person under 18.",
            "Drinkaware: for advice about alcohol, visit drinkaware.co.uk.",
          ]} />
        </section>
        <section className="mt-8">
          <Faq items={[
            { question: "Do you post bottles?", answer: "No. Age-verified courier delivery costs more than the whisky deserves; collection keeps the Challenge 25 check honest and the prices down." },
            { question: "Can someone collect for me?", answer: "Only the order name, with their ID. It's the licence condition we won't bend." },
          ]} />
        </section>
      </div>
    </SiteChrome>
  );
}
