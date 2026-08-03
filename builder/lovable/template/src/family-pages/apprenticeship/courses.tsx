// apprenticeship /courses — every course with its entry requirements as
// DEADLINES rather than as a wish list.
//
// `EntryRequirements` takes a `by` on every line, and that is the right shape:
// "Level 2 maths" is not a requirement, "Level 2 maths before the end-point
// assessment, or the whole thing fails" is. The distinction between what must
// be held on entry and what can be achieved alongside is the single most
// consequential fact in further education funding.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { EntryRequirements } from "@/components/ui/entry-requirements";
import { ChecklistDot } from "@/components/ui/checklist-dot";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/courses")({ component: P });

function P() {
  return (
    <SiteChrome
      name="Attercliffe Skills"
      tagline="Every course, with what must be held on entry and what can be achieved alongside."
      links={[
        { label: "Eligibility", href: "#/" },
        { label: "Apply", href: "#/apply" },
      ]}
      action={{ label: "Apply", href: "#/apply" }}
    >
      <div className="mx-auto max-w-4xl px-6 py-14">
        <h1 className="text-4xl font-semibold tracking-tight text-balance">Courses</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Each requirement says WHEN it has to be met. "Level 2 maths" on its own is not a
          requirement — whether you need it in September or by the assessment eighteen months later
          is the difference between an application we can take and one we cannot.
        </p>

        <section className="mt-12">
          <SectionHeader eyebrow="Level 3 Early Years Educator" title="The strictest one we run" />
          <div className="mt-6">
            <EntryRequirements
              heading="Before you can start"
              intro="This is the only course where English and maths must be in place on day one. It is a condition of the standard and neither we nor the employer can waive it."
              requirements={[
                { what: "GCSE English at grade 4, or Functional Skills Level 2", by: "On entry — before the start date", legal: true, detail: "Held, certificated and seen by us. The single most common reason we turn an application down." },
                { what: "GCSE maths at grade 4, or Functional Skills Level 2", by: "On entry — before the start date", legal: true },
                { what: "A paid role in an early years setting, 16+ hours", by: "On entry", detail: "Nursery, pre-school, childminder with an assistant, or a school's reception class." },
                { what: "Enhanced DBS check", by: "Before working unsupervised", legal: true, detail: "Arranged by your employer. We will chase it if it stalls, which it often does." },
                { what: "Paediatric first aid", by: "Within the first six months", detail: "We run it here, free, four times a year." },
              ]}
            />
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader eyebrow="Level 3 Business Administrator" title="Where English and maths CAN be done alongside" />
          <div className="mt-6">
            <EntryRequirements
              heading="Before you can start, and before you can finish"
              intro="The contrast with the course above. Here the qualifications can be achieved during the apprenticeship — but they gate the end-point assessment absolutely."
              requirements={[
                { what: "A paid role with administrative duties, 30+ hours", by: "On entry", detail: "The role has to genuinely match the standard. We will read a job description and say honestly." },
                { what: "Level 2 English", by: "Before the end-point assessment", legal: true, detail: "Taught here, one afternoon a fortnight, at no cost. Roughly a third of apprentices need it." },
                { what: "Level 2 maths", by: "Before the end-point assessment", legal: true, detail: "Same arrangement. Nobody has ever failed this apprenticeship for want of it and several have come close." },
                { what: "20% of working hours as off-the-job training", by: "Throughout", legal: true, detail: "A legal minimum, evidenced monthly. It is your employer's obligation as much as yours." },
              ]}
            />
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader eyebrow="Skills Bootcamp: Warehouse and Logistics" title="Twelve weeks, and nobody pays anything" />
          <div className="mt-6">
            <EntryRequirements
              heading="What is needed"
              intro="Fully funded by the South Yorkshire Mayoral Combined Authority. No employer needed and there is a guaranteed interview at the end."
              requirements={[
                { what: "Aged 19 or over", by: "On entry", legal: true },
                { what: "Living in South Yorkshire", by: "On entry", legal: true, detail: "Sheffield, Rotherham, Doncaster or Barnsley. It is the funder's boundary, not ours." },
                { what: "Right to work in the UK", by: "On entry", legal: true },
                { what: "Available three days a week for twelve weeks", by: "Throughout", detail: "Tuesday to Thursday, 09:00 to 15:30, at the Attercliffe centre. Attendance below 80% ends the funding." },
                { what: "A medical declaration for the forklift element", by: "Week three", detail: "Eyesight and a few conditions. We will tell you before you commit whether it is likely to be a problem." },
              ]}
            />
          </div>
        </section>

        <section className="mt-14">
          <div className="grid items-start gap-10 lg:grid-cols-[1.2fr_1fr]">
            <div>
              <SectionHeader
                eyebrow="What we need from you"
                title="Five documents, and most people have three of them"
                description="Bring what you have. Missing certificates can be replaced and we will help — it costs about £45 from the exam board and takes three weeks."
              />
              <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
                <li>Photo ID — passport, driving licence or a birth certificate with a bill</li>
                <li>Proof of address from the last three months</li>
                <li>National Insurance number</li>
                <li>English and maths certificates, if you have them</li>
                <li>A recent payslip, for apprenticeships only</li>
              </ul>
            </div>
            <div className="rounded-xl border border-border p-6">
              <p className="text-sm font-medium">A typical application</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Most people arrive with three of the five and we sort the rest out together.
              </p>
              <div className="mt-4">
                <ChecklistDot done={3} total={5} />
              </div>
              <a className="mt-5 inline-block text-sm underline underline-offset-4" href="#/apply">
                How applying works
              </a>
            </div>
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader title="Course questions" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "What if I fail Functional Skills?",
                  answer:
                    "You resit. There is no limit and no charge, and we keep teaching you between attempts. Nobody is removed from a programme for failing it — they are removed for not turning up to the resit.",
                },
                {
                  question: "Can I do two courses at once?",
                  answer: "Not two apprenticeships — the funding rules forbid it. An apprenticeship plus a short funded course is fine and quite common.",
                },
                {
                  question: "What is an end-point assessment?",
                  answer:
                    "An independent test at the end, by an organisation that is not us, covering everything at once. It is the part people find hardest and we run four mock assessments before it.",
                },
                {
                  question: "Does the 20% off-the-job have to be a day a week?",
                  answer:
                    "No, and it need not be at a college. Shadowing, a new task, our workshops and time spent on the portfolio all count. It does have to be inside paid hours, which is the part employers get wrong.",
                },
              ]}
            />
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            <a className="underline underline-offset-4" href="#/">Eligibility</a>
            {" · "}
            <a className="underline underline-offset-4" href="#/apply">Applying</a>
          </p>
        </section>
      </div>
    </SiteChrome>
  );
}
