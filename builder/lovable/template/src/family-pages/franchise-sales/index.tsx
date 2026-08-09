// franchise-sales — TOTAL-COST-FIRST: the whole investment computed from its
// parts, beside the headline fee everybody quotes. "From £14,995" is the
// franchise fee and the real number is three times it; adding it up on the page
// loses the prospects who were never funded and keeps the ones who are.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { BreakEvenNote } from "@/components/ui/break-even-note";
import { Faq } from "@/components/ui/faq";
import { InvestmentTable } from "@/components/ui/investment-table";
import { PaybackNote } from "@/components/ui/payback-note";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { StatsBand } from "@/components/ui/stats-band";
import { TerritoryList } from "@/components/ui/territory-list";
import { TestimonialGrid } from "@/components/ui/testimonial";
export const Route = createFileRoute("/")({ component: P });
export const COSTS = [
  { what: "Franchise fee", amount: 14995, detail: "Training, the brand, the systems, and your territory for five years" },
  { what: "Van, sign-written", amount: 18000, to: 26000, detail: "Lease or buy. A three-year-old Transit Custom at the bottom, new at the top" },
  { what: "Equipment and initial stock", amount: 7400, detail: "Fixed — the same kit list for everybody, bought through the group" },
  { what: "Launch marketing", amount: 3500, detail: "Six weeks of local advertising, run by head office and spent in your area" },
  { what: "Working capital", amount: 12000, to: 18000, detail: "Six months. This is the line people leave out and it is the one that closes businesses" },
];
export const EXCLUDES = [
  "Your own wages. Most franchisees draw nothing for four to five months",
  "Rent, if you want premises. About 60% of the network works from home and does not need any",
  "VAT on the fee and the equipment, reclaimable once registered but payable up front",
  "Insurance, roughly £1,400 a year for the van, public liability and employers'",
  "Fuel, which on an average round is about £280 a month",
];
export const TERRITORIES = [
  { name: "Sheffield North", state: "free" as const, population: 118000, detail: "Hillsborough, Chapeltown, Ecclesfield, Stocksbridge" },
  { name: "Doncaster West", state: "free" as const, population: 94000, detail: "Includes Mexborough and Conisbrough" },
  { name: "Huddersfield", state: "free" as const, population: 162000, detail: "The largest free territory in the north" },
  { name: "Wakefield", state: "under-offer" as const, population: 109000, detail: "Second meeting stage, decision expected in September" },
  { name: "Chesterfield", state: "under-offer" as const, population: 88000 },
  { name: "Sheffield South", state: "taken" as const, population: 131000, detail: "Opened 2023" },
  { name: "Rotherham", state: "taken" as const, population: 109000, detail: "Opened 2021, second van added 2024" },
  { name: "Barnsley", state: "taken" as const, population: 96000, detail: "Opened 2022" },
  { name: "Leeds East", state: "taken" as const, population: 174000, detail: "Opened 2020" },
];
export const QUOTES = [
  { quote: "The number on the website was £14,995 and the number I actually needed was £58,000. Nobody hid it — it was on the page — but I would not have believed it from any of the other four I looked at.", name: "Marcus Dean", role: "Rotherham, opened 2021" },
  { quote: "I drew nothing for five months and I had been told to expect four. That was the only figure they got wrong and it was the one I had planned around.", name: "Aisha Kabir", role: "Sheffield South, opened 2023" },
  { quote: "Head office rings on a Tuesday. Not to sell me anything, just to ask how it went. Four years and they have never missed one.", name: "Tom Bramall", role: "Barnsley, opened 2022" },
];
function P() {
  return (
    <SiteChrome name="Fettle Mobile Servicing" tagline="Van-based bike and e-bike servicing. Nine territories, four still free."
      links={[{ label: "Territories", href: "/territories" }, { label: "The process", href: "/process" }, { label: "The numbers", href: "#numbers" }]}
      action={{ label: "Which areas are free?", href: "/territories" }}>

      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid items-start gap-12 lg:grid-cols-[1fr_1.15fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Since 2019 · 5 open · 3 free · 1 resale</p>
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">
                It is not £14,995
              </h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                That is the franchise fee, and it is what every website in this industry puts in the
                headline. The number you actually need is between fifty-five and seventy thousand,
                and it is added up beside this rather than arrived at in the third meeting.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <a className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" href="/territories">See which areas are free</a>
                <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="/process">How it works</a>
              </div>
              <div className="mt-10">
                <SafeImage src={null} alt="A franchisee's van in Rotherham" ratio="16/9" />
              </div>
            </div>
            {/* THE TOTAL, COMPUTED, with the exclusions beside it rather than
                discovered in month four. */}
            <InvestmentTable lines={COSTS} excludes={EXCLUDES} fundablePercent={70}
              note="These are the real figures from the last three openings, not a model. The two ranges are ranges because a van and six months of runway genuinely vary — everything fixed is stated as a single number." />
          </div>
        </div>
      </section>

      <section id="numbers" className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="The numbers" title="What five vans actually did last year"
          description="Averaged across the network, not the best one. Every franchisor quotes its top performer and calls it typical; this is the mean and the range is stated underneath." />
        <StatsBand className="mt-8" items={[
          { label: "Average turnover, year two", value: "£118,000" },
          { label: "Average owner's drawings", value: "£41,000" },
          { label: "Jobs a week, average van", value: "22" },
          { label: "Network retention since 2019", value: "5 of 5" },
        ]} />
        <p className="mt-6 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          The range behind those averages is wide and worth knowing: turnover in year two ran from
          £86,000 to £147,000 across the five, and drawings from £29,000 to £58,000. The lowest was
          a territory with a bad first winter and it is now the second-best. We will give you all
          five sets of figures and both franchisees' phone numbers before you sign anything.
        </p>
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <PaybackNote months={26} cost={62000} unitLabel="£" savingPer="£2,400 a month drawn above what the same person earns employed" />
          <BreakEvenNote units={14} unitNoun="jobs a week" revenue={1680} atCurrentRate="reached in month five on all five vans" />
        </div>
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <SectionHeader eyebrow="Where" title="Three free, two under offer"
                description="Published, because somebody in Doncaster should be able to find out in four seconds rather than after a form and three days." />
              <TerritoryList className="mt-8" territories={TERRITORIES} />
            </div>
            <div>
              <SectionHeader eyebrow="From the network" title="Including the bit we got wrong" />
              <TestimonialGrid className="mt-8" columns={1} items={QUOTES} />
              <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
                All five franchisees will take a call from you, unaccompanied, before you commit —
                including the one whose first winter was bad. Any franchisor unwilling to arrange
                that is telling you something.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <div className="max-w-3xl">
          <SectionHeader eyebrow="Asked often" title="The questions worth asking any franchisor" />
          <Faq className="mt-6" items={[
            { question: "What are the ongoing fees?", answer: "8% of turnover as a management service fee, plus 2% into the national marketing fund. Both on turnover, not profit, and both charged monthly on what you actually invoiced. There is no minimum." },
            { question: "How long is the term?", answer: "Five years, renewable for five more at no fee. You can sell the business in that time and we have to approve the buyer, which we have never refused." },
            { question: "Do I have to buy stock from you?", answer: "Parts and consumables, yes — that is where the group buying is and it is roughly 30% below trade. Everything else, anywhere you like." },
            { question: "What if it does not work?", answer: "Three of the four ways out are in the agreement: sell it, hand the territory back after year two with 90 days' notice, or let it lapse at renewal. The fourth is that we buy the van back at book value, which we have done once." },
            { question: "Can I do this part-time?", answer: "No, and we will turn down anybody who intends to. Twenty-two jobs a week is a full week, and a territory run at half effort is a territory nobody else can have." },
            { question: "How many enquiries become franchisees?", answer: "About one in forty. Most of the other thirty-nine stop at the number on this page, which is exactly why it is on this page." },
          ]} />
        </div>
      </section>
    </SiteChrome>
  );
}
