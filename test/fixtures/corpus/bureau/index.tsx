// bureau — LIVE-RATES-FIRST. The board is the product, so the board is the
// page, above everything else.
//
// TERMINAL structure and it is the right one: this is read the way a departure
// board is read, at a glance, comparing numbers. Monospace, hairline rules, no
// photograph of a smiling couple holding euros.
//
// "0% COMMISSION" IS ADDRESSED HEAD ON. Every bureau in the country advertises
// it, it is always true, and it is never the price — the charge is the spread
// between what they sell a currency at and what they buy it back at. Printing
// that percentage on every row is the single most useful thing this trade could
// do and almost nobody does it.
//
// AND THE TIMESTAMP IS NOT A FOOTNOTE. A board photographed at nine is wrong by
// four, and every argument at a counter begins with "the website said".
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { RateBoard } from "@/components/ui/rate-board";
import { OpeningHours } from "@/components/ui/opening-hours";
import { LocationCard } from "@/components/ui/location-card";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/")({ component: P });

const HOURS = [
  { day: 1, label: "Monday", open: "09:00", close: "17:00" },
  { day: 2, label: "Tuesday", open: "09:00", close: "17:00" },
  { day: 3, label: "Wednesday", open: "09:00", close: "17:00" },
  { day: 4, label: "Thursday", open: "09:00", close: "17:30" },
  { day: 5, label: "Friday", open: "09:00", close: "17:30" },
  { day: 6, label: "Saturday", open: "09:00", close: "16:00" },
  { day: 0, label: "Sunday", open: null, close: null },
];

// Sell = what you GET for £1. Buy = what you hand back to get £1.
const BOARD = [
  { code: "EUR", name: "Euro", sell: 1.1420, buy: 1.1810 },
  { code: "USD", name: "US dollar", sell: 1.2385, buy: 1.2880 },
  { code: "CHF", name: "Swiss franc", sell: 1.0640, buy: 1.1180 },
  { code: "AED", name: "UAE dirham", sell: 4.4100, buy: 4.6900 },
  { code: "TRY", name: "Turkish lira", sell: 41.20, buy: 46.80, note: "Wide, and it moves. Worth taking half and drawing the rest there." },
  { code: "THB", name: "Thai baht", sell: 40.90, buy: 45.60 },
  { code: "JPY", name: "Japanese yen", sell: 182.40, buy: 197.20 },
  { code: "AUD", name: "Australian dollar", sell: 1.8340, buy: 1.9420 },
  { code: "PLN", name: "Polish złoty", sell: 4.8600, buy: 5.1400 },
  { code: "VND", name: "Vietnamese dong", sell: 30150, buy: null, order: true, note: "We sell it and cannot buy it back — no UK bank will take dong." },
];

