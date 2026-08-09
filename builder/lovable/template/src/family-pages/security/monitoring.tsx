// security /monitoring — the receiving centre, police response levels, and the
// FALSE-ALARM POLICY.
//
// FALSE ALARMS ARE HOW A SYSTEM LOSES ITS POLICE RESPONSE, and nobody selling
// one mentions it. Two in twelve months and the URN is withdrawn; getting it
// back takes three months of clean running. A customer who learns that after
// the second one is a customer who was sold something and not told how it works.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { PatrolLog } from "@/components/ui/patrol-log";
import { IncidentReport } from "@/components/ui/incident-report";
import { SlaClock } from "@/components/ui/sla-clock";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/monitoring")({ component: P });

const CAUSES = [
  { what: "A window or door not properly closed", share: "About 40%", fix: "The panel names the zone. Read it rather than pressing set twice." },
  { what: "Pets, balloons and moving decorations", share: "About 20%", fix: "Pet-tolerant detectors, and take the helium balloons down. It is the commonest Christmas call-out we get." },
  { what: "Somebody in the house who forgot", share: "About 15%", fix: "Part-set at night, and give everyone their own code so the log says who." },
  { what: "Low batteries in a wireless detector", share: "About 10%", fix: "The panel warns weeks ahead. Ring us and it is free under the maintenance contract." },
  { what: "Spiders on a PIR lens", share: "About 8%", fix: "Genuinely. A wipe twice a year on the ground-floor detectors." },
  { what: "A real activation", share: "About 7%", fix: "Which is the whole point, and why the other 93% matters so much." },
];

