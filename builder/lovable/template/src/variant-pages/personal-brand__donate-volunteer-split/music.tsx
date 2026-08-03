// personal-brand/donate-volunteer-split /music — the family's third page is
// "the work itself — a musician's site without the music is a CV". The campaign
// analogue is exact and it is the page most campaigns do not have: what the
// money has actually done, and what it will do next.
//
// A campaign asking for two things has to answer this twice, and the second
// answer is the one nobody publishes: what the VOLUNTEER hours went on. Time is
// treated as free and so it is never accounted for, which is how people end up
// doing 41 shifts of something that turned out not to matter.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { BarList } from "@/components/ui/bar-list";
import { Faq } from "@/components/ui/faq";
import { ImpactStats } from "@/components/ui/impact-stat";
import { ProgressStack } from "@/components/ui/progress-stack";
import { PullQuote } from "@/components/ui/pull-quote";
import { SectionHeader } from "@/components/ui/section-header";
export const Route = createFileRoute("/music")({ component: P });
const SPENT = [
  ["Structural survey, May 2026", "£8,400", "Wallace & Kerr. The one that took the roof figure from £240k to £180k, and it paid for itself sixty times over"],
  ["Structural survey, Oct 2023", "£6,900", "The first one. Superseded and published anyway — it is the reason anybody believes the second"],
  ["Business plan and financial modelling", "£4,200", "Required by the council. Written by an accountant who charged us a third of her rate"],
  ["Legal — CIO registration and the transfer", "£3,850", "Includes the clause that returns your money if the bid fails"],
  ["Making the building safe to enter", "£2,640", "Props in the boiler room, a temporary tarpaulin, and the hire of the tower"],
  ["Printing, stall, postage", "£1,310", "12,000 leaflets and a gazebo that has now done 47 Saturdays"],
  ["Insurance", "£980", "Public liability, because volunteers are in the building"],
];
const SPENT_TOTAL = 28280;
function P() {
  return (
    <SiteChrome name="Save Cotton Mill Baths" tagline="A community bid for the 1904 baths on Bury New Road. Closed 2019. Not demolished yet."
      links={[{ label: "Give or volunteer", href: "#/" }, { label: "The press kit", href: "#/press" }]}
      action={{ label: "Give", href: "#/" }}>

      <div className="mx-auto max-w-6xl px-6 py-12">
        <SectionHeader eyebrow="The accounts" title="£28,280 has been spent. Here is every pound of it."
          description="Of £112,400 raised, £84,120 is untouched and sits with the trust. The rest has gone on the seven things below, and one of them was a survey that told us something we did not want to hear." />

        <div className="mt-9">
          <ProgressStack unit="£" segments={[
            { label: "Spent, itemised below", value: 28280, tone: "done" },
            { label: "Held for the roof", value: 84120, tone: "active" },
            { label: "Still to raise", value: 67600, tone: "rest" },
          ]} />
        </div>

        <section className="mt-12 grid gap-12 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <SectionHeader eyebrow="Money" title="The seven things" />
            <div className="mt-6 overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-widest text-muted-foreground">
                    <th scope="col" className="py-2 pr-4 font-medium">What</th>
                    <th scope="col" className="py-2 text-right font-medium">Spent</th>
                  </tr>
                </thead>
                <tbody>
                  {SPENT.map(([k, v, note]) => (
                    <tr key={k} className="border-b border-border/60 align-baseline">
                      <th scope="row" className="py-3 pr-4 text-left font-[inherit]">
                        <span className="font-medium">{k}</span>
                        <span className="block text-xs leading-relaxed text-muted-foreground">{note}</span>
                      </th>
                      <td className="py-3 text-right tabular-nums">{v}</td>
                    </tr>
                  ))}
                  <tr className="border-b-2 border-foreground align-baseline">
                    <th scope="row" className="py-3 pr-4 text-left text-base font-semibold">Spent to date</th>
                    <td className="py-3 text-right text-base font-semibold tabular-nums">
                      £{SPENT_TOTAL.toLocaleString("en-GB")}
                    </td>
                  </tr>
                  <tr className="align-baseline">
                    <th scope="row" className="py-3 pr-4 text-left text-base font-semibold">Nobody has been paid anything</th>
                    <td className="py-3 text-right text-base font-semibold tabular-nums">£0</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              No trustee, no volunteer and no member of anybody's family has taken a fee, an
              expense or a mileage claim. That will change if the transfer succeeds — running a
              building needs a paid caretaker and we have budgeted one at £24,000 — and we would
              rather say so now than have somebody find it in year two.
            </p>

            <div className="mt-10">
              <SectionHeader eyebrow="Hours" title="And the half nobody publishes"
                description="4,180 volunteer hours since February. At the living wage that is £52,000 of work, which is not a number to be proud of on its own — it only means something alongside what it produced." />
              <div className="mt-6">
                <BarList
                  items={[
                    { label: "Door knocking and the stall", value: 1840 },
                    { label: "Clearing and making safe", value: 960 },
                    { label: "Phoning donors to say thank you", value: 610 },
                    { label: "Writing the bid and the business plan", value: 430 },
                    { label: "Meetings, minutes, the boring half", value: 340 },
                  ]}
                  valueLabel={(n) => `${n.toLocaleString("en-GB")} hrs`} />
              </div>
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                The 340 hours of meetings is the line we get asked about. It is high and it is not
                waste — a community asset transfer is a legal process with a paper trail, and the
                reason the council is taking this bid seriously is that every one of those meetings
                produced minutes somebody can check.
              </p>
              <div className="mt-6">
                <PullQuote>
                  We wasted about six hundred hours in 2025 on a petition that changed nothing. It
                  is on this page because a campaign that only publishes its wins is asking you to
                  trust it on the rest.
                </PullQuote>
              </div>
            </div>
          </div>

          <div>
            <SectionHeader eyebrow="What it bought" title="Four things that would not exist otherwise" />
            <div className="mt-6">
              <ImpactStats columns={1} items={[
                { value: "£60,000", meaning: "Knocked off the roof estimate by paying for a second survey", period: "May 2026", source: "Wallace & Kerr report, p.14" },
                { value: "1,340", meaning: "Donors, from 12,000 leaflets and 47 Saturdays on the market", period: "Feb–Aug 2026", source: "Trust donation ledger" },
                { value: "268", meaning: "Volunteers named, against the council's condition of 400", period: "as at 1 August", source: "Volunteer register" },
                { value: "0", meaning: "Days the building has been open to the public. This is the point of all of it", period: "since March 2019", source: "Council records" },
              ]} />
            </div>

            <div className="mt-8 rounded-lg border border-border bg-muted/50 p-5">
              <p className="text-base font-medium">What the remaining £67,600 is for</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Nothing else. It is the roof, and the roof number came from a survey we published.
                If the transfer is approved and the works come in under, the difference goes into
                the reopening fund and we will publish that too. If they come in over, we will say
                so before we spend it.
              </p>
            </div>

            <div className="mt-8 rounded-lg border border-border p-5">
              <p className="text-base font-medium">If the bid fails on 14 October</p>
              <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-muted-foreground">
                <li>The £84,120 held goes back to donors, pro rata, within 60 days.</li>
                <li>The £28,280 already spent is gone and cannot be returned. It bought the surveys and the legal work, and it is why this bid exists at all.</li>
                <li>Every donor is told which of those two applies to their gift before they give — the figure is on the donation page and it moves as we spend.</li>
                <li>The trust dissolves. Its remaining assets go to Sedgley Community Association, named in the constitution.</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="max-w-3xl">
            <SectionHeader eyebrow="Asked often" title="About the money, which is the right thing to ask about" />
            <Faq className="mt-6" items={[
              { question: "Why did you pay for two surveys?", answer: "The first said £240,000 and we could not raise that. We paid £8,400 for a second opinion knowing it might confirm the first, and it came back £180,000 because the engineer got into the roof void the first one had not opened. Both are published, including the expensive one that nearly ended this." },
              { question: "Who checks the accounts?", answer: "The CIO files with the Charity Commission annually and an independent examiner reviews them — Beckett Hyde, who are doing it for nothing. The ledger on this page is updated monthly and it is the same one the examiner sees." },
              { question: "Is any of this money going to salaries?", answer: "None of it, and none has. If the transfer succeeds the operating budget includes a caretaker at £24,000 and a part-time manager at £16,000 — both in the business plan, published, and neither is a trustee or related to one." },
              { question: "What about Gift Aid?", answer: "£19,200 claimed so far and it is not in the £112,400 on the front page, deliberately. We count what people gave rather than inflating the figure with tax relief. It sits in the roof fund with everything else." },
              { question: "Why publish the hours you wasted?", answer: "Because a campaign that only publishes wins is asking to be trusted on everything it does not mention. The 2025 petition took about six hundred hours and achieved nothing, and knowing that is how we stopped doing it." },
              { question: "Can I give to something specific?", answer: "No, and we would rather explain why than pretend otherwise. Restricted gifts sound accountable and in a small charity they create money that cannot be spent on the thing that is actually urgent. Everything goes to the roof until the roof is paid for." },
            ]} />
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
