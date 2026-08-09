// estate-agent /listing — one property told fully: the gallery first (the
// pictures are why anyone clicked), then the facts as a table, then the
// viewing enquiry. The card grid brought them here; this page closes.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Badge } from "@/components/ui/badge";
import { BusyButton } from "@/components/ui/busy-button";
import { DescriptionList } from "@/components/ui/description-list";
import { FormRow } from "@/components/ui/form-row";
import { Gallery } from "@/components/ui/gallery";
import { Input } from "@/components/ui/input";
import { SuccessPanel } from "@/components/ui/success-panel";
export const Route = createFileRoute("/listing")({ component: P });
const CHROME = {
  name: "Loxley Lets", tagline: "Rentals across the west of the city.",
  links: [{ label: "All homes", href: "/" }],
  action: { label: "Value my property", href: "/" },
};
function P() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState(false);
  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-4xl px-6 py-10">
        <a className="text-sm text-muted-foreground underline underline-offset-4" href="/">← Back to results</a>
        <div className="mt-4 flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Flat 2, 14 Commonside, Walkley</h1>
            <p className="mt-1 text-muted-foreground">Two beds over the bakery, top of the hill.</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-semibold tabular-nums">£925 <span className="text-sm font-normal text-muted-foreground">pcm</span></div>
            <Badge variant="secondary" className="mt-1">New this week</Badge>
          </div>
        </div>
        <Gallery className="mt-6" columns={3} items={[
          { src: null, alt: "The front room, bay window" },
          { src: null, alt: "Kitchen, refitted 2025" },
          { src: null, alt: "Bedroom one" },
          { src: null, alt: "Bedroom two" },
          { src: null, alt: "Bathroom" },
          { src: null, alt: "The view down Commonside" },
        ]} />
        <div className="mt-10 grid gap-10 sm:grid-cols-2">
          <section>
            <h2 className="text-lg font-medium">The facts</h2>
            <DescriptionList className="mt-3" items={[
              { label: "Rent", value: "£925 pcm" },
              { label: "Deposit", value: "£1,067 (five weeks)" },
              { label: "Bedrooms", value: "2" },
              { label: "Bathrooms", value: "1" },
              { label: "Floor area", value: "61 m²" },
              { label: "Council tax", value: "Band A" },
              { label: "EPC", value: "C (72)" },
              { label: "Available", value: "1 September" },
              { label: "Furnished", value: "Either — say which" },
              { label: "Pets", value: "Considered" },
            ]} />
          </section>
          <section>
            <h2 className="text-lg font-medium">Book a viewing</h2>
            {sent ? (
              <SuccessPanel className="mt-3" title="Enquiry sent" description="Rosie handles Walkley — she'll ring you today with times." action={{ label: "Back to all homes", href: "/" }} />
            ) : (
              <div className="mt-3 grid gap-4">
                <FormRow label="Your name" htmlFor="lv-name" required>
                  <Input id="lv-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
                </FormRow>
                <FormRow label="Phone" htmlFor="lv-phone" hint="Evenings fine — say if you'd rather text." required>
                  <Input id="lv-phone" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </FormRow>
                <BusyButton disabled={!name || !phone} onClick={() => setSent(true)}>Ask about this flat</BusyButton>
                <p className="text-xs text-muted-foreground">No fees to tenants. Viewings usually within two days.</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </SiteChrome>
  );
}
