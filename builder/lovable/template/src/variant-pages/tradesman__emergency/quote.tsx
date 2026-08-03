// tradesman/emergency /quote — the intake form, with the urgency question
// answered ON the page rather than in the form. In the emergency variant the
// form is explicitly the NOT-urgent path, and saying so protects both sides:
// somebody with a burst pipe filling this in at midnight will not be read until
// seven, and they need to know that before they type.
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
    <SiteChrome name="Barlow & Son" tagline="Plumbing and heating, Sheffield. Somebody answers at three in the morning."
      links={[{ label: "Home", href: "#/" }, { label: "The work", href: "#/work" }]}
      action={{ label: "24hr: 07700 900 411", href: "tel:+447700900411" }}>
      <div className="mx-auto max-w-5xl px-6 py-14">
        {/* THE FORM IS THE NOT-URGENT PATH, and the page says so before the
            first field. Somebody typing this at midnight with water coming in
            will not be read until seven, and they need that fact now. */}
        <div className="rounded-lg border border-border bg-muted/50 p-6">
          <p className="text-lg font-semibold tracking-tight">If it is happening right now, do not use this form</p>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-muted-foreground">
            It reaches an inbox that gets read at seven in the morning. A burst, a leak through a
            ceiling, no heat with a baby in the house — ring instead, at any hour, and somebody
            picks up.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <a className="rounded-md bg-primary px-6 py-3 text-base font-semibold text-primary-foreground" href="tel:+447700900411">
              Ring 07700 900 411
            </a>
            <span className="text-sm text-muted-foreground">
              Office hours, 07:00–18:00: <a className="font-medium text-foreground underline underline-offset-4" href="tel:+441142661180">0114 266 1180</a>
            </span>
          </div>
        </div>

        <SectionHeader className="mt-12" eyebrow="A quote" title="For everything that can wait until tomorrow"
          description="A bathroom, a boiler swap, radiators, a job you have been putting off. Answered the same working day, and photographs get you a real number instead of a range." />
        <div className="mt-10 grid gap-12 lg:grid-cols-[1.2fr_1fr]">
          <QuoteRequest sent={sent} onSubmit={() => setSent(true)}
            urgencies={["Sometime in the next few weeks", "This week if you can", "Tomorrow — but it is not an emergency"]}
            trades={["Bathroom", "Boiler or heating", "Radiators", "A leak that is under control", "Blocked drain", "Something else"]} />
          <aside className="space-y-6">
            <TrustStrip columns={1} items={[
              { title: "No charge to look", description: "We do not bill for coming out to quote, ever" },
              { title: "Fixed before we start", description: "Written on the day, and it is the price" },
              { title: "Gas Safe 512204", description: "Check it on the register — please do" },
            ]} />
            <div className="rounded-lg border border-border bg-muted/40 p-5 text-sm leading-relaxed text-muted-foreground">
              <p className="font-medium text-foreground">What helps most</p>
              <p className="mt-2">
                One photograph wide enough to see the room, one close enough to read the boiler
                badge, and anything with a make and model on it. That is usually the whole job, and
                it turns a two-visit quote into a one-message one.
              </p>
            </div>
            <div className="rounded-lg border border-border p-5 text-sm leading-relaxed text-muted-foreground">
              <p className="font-medium text-foreground">Why the emergency number is a mobile</p>
              <p className="mt-2">
                Because at two in the morning a landline is a voicemail. It is Dave's own phone, it
                is on his bedside table, and if it rings out he is under somebody else's floor —
                leave it thirty seconds and ring again rather than giving up.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </SiteChrome>
  );
}
