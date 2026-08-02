// agency /pricing — the packages, priced in the open. Every enquiry
// asks first; answering on the site filters the mismatched budgets out
// before anyone writes a paragraph, which is kindness in both directions.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { CtaBand } from "@/components/ui/cta-band";
import { Faq } from "@/components/ui/faq";
import { PricingTable } from "@/components/ui/pricing-table";
export const Route = createFileRoute("/pricing")({ component: P });
const CHROME = {
  name: "Hale & Frost", tagline: "Weddings photographed like they felt.",
  links: [{ label: "The work", href: "#/" }, { label: "Pricing", href: "#/pricing" }, { label: "Enquire", href: "#/contact" }],
  action: { label: "Start a project", href: "#/contact" },
};
function P() {
  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-4xl px-6 py-14">
        <h1 className="text-3xl font-semibold tracking-tight">What it costs, plainly</h1>
        <p className="mt-2 max-w-xl text-muted-foreground">Three shapes, no hidden extras, travel inside Yorkshire included. The middle one is what most people want.</p>
        <PricingTable className="mt-8" tiers={[
          { name: "The day", price: "£1,450", description: "Ceremony to first dance, one photographer.", features: ["8 hours", "400+ edited photographs", "Online gallery, yours to share"], action: { label: "Ask about a date", href: "#/contact" } },
          { name: "The whole story", price: "£2,100", featured: true, description: "Both of us, morning until the band stops.", features: ["12 hours, two photographers", "700+ edited photographs", "The 6-minute film of the speeches", "An album your gran can hold"], action: { label: "Ask about a date", href: "#/contact" } },
          { name: "Elopements", price: "£650", description: "Registry office and a walk somewhere wild.", features: ["3 hours", "150+ edited photographs", "Midweek only"], action: { label: "Ask about a date", href: "#/contact" } },
        ]} />
        <section className="mx-auto mt-12 max-w-2xl">
          <Faq items={[
            { question: "Do you hold dates?", answer: "For a week after we speak, free. Past that it's the £300 deposit, which comes off the balance." },
            { question: "How long until the photos arrive?", answer: "A twenty-photo preview inside 48 hours; the full gallery in four weeks. The album takes eight." },
            { question: "Can we print them ourselves?", answer: "Yes — full-resolution files with print rights are in every package. We'd rather your walls were full." },
            { question: "What if it rains?", answer: "This is Yorkshire; some of our best work is umbrellas. See the gallery." },
          ]} />
        </section>
        <CtaBand className="mt-12" title="2027 has nine weekends left" description="Tell us the date and the place. We answer within a day." action={{ label: "Start a project", href: "#/contact" }} />
      </div>
    </SiteChrome>
  );
}
