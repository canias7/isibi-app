// coach-hire — ROUTE-AND-DATE-FIRST: the three questions that set the price,
// and nothing else above the fold.
//
// PHOTOGRAPHS OF THE FLEET DECIDE NOTHING. Every coach company site opens with
// a 53-seater on a sunny motorway, and the customer's actual question is "how
// many of us, where to, which day, how much". The three inputs are the hero.
//
// DRIVER HOURS ARE A LEGAL LIMIT, not a preference, and they are the reason a
// long day costs nearly double. Explaining that on the pricing page is the
// difference between a quote that looks greedy and one that makes sense.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { FareQuote } from "@/components/ui/fare-quote";
import { CapacityTable } from "@/components/ui/capacity-table";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/")({ component: P });

const INCLUDED = [
  "Driver, fuel, tolls and the driver's own subsistence",
  "PSV operator licence and £5m public liability",
  "Seat belts on every vehicle and a first-aid kit",
  "Reasonable waiting time at each pick-up",
];

function P() {
  return (
    <SiteChrome
      name="Hallam Coaches"
      tagline="16 to 53 seats, from Attercliffe. Family run since 1974."
      links={[
        { label: "The fleet", href: "#/fleet" },
        { label: "Get a quote", href: "#/quote" },
        { label: "Questions", href: "#questions" },
      ]}
      action={{ label: "Get a quote", href: "#/quote" }}
    >
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid items-start gap-12 lg:grid-cols-[1fr_1fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                PSV operator PB1024887 · DVSA earned recognition
              </p>
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">
                How many, where to, which day
              </h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                Those three answers set the price and nothing else does. There is a photograph of a
                coach further down this page and it will not help you decide anything.
              </p>
              <p className="mt-4 max-w-lg leading-relaxed text-muted-foreground">
                We quote a single figure with everything in it. No fuel surcharge, no driver
                gratuity line, no congestion charge added afterwards.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <a className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" href="#/quote">
                  Send the three answers
                </a>
                <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="#/fleet">
                  The fleet by seats
                </a>
              </div>
            </div>

            <FareQuote
              heading="Sheffield to Blackpool, 49 seats, a Saturday in September"
              fare={890}
              lines={[
                { label: "Vehicle and driver, 12 hours", value: 720 },
                { label: "Mileage, 178 miles return", value: 124 },
                { label: "Weekend uplift", value: 46 },
              ]}
              includes={INCLUDED}
            />
          </div>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <SectionHeader
            eyebrow="The fleet"
            title="Listed by seats, because that is the question"
            description="Luggage capacity matters more than people expect on an airport run, so it is here rather than in a brochure."
          />
          <div className="mt-8">
            <CapacityTable
              caption="Seats by configuration. A vehicle that cannot do a layout simply has no figure in that column."
              rooms={[
                {
                  name: "Mercedes Sprinter",
                  capacities: { Seated: 16, "With a wheelchair space": 12, "Airport, with cases": 14 },
                  size: "7.4m",
                  note: "Fits down a residential street and into most school gates. The one that goes to weddings.",
                },
                {
                  name: "Yutong midi",
                  capacities: { Seated: 33, "With a wheelchair space": 29, "Airport, with cases": 28 },
                  size: "9.9m",
                  note: "Underfloor lockers, so a full coach can still take hold luggage.",
                },
                {
                  name: "Volvo B11R",
                  capacities: { Seated: 49, "Airport, with cases": 44 },
                  size: "12.6m",
                  note: "Toilet, tables at the rear. Cannot get into Whirlow or up to Ringinglow — the lane is too tight.",
                },
                {
                  name: "Van Hool double-decker",
                  capacities: { Seated: 53, "Airport, with cases": 46 },
                  size: "13.9m",
                  note: "4.38m high. Height is the constraint that catches people, not length.",
                },
              ]}
            />
          </div>
          <a className="mt-6 inline-block text-sm underline underline-offset-4" href="#/fleet">
            Access, luggage and what each one cannot reach
          </a>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <SectionHeader
            eyebrow="Why a long day costs nearly double"
            title="Driver hours are the law, not our preference"
            description="A driver may work nine hours at the wheel and must break after four and a half. Past that it is a second driver, and it is not negotiable by anybody."
          />
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">Up to 10 hours away</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                One driver. Most day trips — Blackpool, York, Chester — sit comfortably inside this
                and it is the cheapest shape of job we do.
              </p>
            </div>
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">10 to 13 hours</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Still one driver, with a proper break written into the timings. We will tell you
                where it falls rather than surprise the group with it.
              </p>
            </div>
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">Beyond 13 hours</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Two drivers, or an overnight stay for one. This is where the price steps and it is
                the single most common surprise in a coach quote.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="questions">
        <div className="mx-auto max-w-3xl px-6 py-14">
          <SectionHeader title="What people ring to ask" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "Can we drink on board?",
                  answer:
                    "On a private hire, yes, unless it is a football-related journey — that is a criminal offence and we would lose our licence. No glass, and the driver's decision on the day is final.",
                },
                {
                  question: "Do you do school runs?",
                  answer: "Yes, and every driver on a schools contract holds an enhanced DBS check. We will send the certificates with the quote.",
                },
                {
                  question: "What if the group is late back?",
                  answer:
                    "Thirty minutes is absorbed without argument. Beyond that it is charged by the hour, and past the driver's legal limit we physically cannot wait — which is why the pick-up time matters more than it seems.",
                },
                {
                  question: "Is there wheelchair access?",
                  answer:
                    "The Sprinter and the midi both take one wheelchair with a tail lift, booked in advance. The full-size coaches do not, and we would rather say so than take the booking.",
                },
              ]}
            />
          </div>
        </div>
      </section>
    </SiteChrome>
  );
}
