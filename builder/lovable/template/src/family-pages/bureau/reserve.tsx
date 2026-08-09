// bureau /reserve — holding a rate, the ID thresholds, and the buy-back terms.
//
// A HELD RATE AND AN INDICATIVE ONE ARE DIFFERENT PROMISES and showing them
// identically is how a correct number still makes somebody feel misled. The
// reserve form says which it is, in the same words, on the same line.
//
// THE ID THRESHOLDS ARE PUBLISHED RATHER THAN SPRUNG. Being asked for a
// passport at the window when you brought £900 and no bag is a wasted trip into
// town, and every bureau has these limits — they just print them on a laminated
// card facing the staff.
//
// THE BUY-BACK TERMS ARE ON THIS PAGE and not on a separate one, because the
// moment somebody is deciding how much to take is the moment the answer matters.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { ExchangeRateNote } from "@/components/ui/exchange-rate-note";
import { CurrencyAmount } from "@/components/ui/currency-amount";
import { PriceList } from "@/components/ui/price-list";
import { SpecList, SpecRow } from "@/components/ui/spec-row";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/reserve")({ component: P });

function P() {
  return (
    <SiteChrome
      name="Change Alley Currency"
      tagline="Hold today's rate for 48 hours. Nothing to pay until you collect."
      links={[
        { label: "Today's board", href: "/" },
        { label: "All rates", href: "/rates" },
      ]}
      action={{ label: "Today's board", href: "/" }}
    >
      <div className="mx-auto max-w-4xl px-6 py-12">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
          Thursday 6 August · Board set 09:05
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance">Reserve</h1>
        <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
          Two things happen when you reserve: the rate is held for 48 hours, and the notes are put
          in an envelope with your name on. For the main eight currencies the second matters less.
          For everything else it is the whole point.
        </p>

        <section className="mt-10 grid items-start gap-10 lg:grid-cols-[1.1fr_1fr]">
          <div className="rounded-xl border border-border p-6">
            <p className="text-sm font-medium">Reserve currency</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="font-medium">Currency</span>
                <select className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" defaultValue="EUR">
                  <option value="EUR">EUR · Euro — in the drawer</option>
                  <option value="USD">USD · US dollar — in the drawer</option>
                  <option value="TRY">TRY · Turkish lira — in the drawer</option>
                  <option value="THB">THB · Thai baht — in the drawer</option>
                  <option value="ZAR">ZAR · South African rand — two days</option>
                  <option value="VND">VND · Vietnamese dong — two days</option>
                </select>
              </label>
              <label className="block text-sm">
                <span className="font-medium">Sterling to change</span>
                <input
                  className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-sm tabular-nums"
                  inputMode="decimal"
                  defaultValue="500.00"
                  aria-label="Sterling to change"
                />
              </label>
            </div>

            {/* HELD, NOT INDICATIVE — and it says which. */}
            <div className="mt-5 border-t border-border pt-5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">You would collect</p>
                <p className="font-mono text-2xl font-semibold">
                  <CurrencyAmount minor={57100} currency="EUR" />
                </p>
              </div>
              <div className="mt-2">
                <ExchangeRateNote from="GBP" to="EUR" rate={1.142} at="2026-08-06T09:05:00Z" locked />
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="font-medium">Name</span>
                <input className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" autoComplete="name" />
              </label>
              <label className="block text-sm">
                <span className="font-medium">Mobile</span>
                <input className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" autoComplete="tel" inputMode="tel" />
              </label>
            </div>
            <button type="button" className="mt-5 w-full cursor-pointer rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground">
              Hold this rate for 48 hours
            </button>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Nothing to pay now and no card details are taken. If you do not come in, the envelope
              goes back in the drawer and nothing happens to you — we would rather that than a
              deposit system that punishes people for changing their minds.
            </p>
          </div>

          <div>
            <SectionHeader
              eyebrow="What a reservation is"
              title="A held rate and a named envelope"
              description="Not a payment, not a contract, and not a queue jump — there is rarely a queue."
            />
            <SpecList className="mt-6">
              <SpecRow label="Rate held for" value="48 hours" highlight note="From the moment you reserve, not from the next board." />
              <SpecRow label="If the rate improves" value="You get the better one" highlight note="We are not going to hold you to a worse number than the one on the board when you walk in." />
              <SpecRow label="Deposit" value="None" note="Nothing to pay until you collect." />
              <SpecRow label="Cancelling" value="Just do not come" note="No fee, no email, no black mark." />
              <SpecRow label="Ordered currencies" value="Two working days" note="Reserved by 14:00 today, in the drawer the day after tomorrow." />
              <SpecRow label="Maximum" value="£3,000" note="Beyond that ring us — it is a float question rather than a rule." />
            </SpecList>
          </div>
        </section>

        {/* THE ID THRESHOLDS. Published, not sprung at the window. */}
        <section className="mt-14 border-t border-foreground pt-8">
          <SectionHeader
            eyebrow="Identification"
            title="Three thresholds, so nobody makes a wasted trip"
            description="These are money-laundering regulations rather than our preference, and every bureau in the country has them. Most of them print the limits on a card facing the staff instead of the customer."
          />
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <div className="border-t border-border pt-4">
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">Under £800</p>
              <p className="mt-2 text-sm font-medium">Nothing at all</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Walk in, change it, walk out. No name, no address, no form. This covers the large
                majority of what we do.
              </p>
            </div>
            <div className="border-t border-border pt-4">
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">£800 to £8,000</p>
              <p className="mt-2 text-sm font-medium">Photo ID</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                A passport or a photocard driving licence. We record the number and give it straight
                back — nothing is photocopied and nothing is kept beyond the record we must keep.
              </p>
            </div>
            <div className="border-t border-border pt-4">
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">Over £8,000</p>
              <p className="mt-2 text-sm font-medium">ID and source of funds</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Photo ID plus something showing where the money came from — a bank statement, a
                completion letter, a sale invoice. Ring first and bring it; being asked at the
                window with £10,000 in a bag is nobody's good afternoon.
              </p>
            </div>
          </div>
          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Reserving does not change any of this. The check happens when you collect, because that
            is when the money moves.
          </p>
        </section>

        <section className="mt-14">
          <SectionHeader
            eyebrow="Buy-back"
            title="Bringing back what you did not spend"
            description="No receipt needed and no minimum. The rate is whatever is on the board that day, which is the only honest way to do it — a guaranteed buy-back rate priced months ahead would just be a worse rate."
          />
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div className="rounded-lg border border-border p-5">
              <p className="text-sm font-medium">Notes, yes</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Any of the twelve we hold, any amount, at that day's buy-back rate. Torn or taped
                notes we will usually still take and will tell you if we cannot.
              </p>
            </div>
            <div className="rounded-lg border border-border p-5">
              <p className="text-sm font-medium">Coins, no</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                No UK bank accepts foreign coin, so nor can anybody else. Spend it at the airport or
                put it in the charity bucket by the gate — there is one at every terminal.
              </p>
            </div>
            <div className="rounded-lg border border-border p-5">
              <p className="text-sm font-medium">Closed currencies, no</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Moroccan dirham, Indian rupee, Vietnamese dong and Egyptian pound cannot legally
                leave their countries, so nothing here can buy them back. Said before you order
                rather than after you return.
              </p>
            </div>
            <div className="rounded-lg border border-border p-5">
              <p className="text-sm font-medium">Old and withdrawn notes</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Pre-euro currency, no. Old-series notes for a live currency, usually yes, sometimes
                at a small discount. Bring them in and we will look — it costs nothing to ask.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader
            eyebrow="Other things we do"
            title="And what they cost"
            description="All in, with nothing added at the counter."
          />
          <div className="mt-6">
            <PriceList
              items={[
                { name: "Money transfer, to a bank account", description: "Through our licensed partner. Same-day to most of Europe, next day worldwide.", price: 4.5, meta: "plus the spread" },
                { name: "Money transfer, cash collection", description: "Collected at an agent abroad. Useful where a bank account is not the answer.", price: 7.5 },
                { name: "Gold sovereign, we buy", description: "Spot price on the day less 2%. Britannias and Krugerrands the same.", price: "spot − 2%" },
                { name: "Travellers' cheques, encashment", description: "Still turns up about twice a month. Photo ID required whatever the amount.", price: 3, meta: "flat" },
                { name: "Note verification", description: "Somebody paid you in euros and you want to be sure. Two minutes, no charge.", price: 0 },
                { name: "Ordering an unusual currency", description: "Anything our wholesaler lists. Two working days, no deposit, no fee.", price: 0 },
              ]}
            />
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader title="Questions about reserving" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "What if the rate moves against me before I collect?",
                  answer:
                    "It does not affect you — that is what holding it means, and it is our risk for 48 hours. If it moves in your favour you get the better rate instead. We are not going to hold somebody to a worse number than the one on the board when they walk in.",
                },
                {
                  question: "Can somebody else collect it?",
                  answer:
                    "Yes, if they bring their own photo ID and the reservation number, and if the amount is over £800 the ID recorded is theirs rather than yours. Under £800 we will simply hand it over.",
                },
                {
                  question: "How do I pay?",
                  answer:
                    "Debit card or cash. Not credit card — a card issuer treats buying currency as a cash advance and charges the customer interest from that day, which is a nasty surprise we would rather nobody had.",
                },
                {
                  question: "Do you deliver?",
                  answer:
                    "No, and we are not going to start. Currency in the post is somebody else's business model and it is not one we would want to explain to a customer whose envelope went missing.",
                },
              ]}
            />
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            <a className="underline underline-offset-4" href="/">Today's board</a>
            {" · "}
            <a className="underline underline-offset-4" href="/rates">Every currency, both ways</a>
          </p>
        </section>
      </div>
    </SiteChrome>
  );
}
