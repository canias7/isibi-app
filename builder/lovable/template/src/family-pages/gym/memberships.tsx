// gym /memberships — the plans compared. One membership works at
// every gym: that IS the chain's pitch, so the page says it in the first
// line and the table proves there's no catch to find.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { ComparisonTable } from "@/components/ui/comparison-table";
import { Faq } from "@/components/ui/faq";
import { PricingTable } from "@/components/ui/pricing-table";
export const Route = createFileRoute("/memberships")({ component: P });
const CHROME = {
  name: "Forge Gyms", tagline: "Four gyms, one membership, no contracts.",
  links: [{ label: "Find a gym", href: "/" }, { label: "Kelham", href: "/location" }, { label: "Memberships", href: "/memberships" }],
  action: { label: "Join — £24.99", href: "#join" },
};
function P() {
  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">One membership. All four gyms. No contract.</h1>
        <p className="mt-2 max-w-xl text-muted-foreground">Every plan works at every Forge, every day it's open. The off-peak plan exists because 10am has room to sell cheaper — that's the whole trick.</p>
        <div id="join" className="mt-8">
          <PricingTable tiers={[
            { name: "Off-peak", price: "£17.99", period: "month", description: "Weekdays 9–4, all weekend.", features: ["All four gyms", "All classes in the window", "Cancel any month"], action: { label: "Join off-peak", href: "/" } },
            { name: "Anytime", price: "£24.99", period: "month", featured: true, description: "Every hour we're open.", features: ["All four gyms", "All classes", "Bring a guest on Sundays", "Cancel any month"], action: { label: "Join anytime", href: "/" } },
            { name: "Day pass", price: "£8", description: "Visiting, or just checking us out.", features: ["Any one gym, one day", "Counts off your first month if you join"], action: { label: "Get a pass", href: "/" } },
          ]} />
        </div>
        <section className="mt-12">
          <h2 className="text-lg font-medium">The fine print, as a table instead of fine print</h2>
          <ComparisonTable className="mt-4" columns={["Off-peak", "Anytime"]} rows={[
            { feature: "Joining fee", values: [false, false] },
            { feature: "Contract length", values: ["None", "None"] },
            { feature: "Freeze a month (holiday, injury)", values: [true, true] },
            { feature: "Weekday evenings", values: [false, true] },
            { feature: "Guest passes", values: [false, "Sundays"] },
            { feature: "Price rise notice", values: ["60 days", "60 days"] },
          ]} />
        </section>
        <section className="mx-auto mt-12 max-w-2xl">
          <Faq items={[
            { question: "How do I cancel?", answer: "At any desk or by email, effective end of the paid month. No form, no call, no 'retention specialist'." },
            { question: "Is there a student price?", answer: "Off-peak is the student price — lectures are why off-peak exists. Bring your card once." },
            { question: "Can I switch plans?", answer: "Any month, either direction, at the desk in under a minute." },
          ]} />
        </section>
      </div>
    </SiteChrome>
  );
}
