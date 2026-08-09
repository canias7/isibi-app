// apprenticeship /apply — the steps, and what happens in the gap between
// applying and starting.
//
// THAT GAP IS WHERE PEOPLE ARE LOST. Six weeks of silence between an
// application and a start date is normal in this sector, and to a nineteen
// year old it is indistinguishable from a rejection. Naming each week and who
// is doing what is not a nicety; it is the retention intervention.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { ChecklistDot } from "@/components/ui/checklist-dot";
import { EligibilityCheck } from "@/components/ui/eligibility-check";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/apply")({ component: P });

const STEPS = [
  { n: "1", when: "Day one", what: "Ring or fill in the form", detail: "Ten minutes. We check funding eligibility on that call and tell you straight away — not after a week of consideration." },
  { n: "2", when: "Within five days", what: "An initial assessment", detail: "Ninety minutes here, or online. English and maths at your current level, and a conversation about what you want. It is not an exam and you cannot fail it." },
  { n: "3", when: "Week two", what: "We confirm the funding route", detail: "This is the week that decides whether it is free, 5% to an employer, or not fundable. If it is the last one we say so and suggest something else." },
  { n: "4", when: "Weeks two to five", what: "Employer matching, for apprenticeships only", detail: "We hold vacancies from about forty employers. Interviews are arranged by us and we prepare you for them. Nobody is sent cold." },
  { n: "5", when: "Week five or six", what: "Enrolment", detail: "Paperwork, your training plan, and the first date. About two hours and a parent or partner is welcome." },
  { n: "6", when: "Week six onwards", what: "You start", detail: "Cohorts begin monthly, so the wait is never longer than four weeks from enrolment." },
];

function P() {
  return (
    <SiteChrome
      name="Attercliffe Skills"
      tagline="Six steps, six weeks, and what happens in each of them."
      links={[
        { label: "Eligibility", href: "/" },
        { label: "All courses", href: "/courses" },
      ]}
      action={{ label: "Ring 0114 244 1180", href: "tel:01142441180" }}
    >
      <div className="mx-auto max-w-4xl px-6 py-14">
        <h1 className="text-4xl font-semibold tracking-tight text-balance">Applying</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          About six weeks from the first phone call to a start date. Every week has something in it
          and somebody responsible for it — a month of silence is how people conclude they have
          been turned down without being told.
        </p>

        <section className="mt-12">
          <SectionHeader eyebrow="The six weeks" title="Who is doing what, and when" />
          <ol className="mt-6 divide-y divide-border border-y border-border">
            {STEPS.map((s) => (
              <li key={s.n} className="flex gap-5 py-5">
                <span className="w-6 shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">{s.n}</span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-3">
                    <p className="font-medium">{s.what}</p>
                    <p className="text-sm text-muted-foreground">{s.when}</p>
                  </div>
                  <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">{s.detail}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            If you have not heard from us in the week you were told to expect something, ring. It
            will be our fault rather than yours and we would far rather be chased.
          </p>
        </section>

        <section className="mt-14">
          <div className="grid items-start gap-10 lg:grid-cols-[1fr_1fr]">
            <div>
              <SectionHeader
                eyebrow="Where most people are"
                title="Three of the five documents"
                description="Missing certificates are replaceable — about £45 from the exam board and three weeks. Start that today rather than in week five."
              />
              <div className="mt-6 max-w-xs rounded-xl border border-border p-6">
                <p className="text-sm font-medium">A typical applicant</p>
                <div className="mt-4">
                  <ChecklistDot done={3} total={5} />
                </div>
              </div>
            </div>
            <EligibilityCheck
              criteria={[
                { id: "a", label: "16 or over", met: true },
                { id: "b", label: "Right to work in the UK", met: true },
                { id: "c", label: "Resident in England for three years", met: true },
                { id: "d", label: "Not already qualified at this level", detail: "Exceptions apply for a genuine change of occupation — ask rather than assume." },
                { id: "e", label: "For an apprenticeship: a job of 16+ hours", detail: "We can match you to one. That is steps four and five above." },
              ]}
              indicative
              applyNote="Every one of these is checked on the first phone call. Nobody gets to week five and then finds out."
            />
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader
            eyebrow="If the answer is no"
            title="We will tell you why, and where else to go"
            description="About one in six enquiries is not fundable with us. That is a fact about the rules rather than about the person, and it should come with a next step."
          />
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">Already qualified at that level</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Often solvable — a different occupation or a higher level is usually fundable. Ask
                before assuming a degree rules you out, because it usually does not.
              </p>
            </div>
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">Outside South Yorkshire</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Bootcamps are boundaried; apprenticeships are not. We will name the provider nearest
                to you rather than leave you searching.
              </p>
            </div>
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">No employer, and not eligible for a bootcamp</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                The council's employment service and the Jobcentre both run routes we do not. We
                will make the referral rather than hand you a leaflet.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader title="Applying questions" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "Is there a deadline?",
                  answer: "No. Cohorts start monthly and we enrol continuously. The bootcamps are the exception — those have fixed start dates, four times a year.",
                },
                {
                  question: "Do I need a CV?",
                  answer:
                    "Not to apply to us. You will need one for an employer interview and we write it with you in step four. Turning up without one is completely normal.",
                },
                {
                  question: "I have been out of education a long time.",
                  answer:
                    "The average age of our adult learners is 34. The initial assessment exists precisely so nobody is placed on something they will struggle with, and it is not a test you can fail.",
                },
                {
                  question: "What support is there if I have a learning difficulty?",
                  answer:
                    "Tell us at the assessment. Extra time, a reader, coloured overlays, assistive software and one-to-one support are all funded and none of it needs a formal diagnosis to start.",
                },
              ]}
            />
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            <a className="underline underline-offset-4" href="/">Eligibility and courses</a>
            {" · "}
            <a className="underline underline-offset-4" href="/courses">Entry requirements in full</a>
          </p>
        </section>
      </div>
    </SiteChrome>
  );
}
