// timetable /fares — single, return, day and season, plus WHO TRAVELS FREE.
//
// Most people entitled to free or reduced travel do not know it. The
// concessionary pass after 09:30, the under-18 fare, the companion travelling
// free with a disabled pass holder — all statutory, all routinely unclaimed
// because the operator lists prices and not entitlements.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { FareQuote } from "@/components/ui/fare-quote";
import { LocationCard } from "@/components/ui/location-card";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/fares")({ component: P });

const FARES = [
  { what: "Single, any distance on one route", price: "£2.00", note: "Capped nationally. It was £4.60 to Bolsterstone before the cap and would be again without it." },
  { what: "Return, same day", price: "£3.60", note: "Cheaper than two singles and only on the day of issue." },
  { what: "Day ticket, all three routes", price: "£5.00", note: "Worth it from the second journey. Bought on the bus." },
  { what: "Weekly, all three routes", price: "£19.00", note: "Bought on the bus or at the Stocksbridge office. Runs seven days from first use." },
  { what: "Monthly, all three routes", price: "£68.00", note: "Direct debit available. Two weeks free against buying four weeklies." },
  { what: "Under 18", price: "£1.00", note: "Any journey, any time, with or without a pass. Just say." },
  { what: "Under 5", price: "Free", note: "Up to two per fare-paying adult, and nobody has ever counted." },
];

const FREE = [
  { who: "English National Concessionary pass holders", when: "After 09:30 weekdays, all day at weekends and bank holidays", detail: "The statutory scheme. Over State Pension age or with a qualifying disability. Show the pass; there is nothing to arrange with us." },
  { who: "A companion, with a +1 disabled pass", when: "Any time the pass holder travels", detail: "Free, and routinely unclaimed because nobody mentions it. If the pass has the companion symbol, whoever is with you travels free." },
  { who: "Sheffield under-18 pass holders", when: "Any time", detail: "Free rather than the £1 fare. The council issues it and most eligible families have never applied." },
  { who: "Assistance dogs", when: "Always", detail: "No question and no charge, on any service, in any seat." },
  { who: "Anybody who genuinely cannot pay", when: "Any time", detail: "Tell the driver. Nobody has ever been left at a stop in this valley over £2 and nobody ever will be." },
];

function P() {
  return (
    <SiteChrome
      name="Upper Don Community Transport"
      tagline="Fares, and the five ways people travel free without knowing it."
      links={[
        { label: "Next departures", href: "#/" },
        { label: "Timetable", href: "#/timetable" },
      ]}
      action={{ label: "Next departures", href: "#/" }}
    >
      <div className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="text-4xl font-semibold tracking-tight">Fares</h1>
        <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
          Contactless, cash, or a pass. There is no app and there is not going to be — about a
          third of our passengers pay in coins and building something they cannot use would be a
          strange priority.
        </p>

        <section className="mt-10">
          <SectionHeader eyebrow="What it costs" title="Seven lines" />
          <ul className="mt-6 divide-y divide-border border-y border-border">
            {FARES.map((f) => (
              <li key={f.what} className="grid gap-1 py-4 md:grid-cols-[minmax(0,17rem)_minmax(0,6rem)_1fr] md:gap-6">
                <p className="font-medium">{f.what}</p>
                <p className="font-mono tabular-nums">{f.price}</p>
                <p className="text-sm text-muted-foreground">{f.note}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12">
          <SectionHeader
            eyebrow="Free travel"
            title="Five entitlements, and most of them go unclaimed"
            description="These are statutory or ours, and none of them requires anything from you except saying so. Operators list prices and not entitlements, which is why nobody knows."
          />
          <ul className="mt-8 divide-y divide-border border-y border-border">
            {FREE.map((f) => (
              <li key={f.who} className="py-5">
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <p className="font-medium">{f.who}</p>
                  <p className="text-sm text-muted-foreground">{f.when}</p>
                </div>
                <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">{f.detail}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12">
          <div className="grid items-start gap-10 md:grid-cols-2">
            <div>
              <SectionHeader
                eyebrow="A worked fare"
                title="Sheffield to Bolsterstone and back"
                description="The commonest journey somebody rings to ask about, and the one the £2 cap changed most."
              />
              <p className="mt-5 max-w-lg text-sm leading-relaxed text-muted-foreground">
                Without the national cap this would be £9.20 return. It is the single biggest reason
                the 62 still carries anybody, and if the cap ends we will have to say so loudly.
              </p>
            </div>
            <FareQuote
              heading="Sheffield Interchange to Bolsterstone"
              fare={3.6}
              lines={[
                { label: "Single, capped", value: 2 },
                { label: "Return discount", value: -0.4 },
                { label: "Return, same day", value: 2 },
              ]}
              includes={[
                "18 miles each way",
                "Any of the four daily journeys",
                "Free for a concessionary pass holder after 09:30",
                "£1 for anybody under 18",
              ]}
            />
          </div>
        </section>

        <section className="mt-12">
          <div className="grid items-start gap-10 md:grid-cols-2">
            <div>
              <SectionHeader title="Fare questions" />
              <div className="mt-6">
                <Faq
                  items={[
                    {
                      question: "Do you take contactless?",
                      answer: "On all three routes, and it is capped daily at £5 automatically — tap on every journey and you will never pay more than the day ticket.",
                    },
                    {
                      question: "Can I buy a season ticket online?",
                      answer:
                        "No. On the bus or at the Stocksbridge office, and that is a deliberate choice — an online shop costs us more a year than the tickets it would sell.",
                    },
                    {
                      question: "What if I have no money on me?",
                      answer:
                        "Get on. Tell the driver. It happens a few times a week and nobody is going to be left at a stop on a moor road over two pounds.",
                    },
                    {
                      question: "Are the fares going up?",
                      answer:
                        "Not in this financial year. If the national £2 cap ends, singles go to their real distance-based prices and we will write it on every bus a month beforehand.",
                    },
                  ]}
                />
              </div>
            </div>
            <LocationCard
              name="Stocksbridge office"
              address="42 Manchester Road, Stocksbridge, Sheffield S36 1DH"
              note="Tuesday and Thursday, 09:00 to 13:00. Season tickets, lost property, and somebody who will actually talk to you about a complaint."
            />
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            <a className="underline underline-offset-4" href="#/">Live departures</a>
            {" · "}
            <a className="underline underline-offset-4" href="#/timetable">The full timetable</a>
          </p>
        </section>
      </div>
    </SiteChrome>
  );
}
