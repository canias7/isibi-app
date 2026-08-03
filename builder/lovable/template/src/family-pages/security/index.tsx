// security — RESPONSE-FIRST: how fast somebody actually attends, in writing,
// ahead of any equipment specification.
//
// EVERY SECURITY COMPANY SELLS CAMERAS AND THE CUSTOMER IS BUYING A RESPONSE.
// A 4K camera that nobody watches and nobody attends is a recording device, and
// the difference between that and a monitored system is entirely about who
// turns up and how quickly. So the contractual figure and last quarter's actual
// go first, together — a promise with no measurement beside it is marketing.
//
// AND FALSE ALARMS ARE ADDRESSED OPENLY. They are the real running cost of a
// system, they are what loses police response, and nobody advertises them.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { SlaClock } from "@/components/ui/sla-clock";
import { AlarmState } from "@/components/ui/alarm-state";
import { PriceList } from "@/components/ui/price-list";
import { MediaGrid } from "@/components/ui/media-grid";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/")({ component: P });

const PRICES = [
  { name: "Intruder alarm, 3-bed house", description: "Grade 2, dual-path signalling, fitted in a day", price: 890 },
  { name: "Monitoring and keyholding", description: "Receiving centre, our response, 45-minute commitment", price: 34, meta: "a month" },
  { name: "Monitoring only", description: "Receiving centre rings your keyholders. No attendance", price: 19, meta: "a month" },
  { name: "CCTV, four cameras", description: "Recorded locally, remote view, 31 days retention", price: 1450 },
  { name: "Annual service", description: "Mandatory for police response. One visit, all devices", price: 145, meta: "a year" },
  { name: "Call-out, in hours", description: "Fault or a battery. Under the maintenance contract it is free", price: 0, meta: "included" },
  { name: "Call-out, out of hours, not a fault", description: "A door left open, a pet in the wrong room", price: 85 },
];

