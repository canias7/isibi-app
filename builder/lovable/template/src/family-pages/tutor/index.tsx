// tutor — SUBJECT-FIRST: subjects and levels with the rate on each, because the
// rate changes with the level and a single headline figure is always a fiction.
// One person, so the credentials are personal rather than corporate.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { AvailabilityGrid } from "@/components/ui/availability-grid";
import { Faq } from "@/components/ui/faq";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { SubjectList } from "@/components/ui/subject-list";
import { Testimonial } from "@/components/ui/testimonial";
export const Route = createFileRoute("/")({ component: P });
export const SUBJECTS = [
  {
    subject: "Maths",
    blurb: "Fourteen years of it, eleven of them in a classroom. Most of the people who come to me are not bad at maths — they missed three weeks in year 9 and everything after it stopped making sense.",
    levels: [
      { level: "Key Stage 3", rate: 34, length: "60 minutes", note: "Where most of the damage is done and where it is easiest to undo." },
      { level: "GCSE Foundation", rate: 36, exam: "AQA, Edexcel, OCR", length: "60 minutes" },
      { level: "GCSE Higher", rate: 38, exam: "AQA, Edexcel, OCR", length: "60 or 90 minutes" },
      { level: "A-level Maths", rate: 45, exam: "Edexcel, AQA", length: "90 minutes" },
      { level: "A-level Further Maths", rate: 52, exam: "Edexcel only", length: "90 minutes", taking: false, note: "Two slots, both taken until next September." },
      { level: "Adult resit and functional skills", rate: 32, length: "60 minutes", note: "Evenings. Nobody here is going to make you feel stupid." },
    ],
  },
  {
    subject: "Physics",
    blurb: "Second subject, and I only take it to GCSE and AS. Someone who does physics all day will do a better job at A2 and I will give you two names.",
    levels: [
      { level: "GCSE Combined Science", rate: 36, exam: "AQA, Edexcel", length: "60 minutes" },
      { level: "GCSE Separate Physics", rate: 38, exam: "AQA, Edexcel", length: "60 minutes" },
      { level: "AS Physics", rate: 45, exam: "AQA", length: "90 minutes", note: "AS only. For A2, ask me and I will point you at Ravi or Sian." },
    ],
  },
];
function P() {
  return (
    <SiteChrome name="Cathy Bramwell" tagline="Maths and physics tutor, Sheffield. Fourteen years, eleven of them teaching."
      links={[{ label: "Book a trial", href: "#/book" }, { label: "About me", href: "#/about" }, { label: "Rates", href: "#rates" }]}
      action={{ label: "Free trial lesson", href: "#/book" }}>

      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid items-start gap-12 lg:grid-cols-[1.2fr_1fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Sheffield · in person in S7 and S11, or online · DBS on request</p>
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">Cathy Bramwell</h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                Maths and physics, Key Stage 3 to A-level. I taught in Sheffield secondaries for
                eleven years before going independent, which mostly means I know what is on the
                paper and what is not worth your Tuesday evening.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <a className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" href="#/book">Free trial lesson</a>
                <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="#rates">Rates by level</a>
              </div>
              <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-4 text-sm sm:grid-cols-4">
                <div><dt className="text-muted-foreground">Teaching</dt><dd className="mt-1 text-lg font-semibold">14 yrs</dd></div>
                <div><dt className="text-muted-foreground">Students now</dt><dd className="mt-1 text-lg font-semibold">21</dd></div>
                <div><dt className="text-muted-foreground">Trial</dt><dd className="mt-1 text-lg font-semibold">Free</dd></div>
                <div><dt className="text-muted-foreground">Notice</dt><dd className="mt-1 text-lg font-semibold">24 hrs</dd></div>
              </dl>
            </div>
            <SafeImage src={null} alt="Cathy Bramwell" ratio="4/5" />
          </div>
        </div>
      </section>

      <section id="rates" className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="Subjects and rates" title="The rate changes with the level, so it is on every line"
          description="A single hourly figure on a tutoring page is either the cheapest thing there presented as the price, or the dearest presented as a deterrent. Here is all of it." />
        <div className="mt-10 grid gap-x-14 gap-y-12 lg:grid-cols-2">
          <SubjectList subjects={SUBJECTS} />
          <div className="space-y-6">
            <div className="rounded-xl border border-border p-6">
              <h3 className="text-lg font-semibold tracking-tight">The first lesson is free</h3>
              <p className="mt-2 text-base leading-relaxed text-muted-foreground">
                Forty-five minutes, no obligation, and I will tell you honestly at the end whether I
                think I can help. About one in six I send elsewhere — usually because the problem is
                confidence rather than content, and there are people better at that than me.
              </p>
            </div>
            <div className="rounded-xl border border-border p-6">
              <h3 className="text-lg font-semibold tracking-tight">Blocks, if you want them</h3>
              <p className="mt-2 text-base leading-relaxed text-muted-foreground">
                Ten lessons paid up front is five percent off and it is the only discount there is.
                No pressure to take it — most people pay lesson by lesson and that is fine.
              </p>
            </div>
            <div className="rounded-xl border border-border p-6">
              <h3 className="text-lg font-semibold tracking-tight">Online is the same price</h3>
              <p className="mt-2 text-base leading-relaxed text-muted-foreground">
                Same rate, same hour, a shared whiteboard. Genuinely no worse for maths and slightly
                better for anything with a diagram, because I can save the page and send it after.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr]">
            <div>
              <SectionHeader eyebrow="How a lesson goes" title="An hour, and no theatre"
                description="I do not do 'learning styles' and I do not do a personality test in week one." />
              <ol className="mt-6 divide-y divide-border border-y border-border text-base">
                <li className="py-3"><span className="font-medium">Ten minutes on last week</span> — the homework, and specifically the bits that went wrong.</li>
                <li className="py-3"><span className="font-medium">Thirty minutes on the new thing</span> — worked through together, on paper, with me writing less and less of it as we go.</li>
                <li className="py-3"><span className="font-medium">Fifteen minutes of past paper</span> — actual exam questions from week one, because the paper is the thing being sat.</li>
                <li className="py-3"><span className="font-medium">Five minutes setting work</span> — half an hour's worth, not two hours. Homework nobody does is worse than none.</li>
                <li className="py-3"><span className="font-medium">A note to whoever is paying</span> — three lines the same evening, saying what we did and what went badly.</li>
              </ol>
            </div>
            <div>
              <SectionHeader eyebrow="When I am free" title="This week"
                description="Struck through is taken. I keep four evening slots and two Saturday mornings, and that is the whole week — I am not a company." />
              <AvailabilityGrid className="mt-6"
                slots={["Mon 16:30", "Mon 17:45", "Mon 19:00", "Tue 16:30", "Tue 17:45", "Tue 19:00", "Wed 16:30", "Wed 17:45", "Thu 16:30", "Thu 17:45", "Thu 19:00", "Sat 09:00", "Sat 10:30", "Sat 12:00"]}
                taken={["Mon 16:30", "Mon 17:45", "Tue 17:45", "Wed 16:30", "Thu 16:30", "Thu 17:45", "Sat 09:00", "Sat 10:30"]} />
              <p className="mt-4 text-sm text-muted-foreground">
                A slot booked is yours every week for the term. Cancel with 24 hours and there is no
                charge; less than that and it is half, which is the only rule I am strict about.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <SectionHeader eyebrow="Asked often" title="What parents email me about" />
            <Faq className="mt-6" items={[
              { question: "Will this get my child a grade 7?", answer: "I do not know, and anybody who tells you they do is selling something. What I can say is what the gap is after the first two lessons, and whether the time left is enough to close it." },
              { question: "How often should we come?", answer: "Weekly during term, and stop over the summer unless there is a resit. Twice a week is almost never the answer — the limit is how much gets practised between lessons, not how much I explain." },
              { question: "Do you set homework?", answer: "About half an hour. Set more and it does not get done, and then the lesson starts with an apology instead of with maths." },
              { question: "Can I sit in?", answer: "Yes, and for anyone under 13 I would rather you did, at least at first. For a sixteen-year-old it usually makes things worse and I will say so." },
              { question: "Are you DBS checked?", answer: "Enhanced, renewed 2025, and I will show you the certificate at the trial lesson without being asked." },
              { question: "What if it is not working?", answer: "Tell me. I would much rather hand somebody on in week four than take money for a year of the wrong thing, and I have a list of people I trust." },
            ]} />
          </div>
          <div className="space-y-4 self-start">
            <Testimonial item={{ quote: "She told us in the free lesson that she thought our son needed help with confidence more than maths, and gave us two other names. We came back a year later for his GCSEs.", name: "Ade", role: "Parent, GCSE Higher" }} />
            <Testimonial item={{ quote: "The rates being on the page by level was why I emailed her first. Everyone else says 'contact for pricing', which means it depends what they think you can pay.", name: "Meera", role: "Parent, A-level" }} />
            <Testimonial item={{ quote: "Adult resit at 34 after twenty years of thinking I was thick at maths. Grade 5 in November. She never once made me feel like the oldest person doing it.", name: "Dan", role: "Functional skills" }} />
          </div>
        </div>
      </section>
    </SiteChrome>
  );
}
