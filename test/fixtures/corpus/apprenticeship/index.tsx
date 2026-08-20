// apprenticeship — AM-I-ELIGIBLE-FIRST: funding rules decide more applications
// than interest does.
//
// WHO PAYS IS NAMED ON EVERY COURSE. English skills funding is a maze — the
// levy, the adult skills fund, the 19-24 rules, the free-courses-for-jobs list
// — and "fully funded for eligible learners" is the phrase every provider uses
// and nobody can act on. Saying "your employer pays £0 because they are under
// the levy threshold" is the whole job of this page.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { EligibilityCheck } from "@/components/ui/eligibility-check";
import { CohortPicker } from "@/components/ui/cohort-picker";
import { MediaGrid } from "@/components/ui/media-grid";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/")({ component: P });

const COURSES = [
  {
    name: "Level 2 Adult Care Worker",
    length: "12 months + 3 months end-point assessment",
    entry: "No qualifications needed. Employed in a care role for 16+ hours a week.",
    pays: "Employer, at 5% — about £150 total. The government funds the other 95%.",
    body: "NCFE / Skills for Care",
  },
  {
    name: "Level 3 Business Administrator",
    length: "18 months + 3 months EPA",
    entry: "Level 2 English and maths, or achieve them during the course.",
    pays: "Employer, at 5% — about £250 total, unless they pay the levy, in which case nothing.",
    body: "Pearson",
  },
  {
    name: "Level 3 Early Years Educator",
    length: "18 months + 3 months EPA",
    entry: "Level 2 English and maths ON ENTRY — this one cannot be achieved alongside. It is the most common reason we cannot take somebody.",
    body: "NCFE CACHE",
    pays: "Employer, at 5%. Under-19s are fully funded at no cost to anybody.",
  },
  {
    name: "Level 2 Certificate in Digital Skills",
    length: "16 weeks, one day a week",
    entry: "Aged 19+, living in South Yorkshire, below Level 2 in digital already.",
    pays: "Nobody. Free under the Adult Skills Fund, including if you are working.",
    body: "City & Guilds",
  },
  {
    name: "Skills Bootcamp: Warehouse and Logistics",
    length: "12 weeks, three days a week",
    entry: "Aged 19+, right to work, and unemployed or looking to change sector.",
    pays: "Nobody. Fully funded, and it includes the forklift ticket and the CSCS card.",
    body: "Skills Bootcamp / SYMCA",
  },
];

