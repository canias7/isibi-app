// allotment — PLOT-AVAILABILITY-FIRST, with the wait stated as a real number.
//
// "THERE IS A WAITING LIST" IS NOT AN ANSWER. Somebody deciding whether to put
// their name down needs to know whether it is nine months or nine years, and
// almost every association says the former sentence and knows the latter
// number. Publishing how many are ahead and how many came up last year lets a
// person make a decision instead of hoping.
//
// AND THE CULTIVATION RULE, EARLY. A plot lost for neglect is the commonest
// unhappy ending here, and people take one on with no idea it is six hours a
// week in May.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { WaitingListPlace } from "@/components/ui/waiting-list-place";
import { WaitlistForm } from "@/components/ui/waitlist-form";
import { FeeTable } from "@/components/ui/fee-table";
import { ProduceCalendar } from "@/components/ui/produce-calendar";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/")({ component: P });

function P() {
  return (
    <SiteChrome
      name="Hollin Busk Allotments"
      tagline="112 plots above Stocksbridge, held on a lease from the parish council since 1919."
      links={[
        { label: "The plots", href: "#/plots" },
        { label: "The rules", href: "#/rules" },
        { label: "Questions", href: "#questions" },
      ]}
      action={{ label: "Join the waiting list", href: "#list" }}
    >
      <section className="border-b border-border">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <h1 className="max-w-3xl text-5xl font-semibold tracking-tight text-balance">
            Twenty months, and there are 31 people ahead of you
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            That is the honest answer rather than "there is a waiting list", which is what most
            associations say and which tells nobody whether to bother. Nineteen plots came up last
            year and the list has been between 25 and 40 for a decade — twenty months is those two
            numbers divided, not a feeling.
          </p>

          <div className="mt-10 grid items-start gap-10 lg:grid-cols-[1.1fr_1fr]">
            <WaitingListPlace
              forWhat="A full or half plot at Hollin Busk"
              ahead={31}
              total={44}
              freedLastYear={19}
              movers={[
                { what: "Take a half plot as well as a full one", effect: "Roughly halves it" },
                { what: "Take an overgrown plot", effect: "Several people will not" },
                { what: "Start at short notice in autumn", effect: "When most are given up" },
                { what: "Live in Stocksbridge or Deepcar", effect: "The parish lease, not us" },
              ]}
              contact="secretary@hollinbuskallotments.org.uk, or Ray on 0114 288 4419"
            />
            <div>
              <div className="rounded-xl border border-border p-6">
                <p className="text-sm font-medium">Joining the list</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Free, no obligation, and you can turn a plot down twice before going to the back.
                  We write once a year to ask whether you still want to be on it.
                </p>
                <div className="mt-5" id="list">
                  <WaitlistForm
                    onSubmit={() => {}}
                    note="We will email if something frees up, and once a year to check you still want to be on the list. Nothing else, ever."
                  />
                </div>
              </div>
              <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
                Living in Stocksbridge or Deepcar moves you up. That is in the parish council's
                lease rather than our preference, and we would tell you where you stand honestly at
                any point.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* THE CULTIVATION RULE, EARLY, BECAUSE IT IS THE UNHAPPY ENDING. */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <SectionHeader
            eyebrow="Before you put your name down"
            title="A full plot is about six hours a week from April to September"
            description="This is the thing people are not told, and neglect is why plots are taken back. Nobody enjoys doing that and it happens three or four times a year."
          />
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">April to September</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Six hours a week on a full plot, three on a half. Twice a week is better than once —
                a fortnight in June and the weeds have won.
              </p>
            </div>
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">October to March</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Almost nothing. A few hours a month clearing and planning. The winter is the
                pleasant part and it is when most people fall in love with it.
              </p>
            </div>
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">The rule itself</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Three quarters cultivated, inspected in June and September. A warning first, then
                three months, then it goes. We have never taken one back without two conversations.
              </p>
            </div>
          </div>
          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Take a half plot first. Everybody who has done a full one from scratch says the same
            thing, and moving up when you are ready is easy — moving down feels like a failure and
            it should not.
          </p>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <div className="grid items-start gap-10 lg:grid-cols-[1fr_1.15fr]">
            <div>
              <SectionHeader
                eyebrow="What it costs"
                title="Less than most people expect"
                description="Set by the association at the AGM, collected in October, and unchanged since 2023. There is a hardship arrangement and it is used by about a dozen people."
              />
              <p className="mt-5 max-w-lg text-sm leading-relaxed text-muted-foreground">
                Water is included and there are twelve troughs. There is no electricity on the site
                and there is not going to be — the quote was £41,000 and the members voted against
                it twice.
              </p>
            </div>
            <FeeTable
              caption="Annual rent, payable in October. Half plots are exactly half."
              note="Concession is for anyone over 65, on a means-tested benefit, or registered disabled. It is self-declared — we do not ask for evidence and we never have."
              rows={[
                { band: "Full plot, 250m²", pattern: "Standard", hoursPerWeek: 6, pricePerWeek: 0.75 },
                { band: "Full plot, 250m²", pattern: "Concession", hoursPerWeek: 6, pricePerWeek: 0.48 },
                { band: "Half plot, 125m²", pattern: "Standard", hoursPerWeek: 3, pricePerWeek: 0.38 },
                { band: "Half plot, 125m²", pattern: "Concession", hoursPerWeek: 3, pricePerWeek: 0.24 },
                { band: "Quarter plot, 60m²", pattern: "Standard — three available", hoursPerWeek: 1.5, pricePerWeek: 0.2 },
                { band: "Association membership", pattern: "Included in the rent", hoursPerWeek: 0, pricePerWeek: 0 },
              ]}
            />
          </div>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <SectionHeader
            eyebrow="What you would actually be doing"
            title="The year, month by month"
            description="Four hundred feet up and north-facing in places, so everything here runs about a fortnight behind a Sheffield garden."
          />
          <div className="mt-8">
            {/* FILLED IS WHAT YOU ARE PICKING, OUTLINE IS WHAT IS OUT OF THE
                SHED. That distinction is the whole reason a first-year plot
                feels empty in February and a third-year one does not — onions,
                squash and spuds in January are real food and they are stored,
                not growing. When to SOW is in the note beside each row, since
                it is a different question from when you eat it. */}
            <ProduceCalendar
              caption="Picked at this site specifically. Four hundred feet up, so seed packets — which assume the south of England — run about a month optimistic for us."
              items={[
                { name: "Broad beans", months: [6, 7], note: "Sow November, or February under cloches. The November sowing beats blackfly and is worth the gamble." },
                { name: "Potatoes, first early", months: [6, 7], note: "Chit in February, plant late March. Earlies dodge the blight, which arrives here most Julys." },
                { name: "Potatoes, maincrop", months: [9, 10], stored: [11, 12, 1, 2], note: "Plant April. Lift before the blight and they keep in a hessian sack until February." },
                { name: "Onions, from sets", months: [8, 9], stored: [10, 11, 12, 1, 2, 3], note: "Sets in March. Sets not seed on this clay — everybody who tried seed went back to sets." },
                { name: "Runner beans", months: [7, 8, 9], note: "Sow indoors May, out at the end of the month. The wind up here flattens an unstaked row." },
                { name: "Courgettes", months: [7, 8, 9], note: "Sow May. Two plants. Everybody plants six and regrets it by the second week of August." },
                { name: "Beetroot", months: [7, 8, 9, 10], stored: [11, 12], note: "Sow little and often, April to June." },
                { name: "Leeks", months: [11, 12, 1, 2], note: "Sow April, plant out July. The best thing on a Sheffield allotment in January by a distance." },
                { name: "Purple sprouting broccoli", months: [2, 3, 4], note: "Sow May, plant out July, wait ten months. Net it or the pigeons take the lot in December." },
                { name: "Rhubarb", months: [4, 5, 6], note: "Crowns in November. Leave it alone the first year, then it feeds you for twenty." },
                { name: "Raspberries, autumn", months: [8, 9, 10], note: "Canes in November. Autumn varieties here beat summer ones — they miss the June wind." },
                { name: "Garlic", months: [7], stored: [8, 9, 10, 11, 12, 1], note: "Plant October or November. It needs a cold spell, which is the one thing this site reliably has." },
                { name: "Squash and pumpkin", months: [9, 10], stored: [11, 12, 1], note: "Sow May. Cure them in the sun for a fortnight and they sit in a cool room until Christmas." },
              ]}
            />
          </div>
        </div>
      </section>

      <section id="questions">
        <div className="mx-auto max-w-3xl px-6 py-14">
          <SectionHeader title="What people ask before joining the list" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "Can I look round first?",
                  answer:
                    "Any Saturday morning — somebody is always in the shed by the top gate from about nine. Walk round, talk to people, and ask them honestly how much work it is. They will tell you.",
                },
                {
                  question: "What if the plot I am offered is a jungle?",
                  answer:
                    "Several are, and it is why some people turn them down. We will strim it before you take it on and there is a rotavator to borrow. The first year of a neglected plot is hard and the second is easy.",
                },
                {
                  question: "Can I share a plot?",
                  answer:
                    "Yes, and a lot of people do — it is the single best way to make a full plot manageable. One name on the tenancy, and tell us who else is involved so they can be let in.",
                },
                {
                  question: "Is it safe to leave tools there?",
                  answer:
                    "There are sheds and there have been three break-ins in six years. Nothing valuable, nothing with a petrol engine, and the site has a locked gate with a code that changes each October.",
                },
              ]}
            />
          </div>
        </div>
      </section>
    </SiteChrome>
  );
}