function P() {
  return (
    <SiteChrome
      name="Change Alley Currency"
      tagline="Independent bureau on Chapel Walk, Sheffield. Family run since 1979."
      links={[
        { label: "All rates", href: "/rates" },
        { label: "Reserve", href: "/reserve" },
        { label: "Questions", href: "#questions" },
      ]}
      action={{ label: "Reserve at today's rate", href: "/reserve" }}
    >
      {/* THE BOARD. Nothing above it. */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-4xl px-6 py-12">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Thursday 6 August · Board set 09:05 · Next set at 14:00
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance">Today's rates</h1>
          <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
            Both directions on every row, so you can see the spread. That gap is what an exchange
            actually costs you — and it is the number no bureau prints, including the ones with
            "0% commission" in the window.
          </p>

          <div className="mt-8">
            <RateBoard
              rates={BOARD}
              setAt="09:05 today"
              note="Set twice a day at 09:05 and 14:00, and immediately if the market moves more than 1%. Over £2,500 we will beat the board — ask, and it is not a haggle, it is just that the margin on a large note order is smaller."
            />
          </div>
        </div>
      </section>

      {/* THE COMMISSION SENTENCE, ON ITS OWN. */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-4xl px-6 py-12">
          <SectionHeader
            eyebrow="About '0% commission'"
            title="We charge no commission either, and that is not the point"
            description="Every bureau on every high street says it. It is true everywhere and it tells you nothing, because the money is in the spread and always has been."
          />
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <div className="border-t border-foreground pt-4">
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">What it means</p>
              <p className="mt-2 text-sm leading-relaxed">
                No separate fee is added to your transaction. Correct, here and nearly everywhere
                else. The airport bureau charging 12% also charges no commission.
              </p>
            </div>
            <div className="border-t border-foreground pt-4">
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">What to compare</p>
              <p className="mt-2 text-sm leading-relaxed">
                The spread column. Ours runs 3.4% on the euro and 5.0% on the lira. An airport is
                typically 9–14% and a supermarket about 4%.
              </p>
            </div>
            <div className="border-t border-foreground pt-4">
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">When we are not the answer</p>
              <p className="mt-2 text-sm leading-relaxed">
                For spending on a card abroad, a fee-free travel card beats any bureau including
                us. Cash is for markets, taxis, tips and the places that still refuse cards.
              </p>
            </div>
          </div>
          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Saying that last one costs us business and we would rather say it. Somebody who
            exchanges £600 they did not need to has not been robbed, but they have been let down.
          </p>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-4xl px-6 py-12">
          <div className="grid items-start gap-10 lg:grid-cols-[1fr_1fr]">
            <div>
              <SectionHeader eyebrow="When" title="Six days, and Thursday is quiet" />
              <div className="mt-6">
                <OpeningHours days={HOURS} />
              </div>
              <p className="mt-5 max-w-lg text-sm leading-relaxed text-muted-foreground">
                Saturday between eleven and two is the only time there is ever a queue. Anything
                over £3,000 in notes, ring first — we hold a working float, not a vault.
              </p>
            </div>
            <div>
              <SectionHeader eyebrow="Where" title="Chapel Walk, between the two arcades" />
              <div className="mt-6">
                <LocationCard
                  name="Change Alley Currency"
                  address="14 Chapel Walk, Sheffield S1 2PD"
                  note="Five minutes from the Cathedral tram stop. There is no parking on Chapel Walk — it is a pedestrian lane — and the Q-Park on Charles Street is the nearest."
                />
              </div>
              <a className="mt-6 inline-block rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" href="/reserve">
                Reserve at today's rate
              </a>
            </div>
          </div>
        </div>
      </section>

      <section id="questions">
        <div className="mx-auto max-w-3xl px-6 py-12">
          <SectionHeader title="What people ask at the window" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "Do I need ID?",
                  answer:
                    "Under £800, no. Over that, photo ID — a passport or a driving licence. Over £8,000 we need ID and proof of where the money came from, and that is money-laundering regulation rather than nosiness.",
                },
                {
                  question: "Can I bring back what I do not spend?",
                  answer:
                    "Notes, yes, at the buy-back rate on the board that day, and there is no minimum. Coins, no — no UK bank will take foreign coin, so nor can we. Everybody is surprised by that once.",
                },
                {
                  question: "Is the rate better if I reserve online?",
                  answer:
                    "It is the same rate, held for 48 hours. Reserving means we have your currency actually in the drawer, which for anything beyond the main eight matters more than the rate does.",
                },
                {
                  question: "Do you buy gold?",
                  answer:
                    "Sovereigns, Britannias and Krugerrands, at the spot price on the day less 2%. Scrap and jewellery, no — that is a different trade and Hallamshire Assay on Arundel Gate do it properly.",
                },
              ]}
            />
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            <a className="underline underline-offset-4" href="/rates">Every currency we hold</a>
            {" · "}
            <a className="underline underline-offset-4" href="/reserve">Reserve at today's rate</a>
          </p>
        </div>
      </section>
    </SiteChrome>
  );
}