function P() {
  return (
    <SiteChrome
      name="Attercliffe Skills"
      tagline="Apprenticeships and adult training across South Yorkshire. Ofsted Good."
      links={[
        { label: "All courses", href: "/courses" },
        { label: "Apply", href: "/apply" },
        { label: "Questions", href: "#questions" },
      ]}
      action={{ label: "Check eligibility", href: "#check" }}
    >
      <section className="border-b border-border" id="check">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid items-start gap-12 lg:grid-cols-[1fr_1fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                UKPRN 10038291 · Ofsted Good, 2025 · On the APAR register
              </p>
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">
                Whether we can take you, first
              </h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                Funding rules turn away more people than lack of interest ever does, and every
                provider writes "fully funded for eligible learners" without saying who that is.
                Here is who.
              </p>
              <p className="mt-4 max-w-lg leading-relaxed text-muted-foreground">
                Every course below names who pays — you, your employer, or nobody. Three of the five
                cost the learner nothing at all and two of those cost the employer nothing either.
              </p>
            </div>

            <EligibilityCheck
              criteria={[
                { id: "age", label: "You are 16 or over", met: true },
                { id: "live", label: "You live in England", met: true, detail: "Some courses are South Yorkshire only, marked on the course." },
                { id: "work", label: "You have the right to work in the UK", met: true, detail: "And have been ordinarily resident here for three years. This one is not ours and cannot be waived." },
                { id: "job", label: "For an apprenticeship: you are employed 16+ hours a week", detail: "In a role that matches the standard. We can help an employer create one — ask." },
                { id: "level", label: "You are not already qualified at this level or above", detail: "The rule for funded adult courses. There are exceptions for a change of sector." },
              ]}
              indicative
              alternative="Not eligible for a funded place? Ring 0114 244 1180 anyway — there are three other funding routes and a hardship fund, and the person on that number knows all of them."
              applyNote="Checking costs nothing and takes ten minutes on the phone. We would rather tell you no today than in six weeks."
            />
          </div>
        </div>
      </section>

      {/* THE WORKSHOP, BECAUSE "APPRENTICESHIP" MEANS TWENTY DIFFERENT THINGS.
          A picture of the actual bay, the actual machines and the actual
          people settles whether this is a well-equipped training centre or a
          room with laptops, which is a real and unspoken worry — and it shows
          an applicant somebody who looks like them, which is most of why
          engineering intakes stay 4% female. */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <MediaGrid
            columns={4}
            ratio="4/3"
            items={[
              { src: null, alt: "The machining bay — six lathes and two CNC mills, learners at four of them", caption: "Six manual lathes, two CNC. Twelve on a cohort, so nobody queues." },
              { src: null, alt: "An electrical installation bay, stud walls wired up for testing", caption: "The 2365 rig. Every learner wires and tests a full installation." },
              { src: null, alt: "Two apprentices in a workshop looking at a drawing on a bench", caption: "One day a week here, four with the employer. That is the standard." },
              { src: null, alt: "A framed group photograph of last year's completers on the wall", caption: "2025 cohort. 31 started, 28 completed, 26 stayed with the employer." },
            ]}
          />
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <SectionHeader
            eyebrow="Running now"
            title="Five courses, and who pays for each"
            description="Entry requirements are stated as they are enforced. Where a qualification must be held ON ENTRY rather than achieved alongside, that is said in bold terms — it is the commonest refusal we make."
          />
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {COURSES.map((c) => (
              <article key={c.name} className="rounded-xl border border-border p-6">
                <h3 className="font-semibold">{c.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{c.length} · {c.body}</p>
                <dl className="mt-4 space-y-3">
                  <div>
                    <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Who can take it</dt>
                    <dd className="mt-0.5 text-sm">{c.entry}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Who pays</dt>
                    <dd className="mt-0.5 text-sm">{c.pays}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
          <a className="mt-6 inline-block text-sm underline underline-offset-4" href="/courses">
            Every course, with the full entry requirements
          </a>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <SectionHeader
            eyebrow="What happened to the last lot"
            title="Achievement by cohort, including the one still running"
            description="Published per cohort rather than as a headline average, because a provider quoting one number across five years is hiding the bad year inside it."
          />
          <div className="mt-8 max-w-xl">
            <CohortPicker
              label="Cohort"
              value="2024-25"
              onChange={() => {}}
              smallBelow={30}
              cohorts={[
                { id: "2022-23", label: "2022–23", definition: "Achievement 71%, national average 54%", size: 148 },
                { id: "2023-24", label: "2023–24", definition: "Achievement 68%, national average 55%", size: 162 },
                { id: "2024-25", label: "2024–25", definition: "Achievement 74%, national average 56%", size: 171 },
                { id: "2025-26", label: "2025–26", definition: "Still running — 119 on programme, 4 withdrawn", size: 123, incomplete: true },
              ]}
            />
          </div>
          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            The current cohort is marked incomplete because quoting an achievement rate for people
            who have not finished is the oldest trick in this sector.
          </p>
        </div>
      </section>

      <section id="questions">
        <div className="mx-auto max-w-3xl px-6 py-14">
          <SectionHeader title="Before applying" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "I do not have an employer. Can I still do an apprenticeship?",
                  answer:
                    "Not directly — an apprenticeship is a job with training and it needs the job first. We hold vacancies from about forty local employers and will put you forward, and the bootcamps need no employer at all.",
                },
                {
                  question: "What does the employer actually pay?",
                  answer:
                    "Nothing if they pay the apprenticeship levy — it comes out of a pot they have already paid into. Otherwise 5% of the funding band, typically £150 to £400 across the whole programme. Both are far less than employers expect.",
                },
                {
                  question: "Do I get paid?",
                  answer:
                    "Yes. The apprentice minimum wage is the floor and most of our employers pay well above it. Training time — usually one day a week — is paid working time by law.",
                },
                {
                  question: "I already have a degree.",
                  answer:
                    "That does not rule you out. You can do a funded apprenticeship at a lower level in a different occupation; it is one of the most misunderstood rules in the system.",
                },
              ]}
            />
          </div>
        </div>
      </section>
    </SiteChrome>
  );
}
