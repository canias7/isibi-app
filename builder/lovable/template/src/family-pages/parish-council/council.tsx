// parish-council /council — councillors, the two vacancies, and what the
// precept costs on YOUR band. A council publishing only the Band D figure is
// the norm and it means most residents cannot work out their own.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { CommitteeList } from "@/components/ui/committee-list";
import { DownloadCard } from "@/components/ui/download-card";
import { Faq } from "@/components/ui/faq";
import { PriceList } from "@/components/ui/price-list";
import { SectionHeader } from "@/components/ui/section-header";
export const Route = createFileRoute("/council")({ component: P });
// Band D is what a council sets; the other seven are fixed statutory ratios of
// it (A 6/9 … H 18/9). Derived here rather than typed, so the eight can never
// disagree with the one the council actually voted on.
const BAND_D = 41.60;
const RATIOS: [string, number][] = [
  ["A", 6 / 9], ["B", 7 / 9], ["C", 8 / 9], ["D", 1],
  ["E", 11 / 9], ["F", 13 / 9], ["G", 15 / 9], ["H", 2],
];
function P() {
  return (
    <SiteChrome name="Bolsterstone Parish Council" tagline="Eleven councillors, one clerk, and a precept of £34,000 a year."
      links={[{ label: "Home", href: "#/" }, { label: "Papers", href: "#/papers" }]}
      action={{ label: "Next meeting", href: "#/#next" }}>

      <div className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="The council" title="Nine councillors, two vacancies, one clerk"
          description="Nobody is paid except the clerk. The vacancies are filled by co-option rather than an election, which means the council chooses — and which is why it is worth somebody asking." />

        <section className="mt-10 grid gap-12 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <CommitteeList posts={[
              { id: "chair", role: "Chair", holder: "Cllr Margaret Naylor", termEnds: "May 2027", about: "Runs the meeting, signs the minutes, and is the one who decides whether an item is urgent enough to take late." },
              { id: "vice", role: "Vice-chair", holder: "Cllr Peter Ramsden", termEnds: "May 2027", about: "Chairs when the chair cannot, and holds the play area and open spaces brief." },
              { id: "planning", role: "Planning lead", holder: "Cllr Sue Whitworth", termEnds: "May 2027", about: "Reads every application that lands in the parish — about forty a year — and drafts the council's response." },
              { id: "finance", role: "Finance lead", holder: "Cllr Iain Petrie", termEnds: "May 2027", about: "Checks the bank reconciliation monthly and presents the budget in January." },
              { id: "allot", role: "Allotments", holder: "Cllr Deborah Kaur", termEnds: "May 2027", about: "Thirty-two plots and a waiting list of eleven. Inspects twice a year." },
              { id: "hall", role: "Village hall representative", holder: "Cllr Tom Bramley", termEnds: "May 2027" },
              { id: "tree", role: "Tree warden", holder: "Cllr Alan Shirtcliffe", termEnds: "May 2027", about: "Statutory consultee on any tree work in the conservation area." },
              { id: "foot", role: "Footpaths", holder: "Cllr Yvonne Best", termEnds: "May 2027", about: "Walks all nine rights of way twice a year and reports blockages to the city council." },
              { id: "emerg", role: "Emergency plan", holder: "Cllr Raj Mistry", termEnds: "May 2027", about: "Keeps the flood and snow plan, and the list of who has a 4x4." },
              { id: "v1", role: "Councillor (vacant)", termEnds: "May 2027" },
              { id: "v2", role: "Councillor (vacant)", termEnds: "May 2027" },
            ]} />
            <div className="mt-8 rounded-lg border border-border bg-muted/50 p-5">
              <p className="text-base font-medium">Putting yourself forward</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Write to the clerk saying why, in as many or as few words as you like. Come to the
                September meeting and talk for five minutes. The council votes the same evening and
                you are a councillor from that moment. You need to be on the electoral register and
                to live or work within three miles — that is the whole eligibility test.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                It is about four hours a month. There is no pay, no allowance, and you will have to
                publish a register of interests. Two of the nine had never been to a meeting before
                the one where they were co-opted.
              </p>
            </div>
          </div>

          <div>
            <SectionHeader eyebrow="The precept" title="What it costs you, on your own band"
              description="Councils publish the Band D figure and nothing else, so most residents cannot work out their own. All eight are here, computed from the Band D the council actually voted on." />
            <PriceList className="mt-6" items={RATIOS.map(([band, r]) => ({
              name: `Band ${band}`,
              price: Math.round(BAND_D * r * 100) / 100,
              meta: band === "D" ? "The figure councils publish" : undefined,
              description: band === "A" ? "About two thirds of the houses in this parish" : undefined,
            }))} />
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              A year, not a month. It is the parish part of your council tax bill and it appears as
              a separate line on it — everything else on that bill goes to Sheffield City Council,
              the police and the fire service, and none of it comes here.
            </p>

            <h2 className="mt-8 text-sm font-medium uppercase tracking-widest text-muted-foreground">Where the £34,000 goes</h2>
            <PriceList className="mt-3" items={[
              { name: "Clerk's salary and payroll", price: 11400, description: "Twelve hours a week at the national scale, plus employer's NI and pension" },
              { name: "Grass cutting and the verges", price: 5800, meta: "Six cuts a year" },
              { name: "Play area — inspection, repairs, insurance", price: 4200 },
              { name: "Grants to village groups", price: 4000, description: "Applied for, decided in public, and £1,350 committed so far this year" },
              { name: "Insurance, audit and subscriptions", price: 3900, description: "Includes the external auditor and the parish councils' association" },
              { name: "Village hall contribution", price: 2400 },
              { name: "Christmas lights, defibrillator, noticeboards", price: 1500 },
              { name: "Contingency, held in reserve", price: 800, description: "The council holds about six months' running costs, which is what the auditor expects" },
            ]} />
            <div className="mt-6 space-y-3">
              <DownloadCard name="Budget 2026-27.pdf" size={140_000}
                description="Set in January, in public, line by line" href="#/papers" />
              <DownloadCard name="Annual governance and accountability return.pdf" size={310_000}
                description="Last year's, with the external auditor's certificate" href="#/papers" />
              <DownloadCard name="Register of members' interests.pdf" size={88_000}
                description="All nine councillors. Required, and published in full" href="#/council" />
            </div>
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="max-w-3xl">
            <SectionHeader eyebrow="Asked often" title="About the money and the council" />
            <Faq className="mt-6" items={[
              { question: "Can you put the precept up as much as you like?", answer: "Legally, at parish level, yes — the referendum cap that applies to district and county councils does not apply to us. That is precisely why the budget is set in public in January and why every line of it is on this page." },
              { question: "Why is my band different from my neighbour's?", answer: "Bands were set on 1991 values and never revalued, so two identical houses can sit in different ones. It is the Valuation Office Agency's to change, not ours, and there is an appeal route on their site." },
              { question: "Do councillors claim expenses?", answer: "They may, and last year the total claimed was £41 — one train fare to a training day. There is no allowance and no attendance payment." },
              { question: "Can I see the invoices?", answer: "Yes. There is a statutory period every summer when any resident can inspect every invoice, receipt and bank statement, and the dates go on the noticeboard. Outside that, ask the clerk and she will show you anything." },
              { question: "What does the clerk actually do?", answer: "Everything that is not a decision: agendas, minutes, payroll, the audit, the correspondence, the contracts, and knowing which of the things people raise are ours. Twelve paid hours a week and, realistically, rather more than that." },
              { question: "How do I complain about a councillor?", answer: "Conduct complaints go to Sheffield City Council's monitoring officer, not to us — a council cannot investigate itself. There is a form on their website and we will give you the link rather than talk you out of it." },
            ]} />
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
