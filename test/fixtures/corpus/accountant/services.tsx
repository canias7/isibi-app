// accountant /services — each practice area stated plainly: what it covers,
// what it costs to start, who does the work. Fees in the open because a firm
// that hides its prices reads as a firm that surprises you with them.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CtaBand } from "@/components/ui/cta-band";
import { PriceList } from "@/components/ui/price-list";
import { VerifiedBadge } from "@/components/ui/verified-badge";
export const Route = createFileRoute("/services")({ component: P });
const CHROME = {
  name: "Hartley & Voss", tagline: "Chartered accountants, est. 1987.",
  links: [{ label: "Home", href: "/" }, { label: "What we do", href: "/services" }, { label: "Contact", href: "/contact" }],
  action: { label: "Free consultation", href: "/contact" },
};
const AREAS = [
  { title: "Year-end accounts & tax", body: "Statutory accounts, CT600, and a January that doesn't hurt. We file everything and explain what it means once a year, in person.", who: "Eleanor Hartley FCA" },
  { title: "Payroll & CIS", body: "Weekly or monthly runs, pensions, subcontractor verification. You approve a summary; everything else just happens.", who: "Run in-house, checked by a partner" },
  { title: "VAT", body: "Registration, the right scheme (most builders are on the wrong one), and quarterly returns filed from your records, not re-typed.", who: "Jakob Voss CTA" },
  { title: "HMRC enquiries", body: "If a letter arrives, it comes to us. We have closed forty-one enquiries; thirty-eight closed with no adjustment.", who: "Jakob Voss CTA" },
];
function P() {
  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">What we do, priced</h1>
        <p className="mt-2 max-w-xl text-muted-foreground">Fixed monthly fees, agreed before any work starts, reviewed once a year. No time-sheets, no surprise invoices.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {AREAS.map((a) => (
            <Card key={a.title}>
              <CardHeader><CardTitle className="text-base">{a.title}</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{a.body}</p>
                <p className="mt-3 text-xs font-medium">{a.who} <VerifiedBadge className="ms-1" label="Partner-led" /></p>
              </CardContent>
            </Card>
          ))}
        </div>
        <section className="mt-10">
          <h2 className="text-lg font-medium">Where fees start</h2>
          <PriceList className="mt-2" items={[
            { name: "Sole trader", description: "Accounts and self-assessment", price: 55, meta: "per month" },
            { name: "Limited company", description: "Accounts, CT600, payroll for directors", price: 125, meta: "per month" },
            { name: "Company + payroll", description: "Up to ten staff, pensions included", price: 175, meta: "per month" },
            { name: "One-off self-assessment", description: "Straightforward return, filed", price: 240, meta: "fixed" },
          ]} />
          <p className="mt-3 text-xs text-muted-foreground">"Start" means most clients of that shape pay this. If yours will cost more, you'll know at the first meeting, not on an invoice.</p>
        </section>
        <CtaBand className="mt-10" title="The first hour is free" description="Bring your numbers. You leave with plain answers either way." action={{ label: "Book the hour", href: "/contact" }} />
      </div>
    </SiteChrome>
  );
}
