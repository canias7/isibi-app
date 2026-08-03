// coach-hire /quote — the enquiry, and the extras that move the figure stated
// BEFORE the form rather than after the deposit.
//
// The route is asked for as stops with times, because "Sheffield to Blackpool"
// is not a route — the number of pick-ups is what decides whether a day fits
// inside a driver's hours, and it is the thing customers never think to
// mention.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { RouteStop } from "@/components/ui/route-stop";
import { FareQuote } from "@/components/ui/fare-quote";
import { DateEnquiry } from "@/components/ui/date-enquiry";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/quote")({ component: P });

const EXTRAS = [
  { what: "Weekend or bank holiday", effect: "About 8% more", why: "Driver overtime rates, which are set by an agreement we do not control." },
  { what: "More than three pick-ups", effect: "Adds 30–45 minutes each", why: "It eats the driver's legal hours, which is the constraint that turns a one-driver day into a two-driver one." },
  { what: "Finishing after midnight", effect: "£120", why: "The vehicle is off the road for the following morning's school run." },
  { what: "Congestion or clean-air zones", effect: "At cost, listed", why: "Sheffield, Leeds, Birmingham and London all charge. We show the figure rather than fold it in." },
  { what: "Waiting beyond 30 minutes", effect: "£45 an hour", why: "Half an hour is absorbed on every job without argument." },
  { what: "Cleaning after a spillage", effect: "Up to £150", why: "Only ever charged with a photograph, and it has happened four times in fifty years." },
];

function P() {
  return (
    <SiteChrome
      name="Hallam Coaches"
      tagline="Send the route with times. Everything that changes the price is listed first."
      links={[
        { label: "Home", href: "#/" },
        { label: "The fleet", href: "#/fleet" },
      ]}
      action={{ label: "The fleet", href: "#/fleet" }}
    >
      <div className="mx-auto max-w-5xl px-6 py-14">
        <h1 className="text-4xl font-semibold tracking-tight text-balance">Get a quote</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Everything below changes the figure, and all of it is here before the form rather than
          after the deposit. Most quotes come back within two hours in working time.
        </p>

        <section className="mt-12">
          <SectionHeader eyebrow="What moves the price" title="Six things, and why each one does" />
          <ul className="mt-6 divide-y divide-border border-y border-border">
            {EXTRAS.map((e) => (
              <li key={e.what} className="grid gap-1 py-4 md:grid-cols-[minmax(0,15rem)_minmax(0,10rem)_1fr] md:gap-6">
                <p className="font-medium">{e.what}</p>
                <p className="text-sm tabular-nums text-muted-foreground">{e.effect}</p>
                <p className="text-sm leading-relaxed text-muted-foreground">{e.why}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-14">
          <SectionHeader
            eyebrow="The route"
            title="Stops and times, not just a destination"
            description="'Sheffield to Blackpool' is not a route. Four pick-ups across the city adds well over an hour, and that is what turns a one-driver day into a two-driver one."
          />
          <div className="mt-8 space-y-3">
            <RouteStop
              sequence={1}
              name="Hillsborough Corner"
              address="Holme Lane, S6 4JQ"
              windowFrom="07:30"
              windowTo="07:40"
              access="Bus stop layby, no waiting restriction before 08:00"
            />
            <RouteStop
              sequence={2}
              name="Sheffield Interchange"
              address="Pond Street, S1 2BP"
              windowFrom="07:55"
              windowTo="08:05"
              mustBookIn
              access="Coach bay 4. Must be pre-booked with the interchange or we are turned away."
            />
            <RouteStop
              sequence={3}
              name="Meadowhall coach park"
              address="S9 1EP"
              windowFrom="08:20"
              windowTo="08:30"
              eta="08:22"
            />
            <RouteStop
              sequence={4}
              name="Blackpool, Talbot Road"
              address="FY1 1LB"
              eta="10:45"
              willBeLate
              access="Arrival window is optimistic on a summer Saturday — the M55 is the variable and we would rather say so now."
            />
          </div>
        </section>

        <section className="mt-14">
          <div className="grid items-start gap-10 lg:grid-cols-[1fr_1fr]">
            <div>
              <SectionHeader eyebrow="Check the date" title="Is it free?" />
              <p className="mt-5 max-w-lg text-sm leading-relaxed text-muted-foreground">
                Saturdays between May and September go months ahead, particularly the 49 and the
                double-decker. Midweek is nearly always available at short notice.
              </p>
              <p className="mt-4 max-w-lg text-sm leading-relaxed text-muted-foreground">
                We hold a date for seven days with no deposit. Confirming is 25% and the balance is
                due a fortnight before, not on the day.
              </p>
            </div>
            <DateEnquiry
              heading="Is your date free?"
              defaultDate="2026-09-19"
              defaultGuests={49}
              minGuests={8}
              maxGuests={106}
              alternatives={["Friday 18 September", "Sunday 20 September", "Saturday 26 September"]}
            />
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader eyebrow="An example" title="What a quote looks like when it comes back" />
          <div className="mt-6 max-w-2xl">
            <FareQuote
              heading="Sheffield to Blackpool, 49 seats, Saturday 19 September"
              fare={890}
              lines={[
                { label: "Vehicle and driver, 12 hours", value: 720 },
                { label: "Mileage, 178 miles return", value: 124 },
                { label: "Weekend uplift", value: 46 },
              ]}
              includes={[
                "Driver, fuel, tolls and subsistence",
                "Four pick-ups as listed",
                "Interchange coach bay booking",
                "Up to 30 minutes' waiting at each stop",
              ]}
            />
          </div>
          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            One figure with everything in it. If something on the day pushes it up we ring you
            before it happens rather than invoice for it afterwards.
          </p>
        </section>

        <section className="mt-14">
          <SectionHeader title="Quote questions" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "How long is a quote held?",
                  answer: "Seven days, and the date is held with it. After that the vehicle goes back into the diary — we will ring before releasing it rather than just letting it go.",
                },
                {
                  question: "What if our numbers change?",
                  answer:
                    "Up or down within the same vehicle costs nothing. Moving up a size is the difference in the day rate and we would rather do it a fortnight out than on the morning.",
                },
                {
                  question: "Do you take a deposit?",
                  answer: "25% to confirm, balance a fortnight before. Cancel more than 28 days out and the deposit comes back in full.",
                },
              ]}
            />
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            <a className="underline underline-offset-4" href="#/">Back to prices</a>
            {" · "}
            <a className="underline underline-offset-4" href="#/fleet">The fleet</a>
          </p>
        </section>
      </div>
    </SiteChrome>
  );
}
