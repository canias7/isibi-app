// bureau /rates — every currency, both ways, with the spread as a percentage.
//
// THE SPREAD COLUMN IS THE POINT OF THIS PAGE. Sorted by it, a customer can see
// that the euro costs them 3.4% and the Vietnamese dong costs them 14% — which
// is not a scandal, it is what a currency nobody trades actually costs to hold,
// and saying so is the difference between a price and a surprise.
//
// SPLIT INTO HELD AND ORDERED, because "do you have it" and "what does it cost"
// are two different questions and a single alphabetical list answers neither.
// Turning up on a Saturday for baht that is a two-day order is the complaint
// this page exists to stop.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { RateBoard } from "@/components/ui/rate-board";
import { ExchangeRateNote } from "@/components/ui/exchange-rate-note";
import { CurrencyAmount } from "@/components/ui/currency-amount";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/rates")({ component: P });

const HELD = [
  { code: "EUR", name: "Euro", sell: 1.1420, buy: 1.1810 },
  { code: "USD", name: "US dollar", sell: 1.2385, buy: 1.2880 },
  { code: "CHF", name: "Swiss franc", sell: 1.0640, buy: 1.1180 },
  { code: "AED", name: "UAE dirham", sell: 4.4100, buy: 4.6900 },
  { code: "AUD", name: "Australian dollar", sell: 1.8340, buy: 1.9420 },
  { code: "CAD", name: "Canadian dollar", sell: 1.6720, buy: 1.7690 },
  { code: "JPY", name: "Japanese yen", sell: 182.40, buy: 197.20 },
  { code: "NOK", name: "Norwegian krone", sell: 13.240, buy: 14.180 },
  { code: "PLN", name: "Polish złoty", sell: 4.8600, buy: 5.1400 },
  { code: "SEK", name: "Swedish krona", sell: 12.780, buy: 13.690 },
  { code: "THB", name: "Thai baht", sell: 40.90, buy: 45.60 },
  { code: "TRY", name: "Turkish lira", sell: 41.20, buy: 46.80, note: "It moves. Take half in cash and draw the rest out there." },
];

const ORDERED = [
  { code: "ZAR", name: "South African rand", sell: 22.10, buy: 24.90, order: true },
  { code: "NZD", name: "New Zealand dollar", sell: 2.0180, buy: 2.1560, order: true },
  { code: "SGD", name: "Singapore dollar", sell: 1.6340, buy: 1.7480, order: true },
  { code: "HUF", name: "Hungarian forint", sell: 443.0, buy: 486.0, order: true },
  { code: "CZK", name: "Czech koruna", sell: 28.40, buy: 31.20, order: true },
  { code: "MAD", name: "Moroccan dirham", sell: 11.80, buy: null, order: true, note: "A closed currency — it is illegal to take it out of Morocco, so nobody buys it back." },
  { code: "INR", name: "Indian rupee", sell: 103.20, buy: null, order: true, note: "Also closed. Spend it or change it back before you fly." },
  { code: "VND", name: "Vietnamese dong", sell: 30150, buy: null, order: true },
  { code: "EGP", name: "Egyptian pound", sell: 58.40, buy: null, order: true, note: "Take dollars instead. Everybody in Egypt would rather have them and you will do better." },
];

