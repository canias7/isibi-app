// software/docs-sidebar /pricing — a developer tool's pricing page answers a
// different question from a consumer product's. The tiers are the easy half;
// the half that decides it is what happens WHEN YOU CROSS A LIMIT, because a
// service that silently drops events at the cap is unusable at any price and
// one that bills you without warning is worse.
//
// So `plan-limit-row` carries `atLimit` on every line, and the sidebar stays —
// somebody comparing plans is reading the retry policy in the same tab.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Faq } from "@/components/ui/faq";
import { FeatureMatrix } from "@/components/ui/feature-matrix";
import { PlanLimitRow } from "@/components/ui/plan-limit-row";
import { PricingTable } from "@/components/ui/pricing-table";
import { SectionHeader } from "@/components/ui/section-header";
import { SideNav } from "@/components/ui/side-nav";
import { UsageMeter } from "@/components/ui/usage-meter";
import { DOCS } from "./index";
export const Route = createFileRoute("/pricing")({ component: P });
function P() {
  return (
    <SiteChrome name="Ferrule" tagline="Outbound webhooks with retries, signatures and a replay button."
      links={[{ label: "Docs", href: "#/" }, { label: "Support", href: "#/support" }]}
      action={{ label: "Get a key", href: "#/" }}>

      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-10 lg:grid-cols-[220px_1fr]">
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <SideNav sections={DOCS} />
          <div className="mt-6 rounded-lg border border-border p-4">
            <p className="text-sm font-medium">Free to 10,000 events</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              A month, indefinitely, no card. Enough to run a small product on for a year.
            </p>
          </div>
        </aside>

        <div>
          <SectionHeader eyebrow="Pricing" title="Priced on events sent, not on seats"
            description="An event is one call to send(). Retries are free — charging for them would mean charging you most when your customer's server is having its worst day, which is precisely backwards." />

          <PricingTable className="mt-8" tiers={[
            {
              name: "Free", price: "£0", period: "to 10,000 events a month",
              description: "Not a trial. It does not expire and it does not ask for a card.",
              features: ["Everything in the API", "Signatures and rotation", "16 retries over 5 days", "7-day event retention", "Community support"],
              action: { label: "Get a key", href: "#/" },
            },
            {
              name: "Standard", price: "£29", period: "a month, 250,000 events", featured: true,
              description: "Then £0.08 per thousand. Most companies here send between 40k and 400k.",
              features: [
                "Everything in Free",
                "30-day retention and replay",
                "The hosted endpoint page for your customers",
                "Ordered delivery per endpoint",
                "Email support, answered in a working day",
              ],
              action: { label: "Start", href: "#/" },
            },
            {
              name: "Volume", price: "£240", period: "a month, 5,000,000 events",
              description: "Then £0.03 per thousand. Worth moving to at about 2.5m — the calculator below says exactly where.",
              features: [
                "Everything in Standard",
                "90-day retention",
                "A second region, active-active",
                "99.95% written into a contract with money attached",
                "A shared channel and a named engineer",
              ],
              action: { label: "Talk to us", href: "#/support" },
            },
          ]} />

          {/* WHAT HAPPENS AT THE LIMIT, on every line. A cap that silently
              drops events is worse than no service; one that bills without
              warning is worse still. Neither is guessable from a tier table. */}
          <section className="mt-14 border-t border-border pt-10">
            <SectionHeader eyebrow="The limits" title="And exactly what happens when you hit one"
              description="On Standard. Nothing here fails silently, and the only line that costs money without asking is the event overage — which is capped at 3× your plan unless you raise it yourself." />
            <div className="mt-6 max-w-3xl space-y-2">
              <PlanLimitRow label="Events sent" limit={250_000} unit="a month" used={168_400}
                atLimit="charged" note="£0.08 per thousand after. Hard-capped at 3× until you lift it, and we email at 80% and 100%" />
              <PlanLimitRow label="Endpoints registered" limit={null} unit=""
                atLimit="refused" note="No limit and there never has been. One per customer is the normal shape and capping it would be capping your growth" />
              <PlanLimitRow label="Payload size" limit={256} unit="KB"
                atLimit="refused" note="413 at send(), immediately, not after it queues. Send an id and let them fetch the rest" />
              <PlanLimitRow label="Requests to the API" limit={1_000} unit="a minute"
                atLimit="slowed" note="429 with Retry-After, and the SDK honours it. Burst to 3,000 for 10 seconds" />
              <PlanLimitRow label="Retention and replay" limit={30} unit="days"
                atLimit="refused" note="Events older than this are gone rather than archived. Replay of anything inside the window is free and unlimited" />
              <PlanLimitRow label="Concurrent deliveries per endpoint" limit={20} unit=""
                atLimit="queued" note="Queued, not dropped. Raised on request for an endpoint that can genuinely take it" />
            </div>
            <div className="mt-8 max-w-md">
              <UsageMeter label="This account, August so far" used={168_400} total={250_000} unit=" events" />
            </div>
          </section>

          <section className="mt-14 border-t border-border pt-10">
            <SectionHeader eyebrow="Side by side" title="The differences that are not the event count" />
            <div className="mt-6">
              <FeatureMatrix
                highlight="standard"
                plans={[
                  { key: "free", label: "Free", note: "10k / month" },
                  { key: "standard", label: "Standard", note: "£29 / month" },
                  { key: "volume", label: "Volume", note: "£240 / month" },
                ]}
                groups={[
                  {
                    key: "delivery", label: "Delivery",
                    features: [
                      { key: "retries", label: "16 retries over 5 days", values: { free: true, standard: true, volume: true } },
                      { key: "sig", label: "Signatures and key rotation", values: { free: true, standard: true, volume: true } },
                      { key: "order", label: "Ordered per endpoint", hint: "Costs latency, so it is off by default on every plan", values: { free: false, standard: true, volume: true } },
                      { key: "region", label: "Second region, active-active", values: { free: false, standard: false, volume: true } },
                    ],
                  },
                  {
                    key: "ops", label: "When something goes wrong",
                    features: [
                      { key: "dlq", label: "Dead letter queue with response bodies", values: { free: true, standard: true, volume: true } },
                      { key: "retain", label: "Retention", values: { free: "7 days", standard: "30 days", volume: "90 days" } },
                      { key: "replay", label: "Bulk replay by endpoint and time range", values: { free: false, standard: true, volume: true } },
                      { key: "page", label: "Hosted endpoint page for your customers", values: { free: false, standard: true, volume: true } },
                    ],
                  },
                  {
                    key: "us", label: "Us",
                    features: [
                      { key: "sup", label: "Support", values: { free: "Community", standard: "Email, one working day", volume: "Shared channel" } },
                      { key: "sla", label: "Contractual SLA", hint: "99.95%, with service credits. The public status page is the same for everyone", values: { free: false, standard: false, volume: true } },
                      { key: "dpa", label: "DPA and sub-processor list", values: { free: true, standard: true, volume: true } },
                      { key: "inv", label: "Invoiced annually, by bank transfer", values: { free: false, standard: false, volume: true } },
                    ],
                  },
                ]} />
            </div>
          </section>

          <section className="mt-14 border-t border-border pt-10">
            <div className="max-w-3xl">
              <SectionHeader eyebrow="Asked often" title="About the bill" />
              <Faq className="mt-6" items={[
                { question: "Do retries count against my events?", answer: "No. One send() is one event however many times we try it. Charging per attempt would bill you most on the day one of your customers had an outage, which is the opposite of what you are paying us to absorb." },
                { question: "What happens if I go over on Standard?", answer: "You are charged £0.08 per thousand and we email at 80% and again at 100%. There is a hard stop at 3× your plan that you can raise or lower yourself — past it, send() returns 402 rather than a silent drop, so your code knows." },
                { question: "Can I set a spend cap?", answer: "Yes, in pounds, and it is the same control as the 3× default. When it is reached send() fails loudly. We would rather refuse an event than hand somebody a bill they did not agree to." },
                { question: "Is there a discount for annual?", answer: "Two months, on Standard and Volume, paid by card or transfer. No discount for a longer commitment than a year — we do not want the leverage and you should not want the lock-in." },
                { question: "What if I need to leave?", answer: "Export every event and delivery record as NDJSON, from the API, on any plan including Free. No ticket, no notice period, no export fee. The endpoint is in the reference under GET /v1/deliveries." },
                { question: "Do you charge for the sandbox?", answer: "There isn't one, deliberately. Test keys send to real endpoints you control and everything is free below 10,000 — a sandbox that behaves differently from production is a category of bug rather than a feature." },
                { question: "Startup or nonprofit pricing?", answer: "Standard free for a year for a registered charity or a company under two years old with no institutional funding. One email, no form, and we have never said no." },
              ]} />
            </div>
          </section>
        </div>
      </div>
    </SiteChrome>
  );
}
