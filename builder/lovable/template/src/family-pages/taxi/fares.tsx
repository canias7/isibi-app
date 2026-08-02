// taxi /fares — every fixed price, and the honest account of what changes one.
// The tariff table is the part nobody publishes: a passenger who can see the
// night rate before midnight does not feel stung by it at half past.
import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { FareQuote } from "@/components/ui/fare-quote";
import { Faq } from "@/components/ui/faq";
import { PriceList } from "@/components/ui/price-list";
import { SectionHeader } from "@/components/ui/section-header";
import { AIRPORTS } from "./index";
export const Route = createFileRoute("/fares")({ component: P });
function P() {
  const [fare, setFare] = React.useState<number | null>(null);
  return (
    <SiteChrome name="Hallam Cars" tagline="Private hire in Sheffield, 24 hours, licensed by the council."
      links={[{ label: "Home", href: "#/" }, { label: "Accounts", href: "#/account" }]}
      action={{ label: "0114 266 2626", href: "tel:01142662626" }}>

      <div className="mx-auto max-w-5xl px-6 py-14">
        <SectionHeader eyebrow="Fixed fares" title="What everything costs"
          description="Fixed means fixed: traffic, weather and the time of year do not change it. The only things that do are on this page." />

        <section className="mt-12">
          <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Airports</h2>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Per car, up to four people with cases. Includes the drop-off charge the airport levies
            and an hour's free waiting on an arrival.
          </p>
          <PriceList className="mt-4" items={AIRPORTS} />
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Around the city</h2>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Metered inside Sheffield, or fixed if you would rather know first — say which when you
            ring. These are the typical meter fares from the city centre.
          </p>
          <PriceList className="mt-4" items={[
            { name: "City centre to Crookes", price: 9, meta: "~2 miles" },
            { name: "City centre to Hillsborough", price: 11, meta: "~3 miles" },
            { name: "City centre to Meadowhall", price: 16, meta: "~5 miles" },
            { name: "City centre to Dore", price: 22, meta: "~7 miles" },
            { name: "Station to the Northern General", price: 13, meta: "~4 miles" },
            { name: "Station to the Hallamshire", price: 8, meta: "~1.5 miles" },
            { name: "Anywhere to anywhere in S1–S14", price: "Metered", meta: "Or fixed on request" },
          ]} />
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">What changes a fare</h2>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-muted-foreground">
            The complete list. Every one of these is quoted before you get in, never added at the
            end, and none of them is a percentage of anything.
          </p>
          <PriceList className="mt-4" items={[
            { name: "Night tariff", price: 3, meta: "11pm–6am", description: "A flat three pounds, not a multiplier. Christmas Day and New Year's Eve are £8." },
            { name: "Extra stop", price: 3, meta: "Each", description: "Anywhere on the way. Tell the driver rather than the office and it is the same price." },
            { name: "Waiting", price: 15, meta: "Per hour, after 15 minutes", description: "The first fifteen minutes are free on every job and the first hour is free on an airport arrival." },
            { name: "Six-seater", price: 20, meta: "On top of the fare", description: "Eleven in the fleet. Needs booking rather than ringing on the day." },
            { name: "Wheelchair accessible", price: 0, meta: "Same fare", description: "Four cars. Book ahead — it is the availability that is limited, not the price." },
            { name: "Soiling", price: 90, meta: "If it happens", description: "The car is off the road for the rest of the shift. It is on this list because it is real, not because we expect it." },
            { name: "Card payment", price: 0, meta: "No surcharge", description: "Card, contactless, phone or cash, every car." },
          ]} />
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr]">
            <div>
              <SectionHeader eyebrow="Anywhere else" title="Ask and it is fixed"
                description="Anything not on this page gets a fixed price on the spot. Put the two addresses in and it is answered here rather than on the phone." />
              <FareQuote className="mt-6" heading="Somewhere not listed"
                fare={fare}
                includes={["Up to 15 minutes' waiting", "Two cases and two bags", "Card or cash"]}
                onQuote={() => setFare(31)} onBook={() => {}} />
            </div>
            <div>
              <SectionHeader eyebrow="Asked often" title="About the fares" />
              <Faq className="mt-6" items={[
                { question: "Why is a fixed fare sometimes dearer than the meter?", answer: "Because it carries the risk of the traffic. On a clear Tuesday the meter usually wins; at five on a Friday the fixed price does. We will tell you which we think it is." },
                { question: "Do you price-match the apps?", answer: "No, and on an airport run we do not need to. On a short city hop they are sometimes cheaper and we will say so rather than pretend." },
                { question: "Is the airport drop-off charge extra?", answer: "It is in the price. Every airport charges a car to enter the terminal now and every quote here already includes it." },
                { question: "What about tolls?", answer: "There are none on any of our fixed routes. If a diversion creates one we pay it." },
                { question: "Can I get a receipt?", answer: "Printed in the car or emailed, whichever you want. Account customers get one monthly statement instead." },
              ]} />
            </div>
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