function P() {
  return (
    <SiteChrome
      name="Change Alley Currency"
      tagline="Twenty-one currencies. Twelve in the drawer, nine on two days' order."
      links={[
        { label: "Today's board", href: "#/" },
        { label: "Reserve", href: "#/reserve" },
      ]}
      action={{ label: "Reserve at today's rate", href: "#/reserve" }}
    >
      <div className="mx-auto max-w-4xl px-6 py-12">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
          Thursday 6 August · Board set 09:05
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance">Every rate</h1>
        <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
          The spread column is the one to read. It is what the exchange costs you, and it ranges
          from 3.4% on the euro to well over 10% on a currency almost nobody trades. That is not us
          being greedy about the dong — it is what holding a note we may not sell for six months
          costs.
        </p>

        <section className="mt-10">
          <SectionHeader
            eyebrow="In the drawer"
            title="Twelve, over the counter, now"
            description="Up to about £3,000 in any of these without ringing ahead. Beyond that give us a morning."
          />
          <div className="mt-6">
            <RateBoard rates={HELD} setAt="09:05 today" />
          </div>
        </section>

        <section className="mt-12">
          <SectionHeader
            eyebrow="On order"
            title="Nine more, two working days"
            description="Ordered from our wholesaler on the 14:00 run and here the day after next. No deposit and nothing to pay until you collect."
          />
          <div className="mt-6">
            <RateBoard
              rates={ORDERED}
              setAt="09:05 today"
              note="An ordered currency is priced at the board on the day you COLLECT, not the day you order — which cuts both ways and is why we will not pretend otherwise. Reserve it instead and the rate is held for 48 hours."
            />
          </div>
        </section>

        {/* THE CLOSED-CURRENCY POINT, WHICH IS NOT A RATE PROBLEM. */}
        <section className="mt-12 border-t border-foreground pt-8">
          <SectionHeader
            eyebrow="Four we sell and cannot buy back"
            title="Closed currencies, and what that actually means"
            description="Morocco, India, Vietnam and Egypt all restrict taking their currency out of the country. No UK bank will accept it, so no bureau can buy it back — including the ones that do not mention it until you are at the window with a fistful of dirham."
          />
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div className="rounded-lg border border-border p-5">
              <p className="text-sm font-medium">What to do instead</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Take euros or dollars and change them there. You will get a better rate than any UK
                bureau can offer and you will not be left with notes nobody wants. For Egypt in
                particular, dollars are close to a second currency.
              </p>
            </div>
            <div className="rounded-lg border border-border p-5">
              <p className="text-sm font-medium">If you already have some</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                We will take it as a favour at a rate that is frankly poor, or you can keep it for
                the next trip. Neither is a good outcome and we would rather have told you first.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-12">
          <SectionHeader
            eyebrow="A worked example"
            title="£500 into euros, and back again"
            description="The whole cost of a round trip, in numbers, because the spread is easier to see once it is money."
          />
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[32rem] border-collapse font-mono text-sm">
              <tbody>
                <tr className="border-b border-border">
                  <th scope="row" className="py-3 pr-4 text-left font-normal">You bring in</th>
                  <td className="py-3 text-right"><CurrencyAmount minor={50000} /></td>
                </tr>
                <tr className="border-b border-border">
                  <th scope="row" className="py-3 pr-4 text-left font-normal">You get, at 1.1420</th>
                  <td className="py-3 text-right"><CurrencyAmount minor={57100} currency="EUR" /></td>
                </tr>
                <tr className="border-b border-border">
                  <th scope="row" className="py-3 pr-4 text-left font-normal">Say you spend two thirds and bring back</th>
                  <td className="py-3 text-right"><CurrencyAmount minor={19033} currency="EUR" /></td>
                </tr>
                <tr className="border-b border-border">
                  <th scope="row" className="py-3 pr-4 text-left font-normal">We buy it back at 1.1810</th>
                  <td className="py-3 text-right"><CurrencyAmount minor={16117} /></td>
                </tr>
                <tr>
                  <th scope="row" className="py-3 pr-4 text-left font-medium">The round trip cost you</th>
                  <td className="py-3 text-right font-medium"><CurrencyAmount minor={550} /></td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mt-4">
            <ExchangeRateNote from="GBP" to="EUR" rate={1.142} at="2026-08-06T09:05:00Z" />
          </div>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            About £5.50 on £500 exchanged and £166 changed back. Compare it against an airport
            bureau at 11% and the same trip is nearer £40. That is the whole argument for walking
            into town before you fly.
          </p>
        </section>

        <section className="mt-12">
          <SectionHeader title="Questions about the rates" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "Why is the lira spread so much wider than the euro's?",
                  answer:
                    "Because it moves. A currency that can shift 4% in a week has to carry a wider gap or the bureau holding it loses money on the float. It is a real cost rather than a markup, and on a volatile currency it is worth taking half and drawing the rest from a machine out there.",
                },
                {
                  question: "Do I get a better rate for a bigger amount?",
                  answer:
                    "Over £2,500, yes — ask at the window. It is not haggling and you are not being cheeky; the margin on a large note order genuinely is smaller and we would rather pass some of it on than lose the trade to an online seller.",
                },
                {
                  question: "How often does the board change?",
                  answer:
                    "Twice a day, 09:05 and 14:00, and immediately if the market moves more than about 1%. The time is printed on the board because a rate with no timestamp is a claim rather than a price.",
                },
                {
                  question: "Can you match an online rate?",
                  answer:
                    "Sometimes, and we will look at the page with you. An online seller with no counter, no float and no staff has a lower cost base, and where they genuinely beat us we will say so rather than pretend.",
                },
              ]}
            />
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            <a className="underline underline-offset-4" href="#/">Today's board</a>
            {" · "}
            <a className="underline underline-offset-4" href="#/reserve">Reserve at today's rate</a>
          </p>
        </section>
      </div>
    </SiteChrome>
  );
}
