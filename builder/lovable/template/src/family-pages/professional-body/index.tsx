// professional-body — WHICH-GRADE-AM-I-FIRST, on a sidebar structure. Every
// institute leads with the benefits and buries the entry criteria, so somebody
// with eleven years in the trade and no degree concludes there is no grade for
// them. There nearly always is.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { DownloadCard } from "@/components/ui/download-card";
import { Faq } from "@/components/ui/faq";
import { MembershipGrades } from "@/components/ui/membership-grades";
import { SectionHeader } from "@/components/ui/section-header";
import { StatsBand } from "@/components/ui/stats-band";
export const Route = createFileRoute("/")({ component: P });
export const GRADES = [
  {
    name: "Student", postnominal: null, fee: 24,
    requires: ["Enrolled on a course in the built environment, at any level", "That is the whole of it"],
    assessment: null, takes: "Same day",
  },
  {
    name: "Affiliate", postnominal: null, fee: 96,
    requires: ["Working in the sector in any capacity", "No qualification and no minimum experience"],
    assessment: null, takes: "Same day",
  },
  {
    name: "Associate", postnominal: "ACIBS", fee: 168, assessmentFee: 145,
    requires: ["A level 4 qualification in a relevant subject", "Two years in a technical or supervisory role", "Two referees, one of whom is a member"],
    orRequires: ["Five years in a technical or supervisory role, with no qualification at all", "A 2,000-word competence statement in place of the qualification", "The same two referees"],
    assessment: "A written competence statement, reviewed by two assessors",
    takes: "About 10 weeks",
  },
  {
    name: "Member", postnominal: "MCIBS", fee: 245, assessmentFee: 320,
    requires: ["An accredited degree, or a level 6 qualification we recognise", "Five years' experience, two of them at a responsible level", "A record of 35 hours' CPD in the last year"],
    orRequires: ["Ten years' experience with demonstrable responsibility, and no degree", "A 5,000-word submission against the nine competences", "The same CPD record"],
    assessment: "A written submission and a 60-minute professional review with two assessors",
    takes: "12 to 16 weeks",
  },
  {
    name: "Fellow", postnominal: "FCIBS", fee: 310, assessmentFee: 220,
    requires: ["Five years as a Member", "Evidence of leading a function, a firm or a body of work", "Two proposers, both Fellows"],
    assessment: "Papers reviewed by the Membership Committee. No interview",
    takes: "Twice a year, at the March and September committees",
  },
];
function P() {
  return (
    <SiteChrome name="Chartered Institute of Building Services" tagline="14,200 members. The register, the grades, and what each one actually asks of you."
      links={[{ label: "Find a member", href: "/register" }, { label: "Apply", href: "/apply" }, { label: "CPD", href: "#cpd" }]}
      action={{ label: "Which grade am I?", href: "#grades" }}>

      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid items-start gap-12 lg:grid-cols-[320px_1fr]">
            <aside>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Founded 1954 · Royal Charter 1988</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance">
                Which grade are you?
              </h1>
              <p className="mt-5 text-base leading-relaxed text-muted-foreground">
                Answerable in about ten seconds from the list beside this, because it is written as
                what each grade REQUIRES rather than what it gives you. Everything an institute
                normally leads with — the journal, the events, the letters — is on the apply page.
              </p>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                The one to read twice is the second column on Associate and Member. Most people who
                assume they are not eligible are looking at the first column and stopping.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <a className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" href="/apply">Start an application</a>
                <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="/register">Find a member</a>
              </div>
            </aside>
            <div id="grades">
              {/* THE LADDER, BY WHAT IT REQUIRES. */}
              <MembershipGrades grades={GRADES}
                heading="Five grades, and two of them have a second route"
                note="Subscriptions are annual and pro-rated in your first year. The assessment fee is one-off and is refunded in full if we refuse to assess — though not if we assess and say no, which happens to about one application in six at Member." />
            </div>
          </div>
        </div>
      </section>

      <section id="cpd" className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="CPD" title="35 hours a year, and here is what counts"
          description="Stated in hours and in examples, because 'continuing professional development' is a phrase that has made a great many competent people believe they are not doing any." />
        <StatsBand className="mt-8" items={[
          { label: "Hours a year, Member and above", value: "35" },
          { label: "Of which structured", value: "20" },
          { label: "Members audited each year", value: "5%" },
          { label: "Audits that fail", value: "1 in 40" },
        ]} />
        <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Counts, structured", "A course, a conference session, a webinar you actually watched, a formal mentoring relationship, writing a paper, sitting on a panel."],
            ["Counts, unstructured", "Reading a standard properly. A site visit outside your usual work. Teaching somebody. Fifteen hours of the thirty-five can be this."],
            ["Does not count", "Doing your job. It is the commonest mistake in a failed audit and it is an easy one — being good at your work is not development of it."],
            ["If you are audited", "Send the record. There is no interview and no penalty for a thin year with a reason; we ask for a plan, not an explanation."],
          ].map(([k, v]) => (
            <div key={k} className="border-t border-border pt-4">
              <p className="font-medium">{k}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{v}</p>
            </div>
          ))}
        </div>
        {/* Full width rather than in the rail: a DownloadCard truncates its
            filename, and in a 320px sidebar "The nine compet…" tells nobody
            anything. The card is right and the column was wrong. */}
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <DownloadCard name="The nine competences.pdf" size={340_000}
            description="What Member is actually assessed against" href="/apply" />
          <DownloadCard name="Sample competence statement.pdf" size={210_000}
            description="A real one, anonymised, that passed" href="/apply" />
          <DownloadCard name="CPD record template.xlsx" size={48_000}
            description="What assessors expect to see. Not compulsory" href="#cpd" />
        </div>
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="max-w-3xl">
            <SectionHeader eyebrow="Asked often" title="Before you apply" />
            <Faq className="mt-6" items={[
              { question: "I have no degree. Is there a grade for me?", answer: "Associate at five years, Member at ten, both by the experienced-practitioner route, and about 40% of our Members came in that way. The written submission is longer because it is doing the work a degree would otherwise have evidenced." },
              { question: "How long does Member really take?", answer: "Twelve to sixteen weeks from a complete submission, and the word doing the work there is complete. The median from first enquiry is about seven months, because the submission takes most people three." },
              { question: "What happens if I am refused?", answer: "You get the assessors' reasons in writing, against each competence, and you may resubmit after six months at half the fee. About a third of refusals resubmit and nearly all of those pass." },
              { question: "Can I use the letters straight away?", answer: "From the date of the committee decision, and the register updates the same week. Using them beforehand is the one thing that will get an application withdrawn." },
              { question: "Do I have to keep paying to keep the letters?", answer: "Yes. They denote current membership, not a qualification you passed once, and lapsing means giving them up. That is uncomfortable and it is the honest position — a body whose designation survives non-payment is not regulating anybody." },
              { question: "Is this the same as being chartered?", answer: "MCIBS is chartered membership of this institute. It is not an engineering chartership through the Engineering Council, which is a separate route we can register you for and which most Members do not need." },
            ]} />
          </div>
        </div>
      </section>
    </SiteChrome>
  );
}