function P() {
  return (
    <SiteChrome
      name="Attercliffe Security"
      tagline="The receiving centre, the police response, and how a system loses it."
      links={[
        { label: "Response", href: "/" },
        { label: "Systems", href: "/systems" },
      ]}
      action={{ label: "Book a survey", href: "/" }}
    >
      <div className="mx-auto max-w-5xl px-6 py-14">
        <h1 className="text-4xl font-semibold tracking-tight text-balance">Monitoring</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          What "monitored 24/7" actually means, what the police will and will not do, and the thing
          nobody selling an alarm tells you — that two false alarms in a year loses the police
          response entirely.
        </p>

        <section className="mt-12">
          <div className="grid items-start gap-10 lg:grid-cols-[1fr_1fr]">
            <div>
              <SectionHeader
                eyebrow="The commitment"
                title="45 minutes, and what happens inside it"
                description="From the receiving centre's call to a person at your door. Measured every time, published quarterly, and it is the only number that distinguishes one of these companies from another."
              />
              <p className="mt-5 max-w-lg text-sm leading-relaxed text-muted-foreground">
                The centre itself is NSI-approved and in Rotherham rather than offshore. Two
                minutes to verify, four minutes ringing your keyholders, then we go whether or not
                anybody answered.
              </p>
            </div>
            <SlaClock
              target="45 minutes to attend"
              remaining="38 minutes average, quarter to June — 96% inside the commitment"
            />
          </div>
        </section>

        {/* THE FALSE-ALARM POLICY, IN FULL. */}
        <section className="mt-14">
          <SectionHeader
            eyebrow="False alarms"
            title="Two in twelve months and the police stop coming"
            description="This is national policy, it applies to every alarm company in the country, and almost nobody selling you a system will say it out loud."
          />
          <div className="mt-8 max-w-3xl rounded-xl border-2 border-foreground p-6">
            <ul className="space-y-3 text-sm leading-relaxed text-muted-foreground">
              <li><span className="font-medium text-foreground">Two false calls in a rolling year</span> and the police withdraw the URN. Response goes to zero.</li>
              <li><span className="font-medium text-foreground">Getting it back</span> takes three months of clean running and a re-application. There is no way to appeal it.</li>
              <li><span className="font-medium text-foreground">A cancelled call does not count</span> — ring the centre with your password inside the window and it is not recorded against you.</li>
              <li><span className="font-medium text-foreground">We do not charge for them</span> and we will not. A company that bills for false alarms is a company whose customers stop reporting them.</li>
              <li><span className="font-medium text-foreground">We will ring you after the first</span> and go through what caused it. Nine times in ten it is one of the six things below.</li>
            </ul>
          </div>
          <ul className="mt-8 divide-y divide-border border-y border-border">
            {CAUSES.map((c) => (
              <li key={c.what} className="grid gap-1 py-4 md:grid-cols-[minmax(0,17rem)_minmax(0,7rem)_1fr] md:gap-6">
                <p className="font-medium">{c.what}</p>
                <p className="text-sm tabular-nums text-muted-foreground">{c.share}</p>
                <p className="text-sm text-muted-foreground">{c.fix}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-14">
          <SectionHeader
            eyebrow="Keyholding and patrols"
            title="What a visit actually records"
            description="Every attendance and every patrol is logged with a scan at each point, and the log goes to you rather than sitting in our system."
          />
          <div className="mt-8 max-w-3xl">
            <PatrolLog
              officer="R. Ellinthorpe"
              round="Neepsend industrial units — overnight"
              startedAt="23:40"
              checkpoints={[
                { id: "1", name: "Main gate", scannedAt: "23:42", observation: "Padlocked, chain sound. Two cars in the yard as expected." },
                { id: "2", name: "Unit 4 rear fire door", scannedAt: "23:51", sinceLast: 9 },
                { id: "3", name: "Unit 7 loading bay", scannedAt: "00:04", sinceLast: 13, observation: "Shutter down. Light out again — third night. Reported to the landlord." },
                { id: "4", name: "Perimeter, north fence", scannedAt: "00:19", sinceLast: 15, observation: "Panel bent at the Rutland Road end. Photographed, not new." },
                { id: "5", name: "Main gate, out", scannedAt: "00:31", sinceLast: 12 },
              ]}
            />
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader
            eyebrow="If something happens"
            title="The report you get by morning"
            description="Times, what was found, what we did, and the crime reference if there is one. It is what an insurer asks for and it goes to you unasked."
          />
          <div className="mt-8 max-w-3xl">
            <IncidentReport
              what="Rear fire door forced at Unit 7. Nothing appears taken; the door frame is damaged and the door will not close."
              happenedOn="Between 00:31 and 02:14, 6 August"
              discoveredOn="02:19, 6 August — activation received 02:14"
              where="Unit 7, Rutland Works, Neepsend"
              thirdPartyInvolved
              thirdPartyNote="Landlord notified at 02:40. Their maintenance contractor attended at 07:15."
              crimeReference="SY/2026/0806/44117"
              needsCrimeReference={false}
              emergencyWorkDone="Door boarded and screwed shut at 02:55 by our officer. No charge — boarding is included in the keyholding contract."
            />
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader title="Monitoring questions" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "Where is the receiving centre?",
                  answer:
                    "Rotherham, NSI-approved, and it is a real place you can visit. Ours is not offshore and the person answering knows where Bolsterstone is, which matters more than it sounds.",
                },
                {
                  question: "What if I lose my password?",
                  answer:
                    "The centre will not cancel without it — that is the point of it. They will ring your other keyholders and we will attend. Set a password everybody in the house can actually remember.",
                },
                {
                  question: "Can I cancel monitoring later?",
                  answer:
                    "Twelve months, then a month's notice, any time. The equipment is yours and stays working as a bells-only system. There is nothing to return and no exit fee.",
                },
                {
                  question: "Do you hold my keys?",
                  answer:
                    "In a graded safe at the Attercliffe office, coded rather than addressed, and logged in and out. You can ask for them back at an hour's notice and about a dozen people a year do.",
                },
              ]}
            />
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            <a className="underline underline-offset-4" href="/">The response time</a>
            {" · "}
            <a className="underline underline-offset-4" href="/systems">What each system does</a>
          </p>
        </section>
      </div>
    </SiteChrome>
  );
}
