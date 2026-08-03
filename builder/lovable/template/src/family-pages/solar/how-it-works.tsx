// solar /how-it-works — the install week by week, the grants, and THE ROOFS WE
// TURN DOWN.
//
// The refusal list is the trust-building half. An installer that has never
// declined a job is an installer who fits panels on roofs that need re-tiling
// in four years, and the customer finds out when the whole array has to come
// off at their expense. Publishing what we say no to is worth more than any
// number of accreditation logos.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { ArrangementSteps } from "@/components/ui/arrangement-steps";
import { PriceList } from "@/components/ui/price-list";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/how-it-works")({ component: P });

const PRICES = [
  { name: "3.5 kWp — about 8 panels", description: "A typical terrace or small semi. Scaffolding, inverter, everything", price: 5900 },
  { name: "5.0 kWp — about 12 panels", description: "The commonest install we do", price: 7400 },
  { name: "6.5 kWp — about 16 panels", description: "A larger semi or a detached with a good roof", price: 9100 },
  { name: "Battery, 5 kWh", description: "Adds resilience and cheap overnight charging. About 2 years to the payback", price: 3800 },
  { name: "Battery, 10 kWh", description: "Worth it with an EV or a heat pump, rarely otherwise", price: 5900 },
  { name: "EV charger, 7 kW", description: "Fitted at the same time, which saves a second day of labour", price: 950 },
  { name: "Bird protection", description: "Mesh round the array. Not optional if you have gulls, and Sheffield does", price: 420 },
  { name: "Scaffolding", description: "Always included in every figure above. Never a later addition", price: 0, meta: "included" },
];

const NO = [
  { what: "A roof needing re-tiling within about five years", why: "The array has to come off and go back on, at your cost, and it is £1,400. Get the roof done first and come back — we will hold the quote for a year." },
  { what: "Heavy permanent shading", why: "A chimney or a neighbour's tree over the south face. Optimisers help and they do not fix it. We will show you the shading survey rather than argue." },
  { what: "Asbestos cement roofs", why: "Common on garages here. It cannot be safely drilled and we are not licensed for it." },
  { what: "Listed buildings and some conservation areas", why: "Where consent is genuinely unlikely we will say so before charging for an application. Sometimes it is worth trying and we will tell you which." },
  { what: "Roofs under about 15 m²", why: "The scaffolding and the day's labour are the same whatever the array size. Below that the arithmetic stops working and we would be taking your money." },
  { what: "Anything where the DNO refuses the connection", why: "Rare, and it happens on some rural single-phase supplies. We apply before you commit to anything and it costs you nothing." },
];

function P() {
  return (
    <SiteChrome
      name="Rivelin Renewables"
      tagline="The install week by week, the grants, and the roofs we turn down."
      links={[
        { label: "Estimate", href: "#/" },
        { label: "Book a survey", href: "#/survey" },
      ]}
      action={{ label: "Book a survey", href: "#/survey" }}
    >
      <div className="mx-auto max-w-5xl px-6 py-14">
        <h1 className="text-4xl font-semibold tracking-tight text-balance">How it works</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Six weeks from survey to switch-on, and the roof itself is two days. Most of that time is
          the network operator's paperwork, which we do and you never see.
        </p>

        <section className="mt-12">
          <SectionHeader eyebrow="Start to finish" title="What happens, and what you have to do" />
          <div className="mt-8 max-w-3xl">
            <ArrangementSteps
              nothingLabel="Nothing you need to do"
              steps={[
                {
                  title: "The survey",
                  what: "Ninety minutes. We measure the roof, check the rafters from inside, look at the consumer unit and run a shading survey with an instrument rather than by eye.",
                  youDo: "Be in, and find the last electricity bill if you can.",
                  when: "Within about ten days of asking",
                },
                {
                  title: "The quote",
                  what: "A single figure with scaffolding, the DNO application, the MCS certificate and VAT in it. Plus a generation estimate as a band and the assumptions behind it.",
                  youDo: "Nothing. Take it to two other installers — we would.",
                  when: "Three working days after the survey",
                },
                {
                  title: "The DNO application",
                  what: "Northern Powergrid has to agree to the connection. We apply, and it is the reason the whole thing takes six weeks rather than two.",
                  when: "Up to four weeks, and out of everybody's hands",
                },
                {
                  title: "Scaffolding",
                  what: "Goes up the day before. It needs about two metres of clear ground along the relevant wall.",
                  youDo: "Move the bins and anything under the eaves.",
                  when: "The day before the install",
                },
                {
                  title: "The install",
                  what: "Two days for a typical array, three with a battery. Panels and mounting on day one, inverter and electrical work on day two. The power is off for about an hour.",
                  youDo: "Somebody in on the second day, for the hour the power is off.",
                  when: "Two days",
                },
                {
                  title: "Switch-on and paperwork",
                  what: "We commission it, show you the app, and register it for MCS and the export tariff. Scaffolding comes down within three days.",
                  youDo: "Choose an export supplier. We will tell you which pays most this month.",
                  when: "The same afternoon",
                },
              ]}
            />
          </div>
        </section>

        <section className="mt-14">
          <div className="grid items-start gap-10 lg:grid-cols-[1fr_1fr]">
            <div>
              <SectionHeader
                eyebrow="Prices"
                title="Everything in, including the scaffolding"
                description="Nothing on this list is added later. If a quote from anybody else does not mention scaffolding, add £900 to it before comparing."
              />
              <p className="mt-5 max-w-lg text-sm leading-relaxed text-muted-foreground">
                0% VAT until March 2027 and it is already in these figures rather than shown as a
                discount. The ECO4 and Great British Insulation schemes can cover the lot for
                eligible households — we check on the survey and we do the application.
              </p>
            </div>
            <PriceList items={PRICES} />
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader
            eyebrow="What we say no to"
            title="Six things, and we say no several times a month"
            description="An installer who has never turned a job down is an installer fitting panels to roofs that will need stripping in four years."
          />
          <ul className="mt-8 divide-y divide-border border-y border-border">
            {NO.map((n) => (
              <li key={n.what} className="grid gap-1 py-5 md:grid-cols-[minmax(0,19rem)_1fr] md:gap-8">
                <p className="font-medium">{n.what}</p>
                <p className="text-sm leading-relaxed text-muted-foreground">{n.why}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-14">
          <SectionHeader title="Install questions" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "Do I need planning permission?",
                  answer:
                    "Almost never on a house — it is permitted development within limits we will check. Flats, listed buildings and some conservation areas are different and we will tell you honestly which applies.",
                },
                {
                  question: "What happens in a power cut?",
                  answer:
                    "Solar alone shuts down, by law, so it cannot backfeed the network onto an engineer. A battery with an EPS output keeps some sockets alive; ask for it specifically because it is not standard.",
                },
                {
                  question: "How long do panels last?",
                  answer:
                    "25-year performance warranty, about 87% output at year 25. The inverter is the part that fails — 10 to 15 years and about £900 to replace. That is in the payback figures and most installers leave it out.",
                },
                {
                  question: "Will it damage the roof?",
                  answer:
                    "Fitted properly, no, and we are insured and MCS-certified for exactly that. We photograph the roof before and after and give you the set, which is what you would want if anything ever were disputed.",
                },
              ]}
            />
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            <a className="underline underline-offset-4" href="#/">The estimate</a>
            {" · "}
            <a className="underline underline-offset-4" href="#/survey">Book a survey</a>
          </p>
        </section>
      </div>
    </SiteChrome>
  );
}
