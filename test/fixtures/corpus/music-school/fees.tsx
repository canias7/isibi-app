// music-school /fees — PER TERM, because that is how the bill arrives.
//
// An hourly rate on a school that bills termly is a number nobody is ever
// charged, and it makes an honest school look twice the price of a dishonest
// one. The termly figure is the headline and the hourly equivalent is the
// footnote, which is the opposite of the convention.
//
// THE BURSARY IS DESCRIBED IN FULL, including that teachers are not told who
// holds one. A means-tested fund nobody applies to because the page implies it
// is exceptional is a fund that does nothing.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { FeeTable } from "@/components/ui/fee-table";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/fees")({ component: P });

const EXTRAS = [
  { what: "Instrument loan", cost: "£30 refundable deposit", detail: "Any instrument, any size, for as long as a child learns here. Insurance is ours. Lost or badly damaged is discussed rather than invoiced." },
  { what: "Ensembles", cost: "Free", detail: "All eight of them, for anybody having lessons here. The junior choir is free to anybody at all." },
  { what: "Exam entry", cost: "At cost, £47 to £108", detail: "ABRSM and Trinity set these and we pass them straight on. The accompanist for a practical exam is £35." },
  { what: "Sheet music", cost: "Roughly £25 a year", detail: "Bought as needed. Second-hand copies circulate in the office and are free to take." },
  { what: "Concerts", cost: "Free to perform, £4 to watch", detail: "Three a year at the chapel. Family tickets are £10 and nobody is turned away for not having one." },
  { what: "The summer tour", cost: "£180 to £340", detail: "Optional, senior ensembles only, every second year. The hardship fund covers it in full for anybody who needs it." },
];

function P() {
  return (
    <SiteChrome
      name="The Rivelin Music School"
      tagline="Per term, which is how you will be billed."
      links={[
        { label: "Instruments", href: "/" },
        { label: "Lessons", href: "/lessons" },
        { label: "Timetable", href: "/timetable" },
      ]}
      action={{ label: "Book a taster", href: "/lessons" }}
    >
      <div className="mx-auto max-w-5xl px-6 py-14">
        <h1 className="text-4xl font-semibold tracking-tight text-balance">Fees</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Quoted per term, because a term is what you will be invoiced for. Anywhere you see an
          hourly rate on a music school's website, multiply by ten or eleven — that is the number
          that arrives.
        </p>

        <section className="mt-12">
          <SectionHeader
            eyebrow="Autumn term 2026"
            title="Eleven weeks, invoiced in September"
            description="Spring is ten weeks and summer is eleven, and each is billed for the weeks it actually has rather than an average."
          />
          <div className="mt-8">
            <FeeTable
              caption="One-to-one lessons, autumn term, eleven weeks."
              note="Two children from one household take 10% off the second and every subsequent set of fees. It is applied automatically and you do not have to ask."
              rows={[
                { band: "Beginner to Grade 3", pattern: "30 minutes weekly", hoursPerWeek: 0.5, pricePerWeek: 13 },
                { band: "Beginner to Grade 3", pattern: "45 minutes weekly", hoursPerWeek: 0.75, pricePerWeek: 19.5 },
                { band: "Grade 4 to 6", pattern: "30 minutes weekly", hoursPerWeek: 0.5, pricePerWeek: 15 },
                { band: "Grade 4 to 6", pattern: "45 minutes weekly", hoursPerWeek: 0.75, pricePerWeek: 22.5 },
                { band: "Grade 7, 8 and diploma", pattern: "45 minutes weekly", hoursPerWeek: 0.75, pricePerWeek: 27 },
                { band: "Grade 7, 8 and diploma", pattern: "60 minutes weekly", hoursPerWeek: 1, pricePerWeek: 36 },
                { band: "Beginner group of two or three", pattern: "30 minutes weekly", hoursPerWeek: 0.5, pricePerWeek: 7 },
              ]}
            />
            {/* NO `funding` prop. FeeTable's is a nursery's FUNDED-HOURS column
                — hours per week against qualifying bands — and a bursary is a
                percentage discount on any of them. Forcing one into the other
                would have printed a column of numbers that mean something else.
                The bursary has its own section below, where it can be described
                properly. */}
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              A bursary reduces every figure in this table by between 25% and 100%. A third of
              pupils hold one and it is described in full below.
            </p>
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader
            eyebrow="Everything else"
            title="Six other things that cost money, and four of them do not"
            description="Listed so nobody is surprised in November by an exam entry or a concert ticket."
          />
          <ul className="mt-6 divide-y divide-border border-y border-border">
            {EXTRAS.map((e) => (
              <li key={e.what} className="grid gap-1 py-4 md:grid-cols-[minmax(0,13rem)_minmax(0,13rem)_1fr] md:gap-6">
                <p className="font-medium">{e.what}</p>
                <p className="text-sm tabular-nums text-muted-foreground">{e.cost}</p>
                <p className="text-sm leading-relaxed text-muted-foreground">{e.detail}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-14">
          <SectionHeader
            eyebrow="Bursaries"
            title="A third of the pupils here hold one"
            description="It is a normal thing, not an exceptional one, and the page says so because a fund nobody applies to does nothing."
          />
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">One page, no interview</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Household income and how many children. That is the form. It is read by two trustees
                and answered within a fortnight.
              </p>
            </div>
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">Teachers are not told</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Nobody in a lesson knows who holds one. The office handles it and it does not appear
                on any register a teacher sees.
              </p>
            </div>
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">It covers the extras too</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Exam entries, music and the tour, in proportion. A bursary that covers lessons and
                leaves a £340 trip unaffordable has not solved anything.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader title="Fee questions" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "Can I pay monthly?",
                  answer: "Yes, by standing order over the school year, at no extra cost. About half of families do. Ask the office and it is set up in a day.",
                },
                {
                  question: "What if we leave mid-term?",
                  answer:
                    "Half a term's notice, or half a term's fees. It is the only cancellation term we have and it exists because a teacher's hours are committed for the term.",
                },
                {
                  question: "Do fees rise every year?",
                  answer:
                    "Reviewed each June by the trustees and announced before the summer holiday, never mid-year. The last three rises were 3%, 0% and 4%.",
                },
                {
                  question: "Is there anything hidden?",
                  answer:
                    "The six lines above are everything. No registration fee, no annual membership, no charge for a report or a practice diary or a concert your own child is in.",
                },
              ]}
            />
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            <a className="underline underline-offset-4" href="/">Instruments</a>
            {" · "}
            <a className="underline underline-offset-4" href="/lessons">Lessons</a>
            {" · "}
            <a className="underline underline-offset-4" href="/timetable">The timetable</a>
          </p>
        </section>
      </div>
    </SiteChrome>
  );
}
