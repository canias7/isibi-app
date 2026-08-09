// professional-body /apply — the assessment route, the evidence needed, and
// how long it really takes. The median from first enquiry to Member is seven
// months and the published figure everywhere is "12 to 16 weeks", which is the
// bit AFTER the three months of writing nobody warns you about.
import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { BusyButton } from "@/components/ui/busy-button";
import { DownloadCard } from "@/components/ui/download-card";
import { Faq } from "@/components/ui/faq";
import { FormRow } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import { MembershipGrades } from "@/components/ui/membership-grades";
import { SectionHeader } from "@/components/ui/section-header";
import { SuccessPanel } from "@/components/ui/success-panel";
import { Textarea } from "@/components/ui/textarea";
import { Timeline } from "@/components/ui/timeline";
import { GRADES } from "./index";
export const Route = createFileRoute("/apply")({ component: P });
function P() {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [about, setAbout] = React.useState("");
  const [sent, setSent] = React.useState(false);
  return (
    <SiteChrome name="Chartered Institute of Building Services" tagline="14,200 members. The register, the grades, and what each one actually asks of you."
      links={[{ label: "Home", href: "/" }, { label: "Find a member", href: "/register" }]}
      action={{ label: "Which grade am I?", href: "/#grades" }}>

      <div className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="Applying" title="Seven months, not sixteen weeks"
          description="Sixteen weeks is how long WE take once a complete submission arrives. The median from first enquiry is about seven months, and the difference is the three months most people spend writing. Knowing that up front is the difference between finishing and abandoning it." />

        <section className="mt-10 grid gap-12 lg:grid-cols-[1fr_1fr]">
          <div>
            <Timeline items={[
              { title: "You decide which grade", when: "An afternoon", description: "From the requirements on the home page. If you are between two, apply for the higher one — we will offer the lower rather than refuse, and it costs nothing extra to find out." },
              { title: "You get the competences and a sample", when: "Same day", description: "Nine competences, and a real anonymised submission that passed. Reading somebody else's is worth more than any amount of guidance, and almost no institute publishes one." },
              { title: "You write it", when: "8 to 14 weeks, realistically", description: "5,000 words for Member, against the nine competences, evidenced from your own projects. Almost everybody underestimates this and it is the only stage that ever kills an application." },
              { title: "A mentor reads a draft", when: "2 weeks, free, optional", description: "A Member or Fellow in your field, matched by us, who will tell you which competence is thin. About 80% of people who use this pass first time against 60% who do not." },
              { title: "You submit and pay", when: "£320, one-off", description: "Refunded in full if we decide not to assess. Not refunded if we assess and say no, which is about one in six at Member." },
              { title: "Two assessors read it", when: "6 to 8 weeks", description: "Independently, both in your field, neither knowing who the other is. They agree a recommendation or a third assessor is brought in." },
              { title: "The professional review", when: "60 minutes, remote or in person", description: "Not a viva and not a trap. They ask about the projects you wrote about, because the point is confirming you did the things you said you did." },
              { title: "The committee decides", when: "Next sitting", description: "Monthly for Member, twice a year for Fellow. You hear within three working days and the register updates that week." },
            ]} />
          </div>
          <div>
            <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">What the evidence has to be</h2>
            <ul className="mt-3 divide-y divide-border border-y border-border text-base">
              <li className="py-3.5">
                <span className="font-medium">Your own work, named, with dates</span>
                <span className="block text-sm text-muted-foreground">
                  "The team designed" evidences the team. Assessors are looking for what YOU decided
                  and what happened as a result, which most engineers find the hardest sentence in
                  the document to write.
                </span>
              </li>
              <li className="py-3.5">
                <span className="font-medium">Something that went wrong</span>
                <span className="block text-sm text-muted-foreground">
                  Not compulsory and it is the strongest thing you can include. A submission where
                  every project went perfectly reads as a submission about somebody else's projects.
                </span>
              </li>
              <li className="py-3.5">
                <span className="font-medium">Two referees who have actually seen you work</span>
                <span className="block text-sm text-muted-foreground">
                  One must be a Member or Fellow. If you do not know one, say so — we will not
                  refuse you for it and we can arrange for somebody to see the work instead.
                </span>
              </li>
              <li className="py-3.5">
                <span className="font-medium">A year of CPD</span>
                <span className="block text-sm text-muted-foreground">
                  35 hours. If yours is thin because of illness, caring or redundancy, say so in one
                  line — it is accepted without further questions and it is asked about far more
                  often than it is used.
                </span>
              </li>
              <li className="py-3.5">
                <span className="font-medium">Nothing confidential</span>
                <span className="block text-sm text-muted-foreground">
                  Anonymise clients and redact figures. Assessors are bound by confidentiality
                  anyway, and an NDA is not a reason to leave your best project out.
                </span>
              </li>
            </ul>

            <div className="mt-8 space-y-3">
              <DownloadCard name="The nine competences.pdf" size={340_000}
                description="What the submission is marked against, in full" href="/apply" />
              <DownloadCard name="Sample competence statement.pdf" size={210_000}
                description="A real one that passed, anonymised with permission" href="/apply" />
              <DownloadCard name="Assessor guidance.pdf" size={180_000}
                description="What the two assessors are told to look for — published on purpose" href="/apply" />
              <DownloadCard name="Experienced practitioner route.pdf" size={160_000}
                description="Ten years, no degree. How the submission differs" href="/apply" />
            </div>
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="The grades again" title="So you are not going back for them"
            description="Same table as the home page. The second column on Associate and Member is the one to read twice." />
          <div className="mt-8">
            <MembershipGrades grades={GRADES} heading="" />
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr]">
            <div>
              <SectionHeader eyebrow="Start" title="Tell us where you are and we will say which grade" />
              {sent ? (
                <SuccessPanel className="mt-6" title="Got it — a real answer within two working days"
                  description="From a person who assesses, not from a membership administrator reading a script. If the answer is 'not yet', it will say what would change that and roughly when." />
              ) : (
                <div className="mt-6 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormRow label="Your name" htmlFor="a-name" required>
                      <Input id="a-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
                    </FormRow>
                    <FormRow label="Email" htmlFor="a-em" required>
                      <Input id="a-em" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                    </FormRow>
                  </div>
                  <FormRow label="Roughly where you are" htmlFor="a-about" required
                    hint="Years, what you do, and any qualification. Four lines is plenty and we would rather have four honest ones than a CV.">
                    <Textarea id="a-about" rows={6}
                      placeholder={"14 years, mechanical building services, currently a project engineer.\nHNC, no degree.\nRun the design side of two hospital jobs and one school.\nCPD is patchy for 2024 — I had six months off."}
                      value={about} onChange={(e) => setAbout(e.target.value)} />
                  </FormRow>
                  <BusyButton disabled={!name || !email || !about} onClick={() => setSent(true)}>
                    Ask which grade
                  </BusyButton>
                  <p className="text-sm text-muted-foreground">
                    No payment at this stage and no obligation. Asking costs nothing and about a
                    fifth of the people who ask are eligible for a grade above the one they expected.
                  </p>
                </div>
              )}
            </div>
            <div>
              <SectionHeader eyebrow="Asked often" title="About the assessment" />
              <Faq className="mt-6" items={[
                { question: "How many fail?", answer: "About one in six at Member, and roughly a third of those resubmit and pass. The commonest reason is a submission written about a team rather than about the applicant." },
                { question: "Is the mentoring really free?", answer: "Yes, and it is the single biggest thing you can do to pass. Mentors are volunteers and there is a wait of two or three weeks in the autumn." },
                { question: "Can I do the review remotely?", answer: "Yes, and about 70% now do. It makes no difference to the outcome and we stopped pretending it might in 2021." },
                { question: "What if English is not my first language?", answer: "The assessment is of competence, not of prose. Assessors are instructed on that explicitly and it is in the published guidance, which is one reason that guidance is published." },
                { question: "Does my employer have to know?", answer: "No, and plenty of applications come from people who would rather they did not until it is done. Referees can be former colleagues." },
                { question: "Can I pay in instalments?", answer: "The £320 in two, and the subscription monthly. Nobody has ever been refused an instalment plan and you do not have to explain why you want one." },
              ]} />
            </div>
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
