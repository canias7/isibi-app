// security /systems — what each thing DOES AND DOES NOT DO.
//
// A CAMERA DOES NOT PREVENT A BURGLARY. It records one. That distinction is the
// single most oversold thing in this industry and stating it plainly on the
// systems page is the difference between a customer who is satisfied and one
// who feels lied to the first time something happens.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { AlarmState } from "@/components/ui/alarm-state";
import { PriceList } from "@/components/ui/price-list";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/systems")({ component: P });

const KIT = [
  {
    what: "Intruder alarm, Grade 2",
    does: "Detects entry and signals a receiving centre over two paths. With verification it gets a police response.",
    doesnt: "It does not stop anybody coming in. It shortens how long they stay, which is most of what reduces loss.",
  },
  {
    what: "External sounder and strobe",
    does: "Tells the street and shortens the visit. The single cheapest deterrent per pound spent.",
    doesnt: "Nobody rings the police because a bell is going. That stopped being true about thirty years ago.",
  },
  {
    what: "CCTV, recorded locally",
    does: "Gives you evidence, a timeline, and something the police can actually use if the resolution is right.",
    doesnt: "It does not prevent anything and nobody is watching it live. A recording device, honestly described.",
  },
  {
    what: "CCTV with monitored analytics",
    does: "A person at the centre gets an alert on a line crossed and can talk through a speaker. This does prevent things.",
    doesnt: "It is £180 a month and it is for a yard or a site, not a semi. We will say so rather than sell it.",
  },
  {
    what: "Smart doorbell",
    does: "Tells you somebody is there and records them. Genuinely useful and very cheap.",
    doesnt: "It is not a security system, it will not signal anybody, and fitting one does not reduce your insurance.",
  },
  {
    what: "Access control, fobs or codes",
    does: "Controls who goes where and logs it. For a business with staff turnover it pays for itself in re-keying alone.",
    doesnt: "It is not an alarm. The two are separate systems and anybody bundling them is bundling the price.",
  },
];

const PRICES = [
  { name: "Intruder alarm, 3-bed house, Grade 2", description: "Panel, two PIRs, two contacts, sounder, dual-path signalling", price: 890 },
  { name: "Each additional detector", description: "PIR, contact or shock sensor", price: 65 },
  { name: "Pet-tolerant PIR", description: "Up to about 25kg. Worth having rather than leaving a room unprotected", price: 85 },
  { name: "CCTV, four cameras, 31 days", description: "4MP, recorded locally, remote view included", price: 1450 },
  { name: "CCTV, eight cameras", description: "Same specification", price: 2200 },
  { name: "Access control, single door", description: "Fob reader, controller, 50 fobs", price: 740 },
  { name: "Taking over an existing system", description: "Reconfigure, re-code, and take on the maintenance", price: 120 },
];

function P() {
  return (
    <SiteChrome
      name="Attercliffe Security"
      tagline="What each thing does, and what it does not."
      links={[
        { label: "Response", href: "#/" },
        { label: "Monitoring", href: "#/monitoring" },
      ]}
      action={{ label: "Book a survey", href: "#/" }}
    >
      <div className="mx-auto max-w-5xl px-6 py-14">
        <h1 className="text-4xl font-semibold tracking-tight text-balance">Systems</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Six things, each with what it does and what it does not. A camera does not prevent a
          burglary — it records one — and that sentence is the most oversold distinction in this
          trade.
        </p>

        <section className="mt-12">
          <SectionHeader eyebrow="The kit" title="Six things, honestly described" />
          <ul className="mt-8 divide-y divide-border border-y border-border">
            {KIT.map((k) => (
              <li key={k.what} className="py-5">
                <p className="font-medium">{k.what}</p>
                <div className="mt-2 grid gap-2 md:grid-cols-2 md:gap-8">
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    <span className="font-medium text-foreground">Does. </span>{k.does}
                  </p>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    <span className="font-medium text-foreground">Does not. </span>{k.doesnt}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-14">
          <div className="grid items-start gap-10 lg:grid-cols-[1fr_1fr]">
            <div>
              <SectionHeader
                eyebrow="Living with it"
                title="A panel that says what is wrong in words"
                description="The commonest complaint about alarms is not being able to set one. Everything we fit tells you which zone is open rather than beeping at you."
              />
              <p className="mt-5 max-w-lg text-sm leading-relaxed text-muted-foreground">
                Part-setting matters more than people expect. Downstairs armed and upstairs not is
                how most households actually use an alarm at night, and a system that makes that
                awkward is a system that gets left off.
              </p>
            </div>
            <AlarmState
              mode="fault"
              area="Whole house"
              blockingZones={["Back door contact — will not close", "Garage PIR — low battery, 11 days"]}
              faultNote="It will still set with these isolated, and it says so. A panel that simply refuses and beeps is why people give up on alarms."
              lastSetBy="Chandran, D."
              lastSetAt="07:15"
            />
          </div>
        </section>

        <section className="mt-14">
          <div className="grid items-start gap-10 lg:grid-cols-[1fr_1fr]">
            <div>
              <SectionHeader
                eyebrow="Prices"
                title="Fitted, tested and certificated"
                description="No finance, no five-year tie-in, and the equipment is yours from day one. Several national companies lease you the hardware and that is why leaving them is so expensive."
              />
              <p className="mt-5 max-w-lg text-sm leading-relaxed text-muted-foreground">
                The annual service is £145 and it is not optional if you want a police response —
                that is the SSAIB requirement rather than ours, and a system without one loses its
                URN after two missed years.
              </p>
            </div>
            <PriceList items={PRICES} />
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader title="System questions" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "Will an alarm reduce my insurance?",
                  answer:
                    "Sometimes, by 5 to 10%, and only a professionally installed and maintained one with a certificate. A DIY system reduces nothing. Ask your insurer before assuming it pays for itself.",
                },
                {
                  question: "What about pets?",
                  answer:
                    "Pet-tolerant detectors up to about 25kg, mounted high. A large dog with free run of the house genuinely limits what can be protected and we will tell you which rooms rather than fit something that will false-alarm nightly.",
                },
                {
                  question: "Is a wireless system as good?",
                  answer:
                    "For a house, yes, and it is what we fit in nine out of ten. Batteries last three to five years and the panel warns you weeks ahead. Wired is better for a commercial site and worse for anybody's decor.",
                },
                {
                  question: "Can I self-monitor with an app?",
                  answer:
                    "Yes, and about a third of our customers do. It costs £6 a month rather than £34. What it does not get you is a police response or anybody attending, which is the entire difference.",
                },
              ]}
            />
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            <a className="underline underline-offset-4" href="#/">The response time</a>
            {" · "}
            <a className="underline underline-offset-4" href="#/monitoring">Monitoring and false alarms</a>
          </p>
        </section>
      </div>
    </SiteChrome>
  );
}