function P() {
  return (
    <SiteChrome
      name="Attercliffe Security"
      tagline="Alarms, cameras and keyholding across South Yorkshire. SSAIB approved, NSI Gold."
      links={[
        { label: "Systems", href: "#/systems" },
        { label: "Monitoring", href: "#/monitoring" },
        { label: "Questions", href: "#questions" },
      ]}
      action={{ label: "Book a survey", href: "#survey" }}
    >
      <section className="border-b border-border">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            SSAIB approved · NSI Gold · Police URN held since 2004
          </p>
          <h1 className="mt-3 max-w-3xl text-5xl font-semibold tracking-tight text-balance">
            45 minutes, contractually. 38 last quarter.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            That is the number this whole business is. A camera nobody watches and nobody attends is
            a recording device — useful afterwards and no use at all at the time. What you are
            actually buying is somebody arriving.
          </p>

          <div className="mt-10 grid gap-8 md:grid-cols-[1.1fr_1fr]">
            <div>
              <SlaClock
                target="45 minutes to attend, from the receiving centre's call"
                remaining="38 minutes average, quarter to June"
              />
              {/* A STAT LABEL IS A LABEL, NOT A SENTENCE. These three sit in
                  the narrow half of a two-column row, so each tile is about
                  150px — and "Worst single attendance. It was snow on the
                  A616" wrapped to four lines in it. The measure pass caught
                  it; the fix is the writing rather than the grid, because the
                  anecdote was never label text. It reads better underneath
                  anyway. */}
              <div className="mt-6 grid gap-6 sm:grid-cols-3">
                <div>
                  <p className="text-3xl font-semibold tabular-nums">38 min</p>
                  <p className="mt-1 text-sm text-muted-foreground">Average, last quarter</p>
                </div>
                <div>
                  <p className="text-3xl font-semibold tabular-nums">96%</p>
                  <p className="mt-1 text-sm text-muted-foreground">Inside 45 minutes</p>
                </div>
                <div>
                  <p className="text-3xl font-semibold tabular-nums">2h 11m</p>
                  <p className="mt-1 text-sm text-muted-foreground">Worst single call</p>
                </div>
              </div>
              <p className="mt-5 max-w-lg text-sm leading-relaxed text-muted-foreground">
                The worst one was snow on the A616 in January, and it is published for the same
                reason the average is: a company showing only its mean is showing you the half of
                the distribution that flatters it.
              </p>
            </div>
            <div>
              <AlarmState
                mode="part-set"
                area="Ground floor and garage"
                blockingZones={["Kitchen window — contact open", "Landing PIR — pet mode active"]}
                lastSetBy="Chandran, D."
                lastSetAt="22:40"
                faultNote="The kitchen window is the commonest reason a system will not set, and the panel says so in words rather than beeping."
              />
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <a className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" href="#survey">
              Book a free survey
            </a>
            <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="#/monitoring">
              What monitoring actually means
            </a>
          </div>
        </div>
      </section>

      {/* THE ONE PICTURE THIS TRADE NEVER PUBLISHES: WHAT THE CAMERA ACTUALLY
          SEES AT NIGHT. Every security company shows a product shot of a
          camera, which tells a customer nothing — the question is whether the
          footage would identify anybody at two in the morning in the rain, and
          most systems sold on "4K" would not. Showing a real still at a real
          hour is the same discipline as printing the attendance figure. */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <MediaGrid
            columns={3}
            ratio="16/9"
            items={[
              { src: null, alt: "A yard at 02:10, camera still, a figure recognisable at fifteen metres", caption: "02:10, no floodlight. A face at 15m — this is the test that matters." },
              { src: null, alt: "The same yard from a cheaper camera, the figure a grey smear", caption: "The same yard, a £90 camera. Also '4K'. Useless to the police." },
              { src: null, alt: "The monitoring room, four operators, walls of screens", caption: "Monitored here in Attercliffe, not offshore. Two operators overnight." },
            ]}
          />
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <SectionHeader
            eyebrow="What happens on an activation"
            title="Four minutes to the phone, forty-five to the door"
            description="Written out because 'monitored 24/7' means nothing and is on every competitor's home page."
          />
          <ol className="mt-8 divide-y divide-border border-y border-border">
            <li className="flex gap-5 py-5">
              <span className="w-6 shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">1</span>
              <div><p className="font-medium">The panel signals, over two paths</p><p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">Broadband and mobile. Cutting the phone line does nothing and has not worked since about 2008.</p></div>
            </li>
            <li className="flex gap-5 py-5">
              <span className="w-6 shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">2</span>
              <div><p className="font-medium">The receiving centre verifies it</p><p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">Two detectors, or audio, or a camera. This is the step that decides whether the police attend at all, and it takes about two minutes.</p></div>
            </li>
            <li className="flex gap-5 py-5">
              <span className="w-6 shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">3</span>
              <div><p className="font-medium">You are rung, then we are dispatched</p><p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">Your keyholders first, in the order you set. If nobody answers within four minutes we go regardless rather than keep ringing.</p></div>
            </li>
            <li className="flex gap-5 py-5">
              <span className="w-6 shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">4</span>
              <div><p className="font-medium">We attend, secure, and write it up</p><p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">Including boarding a broken door at our cost. A written report with times reaches you by morning whatever the outcome.</p></div>
            </li>
          </ol>
        </div>
      </section>

      <section className="border-b border-border" id="survey">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <div className="grid items-start gap-10 lg:grid-cols-[1fr_1fr]">
            <div>
              <SectionHeader
                eyebrow="Prices"
                title="Seven lines, and the survey is free"
                description="Ninety minutes, no obligation, and about one survey in eight ends with us saying a system is not what you need. Better locks and a light are sometimes the honest answer."
              />
              <p className="mt-5 max-w-lg text-sm leading-relaxed text-muted-foreground">
                Monitoring is a monthly contract and it is twelve months, then rolling monthly. We
                do not do five-year agreements — they exist to make the installation look cheap and
                they are the reason this trade has the reputation it does.
              </p>
            </div>
            <PriceList items={PRICES} />
          </div>
        </div>
      </section>

      <section id="questions">
        <div className="mx-auto max-w-3xl px-6 py-14">
          <SectionHeader title="What people ask on the survey" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "Will the police come?",
                  answer:
                    "To a confirmed activation on a system with a police URN, yes, as a priority. Unconfirmed, no. That is national policy and it is why the verification step matters more than the hardware.",
                },
                {
                  question: "What if I set it off myself?",
                  answer:
                    "Ring the centre with your password and it is cancelled, no charge. It happens to everybody and there is no penalty until it becomes frequent — see the monitoring page for the honest version of that.",
                },
                {
                  question: "Do I have to have monitoring?",
                  answer:
                    "No. A bells-only system is a real option and it is about a third of what we fit. It will not get a police response and it will not get anybody attending, and we would rather sell you that than a contract you resent.",
                },
                {
                  question: "Can you take over an existing system?",
                  answer:
                    "Usually — most panels are compatible and it is £120 to reconfigure and take on the maintenance. It is far cheaper than replacing hardware that works and several companies will tell you otherwise.",
                },
              ]}
            />
          </div>
        </div>
      </section>
    </SiteChrome>
  );
}
