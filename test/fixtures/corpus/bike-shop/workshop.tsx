// bike-shop /workshop — the services, what each includes, and the wait, with a
// worked service history so somebody can see what a looked-after bike looks
// like.
//
// WHAT A SERVICE INCLUDES IS NEVER PUBLISHED, so "basic" at one shop is a
// "full" at another and the customer cannot compare anything. Listing the
// actual operations is the whole difference.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { PriceList } from "@/components/ui/price-list";
import { AvailabilityGrid } from "@/components/ui/availability-grid";
import { ServiceHistory } from "@/components/ui/service-history";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/workshop")({ component: P });

const SERVICES = [
  { name: "Safety check", description: "20 minutes while you wait. Brakes, gears, wheels, headset, tyres, and an honest list of what needs doing", price: 0, meta: "free" },
  { name: "Basic service", description: "Gears indexed, brakes adjusted and bled if hydraulic, drivetrain degreased, bolts torqued, tyres and pads assessed", price: 55 },
  { name: "Full service", description: "All of the basic, plus every bearing stripped and repacked, all cables and outers replaced, both wheels trued and tensioned", price: 130 },
  { name: "Winter strip", description: "Full service plus the frame cleaned inside, a new chain and a wax treatment. Two days", price: 185 },
  { name: "Puncture", description: "While you wait unless we are mid-job", price: 12, meta: "plus tube" },
  { name: "Wheel build", description: "Hand-built, tensioned and stress-relieved properly. Two weeks", price: 90, meta: "plus parts" },
  { name: "Bike fit", description: "Ninety minutes with Jo, on your own bike. Worth more than any component", price: 85 },
  { name: "Boxing for travel", description: "Packed and a box supplied. 24 hours' notice", price: 45 },
];

const INCLUDED = [
  { s: "Basic", ops: ["Gears indexed front and rear", "Brakes adjusted; hydraulics bled if needed", "Drivetrain degreased and re-lubed", "All bolts checked to torque", "Wheels checked for true and tension", "Tyres, pads and chain measured and reported"] },
  { s: "Full — everything above, and", ops: ["Hubs, headset and bottom bracket stripped, cleaned and repacked", "All gear and brake cables and outers replaced", "Both wheels trued and tension-balanced", "Frame cleaned and inspected for cracks", "Freehub serviced"] },
];

function P() {
  return (
    <SiteChrome
      name="Neepsend Cycles"
      tagline="What a service actually includes, and how long the wait is."
      links={[
        { label: "Home", href: "/" },
        { label: "Bikes in stock", href: "/bikes" },
      ]}
      action={{ label: "Bikes in stock", href: "/bikes" }}
    >
      <div className="mx-auto max-w-5xl px-6 py-14">
        <h1 className="text-4xl font-semibold tracking-tight text-balance">The workshop</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Eleven days from dropping off to collecting at the moment. Four days in November, six
          weeks in March. A puncture or a snapped cable is done while you wait regardless.
        </p>

        <section className="mt-12">
          <SectionHeader eyebrow="Prices" title="Eight things" />
          <div className="mt-6 max-w-2xl">
            <PriceList items={SERVICES} />
          </div>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Parts on top, always quoted before we fit them. Nothing over £20 goes on a bike without
            a phone call, whatever it says on the job card.
          </p>
        </section>

        <section className="mt-14">
          <SectionHeader
            eyebrow="What is in each"
            title="Because 'basic' means something different in every shop"
            description="Published so you can compare us with anybody else. A basic here is a full at some places and half a basic at others."
          />
          <div className="mt-8 grid gap-8 md:grid-cols-2">
            {INCLUDED.map((g) => (
              <div key={g.s}>
                <p className="font-medium">{g.s}</p>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {g.ops.map((o) => (
                    <li key={o} className="flex gap-2">
                      <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-foreground" />
                      <span>{o}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader
            eyebrow="Book a drop-off"
            title="Monday 10 August"
            description="Drop off between these times. Most bikes go on the stand the following day and you get a text when it is ready."
          />
          <div className="mt-6 max-w-2xl">
            <AvailabilityGrid
              slots={["09:00", "09:30", "10:00", "10:30", "11:00", "14:00", "14:30", "15:00", "15:30", "16:00"]}
              taken={["09:30", "10:00", "14:00", "15:00", "15:30"]}
              value="10:30"
            />
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader
            eyebrow="What a looked-after bike looks like"
            title="A real history, from a commuter doing 4,000 miles a year"
            description="We keep one for every bike that comes through, so the next service knows what the last one found."
          />
          <div className="mt-8 max-w-2xl">
            <ServiceHistory
              dueOn="March 2027"
              entries={[
                { id: "1", what: "Full service — cables, bearings, both wheels trued", on: "March 2026", by: "Neepsend Cycles" },
                { id: "2", what: "Chain and cassette replaced at 0.75% wear", on: "October 2025", by: "Neepsend Cycles" },
                { id: "3", what: "Basic service — gears indexed, pads replaced", on: "August 2025", by: "Neepsend Cycles" },
                { id: "4", what: "Rear wheel rebuilt after a broken spoke", on: "May 2025", by: "Neepsend Cycles", late: true },
                { id: "5", what: "Full service — first since purchase", on: "February 2025", by: "Neepsend Cycles" },
                { id: "6", what: "Six-week check, free", on: "May 2024", by: "Neepsend Cycles" },
              ]}
            />
          </div>
          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            The wheel rebuild is marked late because the spoke had been broken for a fortnight
            before it came in. Riding on it is what turned a £15 spoke into a £90 rebuild, and we
            record that rather than quietly bill for it.
          </p>
        </section>

        <section className="mt-14">
          <SectionHeader title="Workshop questions" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "How often does a bike need servicing?",
                  answer:
                    "Once a year for a commuter, twice if you ride through the winter, and a chain check every 1,000 miles. A chain replaced at the right moment is £30; left too long it takes the cassette with it and it is £120.",
                },
                {
                  question: "Will you tell me if it is not worth fixing?",
                  answer:
                    "Yes, and we do it several times a week. A £130 service on a £150 bike with a seized bottom bracket is us taking your money. The free safety check exists to have that conversation before you commit.",
                },
                {
                  question: "Can I supply my own parts?",
                  answer:
                    "Yes, and we charge labour only. We cannot warranty a part we did not supply, and we will say honestly if what you have bought is the wrong thing before fitting it.",
                },
                {
                  question: "Do you service e-bikes?",
                  answer:
                    "Mechanically, yes — everything except the motor and the battery diagnostics. For a motor fault we will tell you which dealer can actually read the error code rather than guessing at it.",
                },
              ]}
            />
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            <a className="underline underline-offset-4" href="/">Stock and the wait</a>
            {" · "}
            <a className="underline underline-offset-4" href="/bikes">Bikes and sizing</a>
          </p>
        </section>
      </div>
    </SiteChrome>
  );
}
