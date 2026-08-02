// tutor /about — who you are and why it works. One person, so this reads as a
// person rather than as an "our approach" page. The credentials are checkable
// and the failures are named, which is what makes the rest believable.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { CtaBand } from "@/components/ui/cta-band";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { SubjectList } from "@/components/ui/subject-list";
import { Testimonial } from "@/components/ui/testimonial";
import { SUBJECTS } from "./index";
export const Route = createFileRoute("/about")({ component: P });
function P() {
  return (
    <SiteChrome name="Cathy Bramwell" tagline="Maths and physics tutor, Sheffield. Fourteen years, eleven of them teaching."
      links={[{ label: "Home", href: "#/" }, { label: "Book a trial", href: "#/book" }]}
      action={{ label: "Free trial lesson", href: "#/book" }}>

      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <SectionHeader eyebrow="About" title="Fourteen years of this, and eleven in a classroom" />
            <div className="mt-6 max-w-prose space-y-5 text-lg leading-relaxed text-muted-foreground">
              <p>
                I taught maths at Silverdale and then at Meadowhead, and I was head of KS4 maths for
                the last four of those years. I left in 2023, not dramatically — I wanted to spend
                the hour on the person in front of me rather than on thirty-one of them and a
                behaviour policy.
              </p>
              <p>
                What eleven years in a classroom actually buys you is boring and useful: I know
                which topics the exam boards keep coming back to, I know what a grade 4 answer looks
                like next to a grade 5 one, and I have marked enough papers to know where the marks
                get thrown away.
              </p>
              <p>
                Almost nobody who comes to me is bad at maths. They missed a fortnight in year 9,
                or a teacher moved on mid-topic, and everything built on that stopped making sense.
                Finding the actual gap is most of the job and it usually takes two lessons.
              </p>
              <p>
                I am not going to promise you a grade. Anybody who does is selling something. What I
                will do is tell you after two lessons what the gap is and whether the time left is
                enough — including when the answer is no.
              </p>
            </div>
          </div>
          <div className="space-y-4">
            <SafeImage src={null} alt="Cathy Bramwell" ratio="4/5" />
            <SafeImage src={null} alt="The room where lessons happen" ratio="4/3" />
          </div>
        </div>

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="Checkable" title="The credentials, and where to check them"
            description="All of these are verifiable and I would rather you did." />
          <dl className="mt-6 divide-y divide-border border-y border-border text-base">
            {[
              ["Degree", "BSc Mathematics, University of Sheffield, 2009"],
              ["Teaching", "PGCE Secondary Mathematics, Sheffield Hallam, 2011"],
              ["Registration", "Teaching Regulation Agency, TRN 1128447 — searchable on their public register"],
              ["Classroom", "Silverdale 2011–2016, Meadowhead 2016–2023, Head of KS4 Maths 2019–2023"],
              ["Examining", "AQA GCSE Maths examiner, 2017–2021"],
              ["Safeguarding", "Enhanced DBS renewed 2025 — shown at the trial lesson without being asked"],
              ["Insurance", "£2m professional indemnity through Tutors' Association membership"],
            ].map(([k, v]) => (
              <div key={k} className="grid gap-x-8 gap-y-1 py-3 sm:grid-cols-[9rem_1fr]">
                <dt className="text-muted-foreground">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="Honestly" title="What I am not good at"
            description="Every tutoring page in the country lists strengths. This is the other half, and it saves everybody a term." />
          <div className="mt-6 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["A2 Physics", "I take it to AS and stop. Somebody who does physics all day will do a better job and I will give you two names."],
              ["Exam anxiety on its own", "If the maths is fine and the exam room is the problem, I am the wrong tool. There are people who do exactly that and they are better at it than me."],
              ["Under 11", "Primary is a genuinely different skill and I do not have it. I know three people who do."],
              ["Two at once", "Two children at different levels in one hour sounds efficient and is worse for both. I will not do it."],
              ["Miracles in three weeks", "Somebody arriving in May for a June exam three grades below is not a job I will take money for. I will say so on the phone."],
              ["Being your child's friend", "The lessons are polite and reasonably relaxed and they are not fun. Fun is not what the hour is for."],
            ].map(([k, v]) => (
              <div key={k} className="border-t border-border pt-4">
                <p className="font-medium">{k}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{v}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr]">
            <div>
              <SectionHeader eyebrow="What I teach" title="And what it costs" />
              <SubjectList className="mt-6" subjects={SUBJECTS} />
            </div>
            <div className="space-y-4 self-start">
              <Testimonial item={{ quote: "She was my daughter's head of maths at Meadowhead. When she left we followed her, and it turned out one-to-one was what had been missing all along.", name: "Bev", role: "Parent, GCSE Higher" }} />
              <Testimonial item={{ quote: "The 'what I am not good at' list is the reason I rang her. Nobody else on the internet has one.", name: "Tomasz", role: "Parent, A-level" }} />
              <Testimonial item={{ quote: "Two lessons in she told us the gap was year 8 fractions, not year 11 algebra. Six months later he got a 6.", name: "Shani", role: "Parent, GCSE Foundation" }} />
            </div>
          </div>
        </section>

        <section className="mt-14">
          <CtaBand title="The first lesson is free and it is a real lesson"
            description="Forty-five minutes of actual work, and an honest answer at the end about whether I can help."
            action={{ label: "Ask for a slot", href: "#/book" }} />
        </section>
      </div>
    </SiteChrome>
  );
}
