// estate-agent /landlords — the OTHER audience. The tenant side is search;
// the landlord side is a pitch with numbers in it: what managing costs, what
// it includes, and the valuation ask the home page's CTA has pointed at all
// along.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { BusyButton } from "@/components/ui/busy-button";
import { ComparisonTable } from "@/components/ui/comparison-table";
import { FormRow } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import { StatsBand } from "@/components/ui/stats-band";
import { SuccessPanel } from "@/components/ui/success-panel";
import { Testimonial } from "@/components/ui/testimonial";
export const Route = createFileRoute("/landlords")({ component: P });
const CHROME = {
  name: "Loxley Lets", tagline: "Rentals across the west of the city.",
  links: [{ label: "For tenants", href: "#/" }, { label: "For landlords", href: "#/landlords" }],
  action: { label: "Value my property", href: "#valuation" },
};
function P() {
  const [postcode, setPostcode] = useState("");
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState(false);
  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">We manage 240 homes within three miles of yours</h1>
        <StatsBand className="mt-6" items={[
          { value: "9 days", label: "Median time to let" },
          { value: "0.4%", label: "Rent arrears last year" },
          { value: "£0", label: "Setup, renewal or exit fees" }]} />
        <section className="mt-10">
          <h2 className="text-lg font-medium">Two ways to use us</h2>
          <ComparisonTable className="mt-4" columns={["Let only — 60% of first month", "Fully managed — 9% monthly"]} rows={[
            { feature: "Marketing, viewings, referencing", values: [true, true] },
            { feature: "Deposit registration", values: [true, true] },
            { feature: "Rent collection and chasing", values: [false, true] },
            { feature: "Repairs, with our own trades", values: [false, true] },
            { feature: "Annual gas and electrical compliance", values: [false, true] },
            { feature: "You ever speak to the tenant", values: ["Yes", "Only if you want to"] },
          ]} />
        </section>
        <Testimonial className="mt-10" item={{ quote: "Eleven years, three flats, one phone call about a boiler. That's the whole story.", name: "G. Fletcher", role: "Landlord since 2015" }} />
        <section id="valuation" className="mt-10 rounded-xl border bg-muted/40 p-6">
          <h2 className="text-lg font-medium">What would yours let for?</h2>
          {sent ? (
            <SuccessPanel className="mt-4" title="Valuation booked" description="Rosie will ring within the day — the visit takes twenty minutes and the number is yours to keep either way." action={{ label: "See what's letting now", href: "#/" }} />
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <FormRow label="Postcode" htmlFor="ll-pc" required>
                <Input id="ll-pc" autoComplete="postal-code" value={postcode} onChange={(e) => setPostcode(e.target.value)} />
              </FormRow>
              <FormRow label="Phone" htmlFor="ll-ph" required>
                <Input id="ll-ph" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </FormRow>
              <BusyButton disabled={!postcode || !phone} onClick={() => setSent(true)}>Book the visit</BusyButton>
            </div>
          )}
        </section>
      </div>
    </SiteChrome>
  );
}
