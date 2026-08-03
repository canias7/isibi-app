// tradesman /quote — the intake form. Photographs first, because a picture of
// the pipe collapses a site visit into one message.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { QuoteRequest } from "@/components/ui/quote-request";
import { SectionHeader } from "@/components/ui/section-header";
import { TrustStrip } from "@/components/ui/trust-strip";
export const Route = createFileRoute("/quote")({ component: P });
function P() {
  const [sent, setSent] = useState(false);
  return (
    <SiteChrome name="Barlow & Son" tagline="Plumbing and heating, Sheffield S6 and S10."
      links={[{ label: "Home", href: "#/" }, { label: "The work", href: "#/work" }]}
      action={{ label: "0114 266 1180", href: "tel:+441142661180" }}>
      <div className="mx-auto max-w-5xl px-6 py-14">
        <SectionHeader eyebrow="A quote" title="Tell us what's happening"
          description="Answered the same day, emergencies first. If water is coming in, ring instead — this can wait and that cannot." />
        <div className="mt-10 grid gap-12 lg:grid-cols-[1.2fr_1fr]">
          <QuoteRequest sent={sent} onSubmit={() => setSent(true)}
            trades={["Leak or burst", "Boiler or heating", "Bathroom", "Radiators", "Blocked drain", "Something else"]} />
          <aside className="space-y-6">
            <TrustStrip columns={1} items={[
              { title: "No charge to look", description: "We do not bill for coming out to quote" },
              { title: "Fixed before we start", description: "Written on the day, and it is the price" },
              { title: "Gas Safe 512204", description: "Check it on the register — please do" },
            ]} />
            <div className="rounded-lg border border-border bg-muted/40 p-5 text-sm leading-relaxed text-muted-foreground">
              <p className="font-medium text-foreground">What helps most</p>
              <p className="mt-2">
                One photograph wide enough to see the room, one close enough to read the boiler badge, and
                anything with a make and model on it. That is usually the whole job.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </SiteChrome>
  );
}
