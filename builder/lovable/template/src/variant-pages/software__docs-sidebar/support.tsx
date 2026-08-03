// software/docs-sidebar /support — the family's role for this page is "help
// that actually helps: the common fixes, then a human". For a developer tool
// the common fixes are ERROR CODES, and somebody arriving here has one in their
// terminal right now. So the page is ordered by what they can paste: the four
// errors people actually hit, each with the cause and the fix, then the status
// page, then a person.
//
// The status strip is high rather than buried, because "is it me or is it you"
// is the first question and answering it wrongly costs an hour.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { ChangelogEntry } from "@/components/ui/changelog-entry";
import { CodeBlock } from "@/components/ui/code-block";
import { ContactCard } from "@/components/ui/contact-card";
import { Faq } from "@/components/ui/faq";
import { SectionHeader } from "@/components/ui/section-header";
import { SideNav } from "@/components/ui/side-nav";
import { StatusPageLink } from "@/components/ui/status-page-link";
import { UptimeStrip, type UptimeDay } from "@/components/ui/uptime-strip";
import { DOCS } from "./index";
export const Route = createFileRoute("/support")({ component: P });
const DAYS: UptimeDay[] = Array.from({ length: 90 }, (_, i) => {
  const d = new Date(Date.UTC(2026, 4, 6));
  d.setUTCDate(d.getUTCDate() + i);
  const date = d.toISOString().slice(0, 10);
  if (i === 47) return { date, state: "partial", note: "Delivery latency to eu-west up to 90s for 34 minutes. No events lost." };
  if (i === 71) return { date, state: "partial", note: "API 429s on a hot path for 11 minutes during a deploy." };
  return { date, state: "up" };
});
const ERRORS: { code: string; title: string; cause: string; fix: string; sample?: string }[] = [
  {
    code: "signature_mismatch",
    title: "Their handler rejects every delivery",
    cause: "Almost always the body. A framework parsed the JSON, your code re-serialised it, and the bytes we signed are not the bytes being verified — key order and whitespace change under you, so it fails inconsistently rather than always, which is why it takes so long to find.",
    fix: "Verify against the RAW body. In Express that means express.raw() on the webhook route only, before any json() middleware.",
    sample: `// Wrong — express.json() has already eaten it
app.use(express.json());
app.post("/hooks", (req, res) => verify(JSON.stringify(req.body), sig, SECRET));

// Right — raw bytes, on this route only
app.post("/hooks", express.raw({ type: "*/*" }), (req, res) =>
  verify(req.body, req.headers["ferrule-signature"], SECRET));`,
  },
  {
    code: "timestamp_too_old",
    title: "Signature verifies in tests and fails in production",
    cause: "The signature carries a timestamp and we refuse anything more than five minutes old, which stops a captured request being replayable forever. In production your handler is usually behind a queue, and the event is verified long after it arrived.",
    fix: "Verify at the edge, the moment the request lands, then queue the verified event. Do not carry the raw request and its header through a job system and verify at the far end.",
  },
  {
    code: "endpoint_unreachable",
    title: "Everything to one customer is in the dead letter queue",
    cause: "Their server, nine times in ten — a certificate that expired, a firewall rule, or a redirect we do not follow. The DLQ keeps the actual response, so you can see which.",
    fix: "Read the stored response body on the failed delivery, send them that sentence, and replay the range once they have fixed it.",
    sample: `curl https://api.ferrule.dev/v1/deliveries?endpoint=ep_8Kq2&status=failed \\
  -H "Authorization: Bearer $FERRULE_KEY"

# then, once they have fixed it
curl -X POST https://api.ferrule.dev/v1/replay \\
  -H "Authorization: Bearer $FERRULE_KEY" \\
  -d '{"endpoint":"ep_8Kq2","from":"2026-07-28T00:00:00Z"}'`,
  },
  {
    code: "duplicate_delivery",
    title: "Your customer says they got the same event twice",
    cause: "They returned a 200 that we never received — a timeout on the way back, or their proxy dropped it. We retried something they had already processed. This is at-least-once behaving exactly as documented, not a fault.",
    fix: "Tell them to key on event.id, which is stable across every attempt. It is two lines and it is the correct fix; there is no configuration on our side that makes this go away, because nothing over HTTP can.",
  },
];
function P() {
  return (
    <SiteChrome name="Ferrule" tagline="Outbound webhooks with retries, signatures and a replay button."
      links={[{ label: "Docs", href: "#/" }, { label: "Pricing", href: "#/pricing" }]}
      action={{ label: "Get a key", href: "#/" }}>

      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-10 lg:grid-cols-[220px_1fr]">
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <SideNav sections={DOCS} />
          <div className="mt-6 rounded-lg border border-border p-4">
            <p className="text-sm font-medium">Email gets a person</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              There are four of us and we all answer it. No tier-one, no bot, no ticket number.
            </p>
          </div>
        </aside>

        <div>
          <SectionHeader eyebrow="Support" title="Is it us, and then: it is probably one of these four"
            description="In that order, because the first hour of a webhook problem is usually spent proving whose fault it is." />

          <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.1fr]">
            <div>
              <StatusPageLink url="https://status.ferrule.dev" state="ok"
                headline="All systems operating normally"
                subscribeUrl="https://status.ferrule.dev/subscribe" />
            </div>
            <div>
              <UptimeStrip days={DAYS} percent={99.982} label="API and delivery, 90 days" />
            </div>
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Two partial days in ninety and both are written up on the status page with what changed
            afterwards. Neither lost an event — a delivery that is late is still a delivery, which
            is most of the reason to queue rather than forward.
          </p>

          {/* THE ERRORS, ORDERED BY HOW OFTEN THEY ARRIVE. Somebody reading
              this has one in a terminal. Two of the four are their customer's
              fault and we say so plainly rather than making them find out. */}
          <section className="mt-14 border-t border-border pt-10">
            <SectionHeader eyebrow="The four" title="Ordered by how often they land in the inbox" />
            <div className="mt-6 space-y-6">
              {ERRORS.map((e) => (
                <div key={e.code} className="rounded-lg border border-border p-6">
                  <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                    <code className="rounded bg-muted px-2 py-0.5 font-mono text-sm">{e.code}</code>
                    <h3 className="text-lg font-semibold tracking-tight">{e.title}</h3>
                  </div>
                  <dl className="mt-4 space-y-3 text-sm leading-relaxed">
                    <div>
                      <dt className="font-medium">What is happening</dt>
                      <dd className="mt-1 max-w-2xl text-muted-foreground">{e.cause}</dd>
                    </div>
                    <div>
                      <dt className="font-medium">What fixes it</dt>
                      <dd className="mt-1 max-w-2xl text-muted-foreground">{e.fix}</dd>
                    </div>
                  </dl>
                  {e.sample ? (
                    <div className="mt-4 max-w-2xl">
                      <CodeBlock language={e.code === "endpoint_unreachable" ? "bash" : "ts"} code={e.sample} />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </section>

          <section className="mt-14 border-t border-border pt-10">
            <div className="grid gap-10 lg:grid-cols-[1.15fr_1fr]">
              <div>
                <SectionHeader eyebrow="Recently" title="What changed, and whether it can break you" />
                <div className="mt-6 space-y-5">
                  <ChangelogEntry version="3.2.0" date="2026-07-29" tag="new">
                    Bulk replay now takes a time range as well as an endpoint. The old single-event
                    form is unchanged and is not going anywhere.
                  </ChangelogEntry>
                  <ChangelogEntry version="3.1.4" date="2026-07-11" tag="fixed">
                    Retry-After was being sent as a date on 429s from one region and as seconds from
                    the others. Both are legal and the inconsistency was not. Seconds everywhere now.
                  </ChangelogEntry>
                  <ChangelogEntry version="3.1.0" date="2026-06-02" tag="changed">
                    Jitter added to the backoff schedule. If you were relying on attempt times being
                    exactly 10s/30s/2m — some people were, for tests — they now vary by up to 20%.
                  </ChangelogEntry>
                  <ChangelogEntry version="3.0.0" date="2026-03-18" tag="new">
                    Ordered delivery per endpoint, opt-in. No breaking change: v2 keys and v2 SDKs
                    keep working and we have not set a date to stop them.
                  </ChangelogEntry>
                </div>
              </div>
              <div>
                <SectionHeader eyebrow="A person" title="Four of us, and we all read it" />
                <div className="mt-6">
                  <ContactCard email="hello@ferrule.dev" phone="+44 20 8144 7702"
                    address="Ferrule Ltd, 2 Bath Place, Bristol BS2 0DR" />
                </div>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                  Email is answered within a working day on Standard and usually within two hours.
                  The phone number is real and goes to a person, but email is genuinely better for
                  this — paste the event id and we can see the whole delivery history before we reply.
                </p>
                <div className="mt-6 rounded-lg border border-border bg-muted/50 p-5">
                  <p className="text-base font-medium">Send us the event id</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    <code className="font-mono">ev_9Fj3…</code> tells us the endpoint, every attempt,
                    every response body and the signature we sent. Without it the first reply is
                    always a request for it, and that is a day lost.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-14 border-t border-border pt-10">
            <div className="max-w-3xl">
              <SectionHeader eyebrow="Asked often" title="The rest" />
              <Faq className="mt-6" items={[
                { question: "Can you see my customer's server?", answer: "Only what it returns to us, which is stored on every failed delivery — status, headers and up to 8KB of body. That is usually enough to tell them what is wrong in one sentence." },
                { question: "Will you contact my customer directly?", answer: "No, never, and no exception. They are your customer and an email from a supplier they have never heard of is a support problem you did not have." },
                { question: "Do you have a Slack community?", answer: "No. Four people cannot staff one honestly and an unstaffed community is a room where questions go unanswered in public. Email gets a person the same day." },
                { question: "How do I report a security issue?", answer: "security@ferrule.dev, PGP key on the well-known path. Acknowledged within 24 hours including weekends, and we will tell you what we are doing rather than going quiet." },
                { question: "Is there a status API?", answer: "GET https://status.ferrule.dev/api/v1/summary, public, no key, no rate limit worth mentioning. Poll it from your own dashboard if that is useful." },
                { question: "What happens to my data if I stop paying?", answer: "The account drops to Free, retention drops to 7 days, and sending above 10,000 a month starts failing with 402. Nothing is deleted for 90 days and you can export throughout." },
              ]} />
            </div>
          </section>
        </div>
      </div>
    </SiteChrome>
  );
}
