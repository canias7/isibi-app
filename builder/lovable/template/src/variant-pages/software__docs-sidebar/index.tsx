// software/docs-sidebar — A DEVELOPER TOOL. The base family opens with the
// product shown working, because for a walking app or a game the screenshot IS
// the evaluation.
//
// A developer tool has no screenshot worth showing. What it has is a command
// and a response, and the question being asked on this page is not "does it
// look good" but "can I have this working before I lose interest" — which is
// answered by the install line and the first request, not by a hero image. So
// the docs nav is pinned left from the top of the page rather than living in a
// footer, and the install command and a real request sit above everything
// else. Half the people arriving here came from a search result and are
// already inside a specific question.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { CodeBlock } from "@/components/ui/code-block";
import { CurlExample } from "@/components/ui/curl-example";
import { Faq } from "@/components/ui/faq";
import { FeatureGrid } from "@/components/ui/feature-grid";
import { InstallCommand } from "@/components/ui/install-command";
import { LogoCloud } from "@/components/ui/logo-cloud";
import { SdkTabs } from "@/components/ui/sdk-tabs";
import { SectionHeader } from "@/components/ui/section-header";
import { SideNav } from "@/components/ui/side-nav";
import { StatsBand } from "@/components/ui/stats-band";
export const Route = createFileRoute("/")({ component: P });
export const DOCS = [
  {
    title: "Start here",
    items: [
      { label: "What Ferrule does", href: "#what" },
      { label: "Install", href: "#install" },
      { label: "Send your first webhook", href: "#first" },
      { label: "Verify a signature", href: "#verify" },
    ],
  },
  {
    title: "Delivery",
    items: [
      { label: "Retries and backoff", href: "#retries" },
      { label: "Ordering", href: "#ordering" },
      { label: "The dead letter queue", href: "#dlq" },
      { label: "Replaying an event", href: "#replay" },
    ],
  },
  {
    title: "Reference",
    items: [
      { label: "POST /v1/events", href: "#post-events" },
      { label: "GET /v1/deliveries", href: "#get-deliveries" },
      { label: "Signature format", href: "#sig-format" },
      { label: "Errors", href: "#errors" },
      { label: "Rate limits", href: "#limits" },
    ],
  },
];
const SEND = `import { Ferrule } from "ferrule";

const ferrule = new Ferrule(process.env.FERRULE_KEY!);

await ferrule.send({
  endpoint: "ep_8Kq2",              // your customer's URL, registered once
  type: "invoice.paid",
  data: { invoice: "in_4471", amount: 2400, currency: "gbp" },
});
// -> { id: "ev_9Fj3", status: "queued", attempts: 0 }`;
const SEND_PY = `from ferrule import Ferrule

ferrule = Ferrule(os.environ["FERRULE_KEY"])

ferrule.send(
    endpoint="ep_8Kq2",           # your customer's URL, registered once
    type="invoice.paid",
    data={"invoice": "in_4471", "amount": 2400, "currency": "gbp"},
)
# -> {"id": "ev_9Fj3", "status": "queued", "attempts": 0}`;
const SEND_GO = `client := ferrule.New(os.Getenv("FERRULE_KEY"))

ev, err := client.Send(ctx, ferrule.Event{
    Endpoint: "ep_8Kq2",           // your customer's URL, registered once
    Type:     "invoice.paid",
    Data:     map[string]any{"invoice": "in_4471", "amount": 2400},
})
// ev.ID == "ev_9Fj3", ev.Status == "queued"`;
const SEND_RB = `ferrule = Ferrule.new(ENV["FERRULE_KEY"])

ferrule.send(
  endpoint: "ep_8Kq2",             # your customer's URL, registered once
  type: "invoice.paid",
  data: { invoice: "in_4471", amount: 2400, currency: "gbp" }
)
# => { id: "ev_9Fj3", status: "queued", attempts: 0 }`;
const VERIFY = `// On your customer's server. This is the whole of it.
import { verify } from "ferrule/verify";

app.post("/hooks", express.raw({ type: "*/*" }), (req, res) => {
  const event = verify(req.body, req.headers["ferrule-signature"], SECRET);
  //           ^ throws on a bad signature or a timestamp older than 5 minutes

  handle(event);      // your code
  res.sendStatus(200); // anything 2xx stops the retries
});`;
function P() {
  const [lang, setLang] = useState("ts");
  return (
    <SiteChrome name="Ferrule" tagline="Outbound webhooks with retries, signatures and a replay button."
      links={[{ label: "Pricing", href: "#/pricing" }, { label: "Support", href: "#/support" }]}
      action={{ label: "Get a key", href: "#install" }}>

      {/* THE DOCS NAV IS PART OF THE PAGE, not a link to a separate site. A
          developer evaluating this reads the reference and the marketing in the
          same pass, and making them two destinations means the reference wins
          and the reasons never get read. */}
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-10 lg:grid-cols-[220px_1fr]">
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <SideNav sections={DOCS} active="#what" />
          <div className="mt-6 rounded-lg border border-border p-4">
            <p className="text-sm font-medium">v3.2.0</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              No breaking change since v2 in March 2024. v1 keys still work and always will.
            </p>
          </div>
        </aside>

        <div>
          <section id="what">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Webhook delivery · self-serve · no sales call
            </p>
            <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-balance">
              You send us the event. We deal with the customer whose endpoint has been down since Tuesday.
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              Signing, retries with backoff, a dead letter queue, and a replay button your support
              team can press without deploying anything. Roughly the four hundred lines everybody
              writes badly once and then maintains forever.
            </p>

            {/* INSTALL FIRST. The whole reason this variant exists: the fastest
                honest answer to "is this any good" is having it running. */}
            <div id="install" className="mt-8 max-w-2xl">
              <InstallCommand pkg="ferrule" />
            </div>

            <div id="first" className="mt-8">
              <p className="text-sm font-medium">Send one</p>
              <div className="mt-3">
                <SdkTabs value={lang} onChange={setLang} samples={[
                  { key: "ts", label: "TypeScript", lang: "ts", code: SEND },
                  { key: "py", label: "Python", lang: "python", code: SEND_PY },
                  { key: "go", label: "Go", lang: "go", code: SEND_GO },
                  { key: "rb", label: "Ruby", lang: "ruby", code: SEND_RB },
                ]} />
              </div>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                That returns in about 4ms because it queues rather than delivers. Your request path
                never waits on somebody else's server, which is the failure that made you look for
                this.
              </p>
            </div>

            <div className="mt-8">
              <p className="text-sm font-medium">Or without an SDK at all</p>
              <div className="mt-3 max-w-3xl">
                <CurlExample method="POST" url="https://api.ferrule.dev/v1/events"
                  headers={{ Authorization: "Bearer fr_live_8c41d0a9b2", "Content-Type": "application/json" }}
                  body={'{"endpoint":"ep_8Kq2","type":"invoice.paid","data":{"invoice":"in_4471"}}'}
                  secrets={["fr_live_8c41d0a9b2"]} />
              </div>
            </div>
          </section>

          <section id="verify" className="mt-14 border-t border-border pt-10">
            <SectionHeader eyebrow="The other end" title="What your customer writes"
              description="Six lines, and the signature check is one of them. This is the part people get wrong — a comparison that is not constant-time, a body that has already been JSON-parsed and re-serialised, or no timestamp check at all, which makes a captured request replayable forever." />
            <div className="mt-6 max-w-3xl">
              <CodeBlock language="ts" code={VERIFY} />
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">The raw body matters.</span> Verifying a
              re-serialised object fails intermittently and inexplicably, because key order and
              whitespace change under you. The SDK takes bytes for that reason and the docs say so
              in a box this size.
            </p>
          </section>

          <section id="retries" className="mt-14 border-t border-border pt-10">
            <SectionHeader eyebrow="Delivery" title="What happens when their server is down" />
            <StatsBand className="mt-6" items={[
              { value: "16", label: "Attempts over 5 days" },
              { value: "4ms", label: "Median time for send() to return" },
              { value: "99.99%", label: "Delivered within a day, last quarter" },
              { value: "30 days", label: "Events kept and replayable" },
            ]} />
            <div className="mt-8">
              <FeatureGrid items={[
                { title: "Exponential backoff, jittered", description: "10s, 30s, 2m, 10m, 30m, 1h, then hourly to 5 days. Jitter matters: without it every one of your customers' events hits their recovering server in the same second and knocks it back over." },
                { title: "Ordered per endpoint, optional", description: "Off by default because it costs latency and most events do not need it. On, an endpoint's events queue behind each other so invoice.paid never lands before invoice.created." },
                { title: "A dead letter queue you can read", description: "After 16 attempts an event moves to the DLQ with every response body kept. Not a metric that went up — the actual 502 page their load balancer returned." },
                { title: "Replay, by event or by endpoint", description: "One event, or everything that failed for one customer between two timestamps. Support presses it. Nobody deploys anything." },
                { title: "Signatures with key rotation", description: "Two secrets valid at once, so a customer can roll theirs without a window where deliveries fail. The header carries both signatures during the overlap." },
                { title: "Your customer gets a page", description: "A hosted endpoint dashboard on your domain — their deliveries, their failures, their replay button. It is the support ticket that never gets opened." },
              ]} />
            </div>
          </section>

          <section id="ordering" className="mt-14 border-t border-border pt-10">
            <SectionHeader eyebrow="Used by" title="Mostly by people who wrote this themselves first" />
            <div className="mt-6">
              <LogoCloud items={[
                { name: "Sett" }, { name: "Kilnwork" }, { name: "Bramble Pay" },
                { name: "Tetherfield" }, { name: "Ninebarrow" }, { name: "Applegarth" },
              ]} />
            </div>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Nine of the twelve companies on our largest plan migrated from something they had
              built in-house. It works — it always works — until the day somebody has to explain to
              a customer why an event from three weeks ago cannot be re-sent.
            </p>
          </section>

          <section id="errors" className="mt-14 border-t border-border pt-10">
            <div className="max-w-3xl">
              <SectionHeader eyebrow="Asked often" title="Before you have to email anybody" />
              <Faq className="mt-6" items={[
                { question: "What counts as a successful delivery?", answer: "Any 2xx within 30 seconds. A 3xx is not followed — a redirect on a webhook endpoint is almost always a misconfiguration and following it quietly delivers your customer's data somewhere they did not choose." },
                { question: "What if my customer returns 200 but crashes?", answer: "We have delivered it and we will not retry, which is correct: only they know whether their handler finished. Return the 200 after the work, or write the event down and return immediately — the second is what we recommend and the docs show it." },
                { question: "Do you guarantee ordering?", answer: "Per endpoint, if you turn it on. Not globally, and anybody who tells you they do globally at this price is describing a queue with one consumer." },
                { question: "At-least-once or exactly-once?", answer: "At-least-once, and there is no such thing as the other one over HTTP. Every event carries a stable id and the docs tell your customer to key on it. A retry after a timeout they actually processed is the common case, not the exotic one." },
                { question: "Can I self-host it?", answer: "No, and we are not going to pretend it is on the roadmap. The value here is that somebody else is awake when a retry queue backs up at three in the morning." },
                { question: "What happens if Ferrule goes down?", answer: "send() fails and you get the error. The SDK does not swallow it and does not silently drop the event — you decide whether to write it to your own outbox and re-send. Our status page and last twelve months are on the support page." },
              ]} />
            </div>
          </section>
        </div>
      </div>
    </SiteChrome>
  );
}
