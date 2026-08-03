// music-school — INSTRUMENT-AND-GRADE-FIRST, on a sidebar, because the
// instrument is what a parent narrows by before anything else.
//
// THE FEE IS PER TERM AND SAYS SO. A music school bills termly and an hourly
// figure on the page is a number nobody will ever be charged — it also makes
// the school look half the price of one being honest, which is why the
// convention persists.
//
// THE INSTRUMENT LOAN SCHEME IS ON THE FIRST PAGE. A parent looking at a
// £30-a-week lesson is also looking at £400 for a cello they cannot judge, and
// that second figure is what actually stops people. Answering it up front is
// worth more than any amount of prose about musicality.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { SubjectList } from "@/components/ui/subject-list";
import { PractitionerCard } from "@/components/ui/practitioner-card";
import { MediaGrid } from "@/components/ui/media-grid";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/")({ component: P });

const RAIL = [
  { href: "#strings", label: "Strings", note: "Violin, viola, cello, double bass" },
  { href: "#keys", label: "Keyboard", note: "Piano, organ, harpsichord" },
  { href: "#wind", label: "Wind and brass", note: "Flute, clarinet, sax, trumpet, trombone" },
  { href: "#voice", label: "Voice and guitar", note: "Singing, classical and electric guitar" },
  { href: "#/timetable", label: "The timetable", note: "What is free this term" },
  { href: "#/fees", label: "Fees and bursaries", note: "Per term, with the loan scheme" },
];

const SUBJECTS = [
  {
    subject: "Violin and viola",
    blurb: "From four upwards on a sixteenth-size instrument. Suzuki for the youngest, traditional from about seven.",
    levels: [
      { level: "Beginner to Grade 3", rate: 26, exam: "ABRSM or Trinity" },
      { level: "Grade 4 to 6", rate: 30, exam: "ABRSM or Trinity" },
      { level: "Grade 7, 8 and diploma", rate: 36, exam: "ABRSM, Trinity, DipABRSM" },
    ],
  },
  {
    subject: "Cello and double bass",
    blurb: "Instruments loaned free at every size up to full — nobody should buy a cello for a child who may not stay with it.",
    levels: [
      { level: "Beginner to Grade 3", rate: 26, exam: "ABRSM or Trinity" },
      { level: "Grade 4 to 6", rate: 30, exam: "ABRSM or Trinity" },
      { level: "Grade 7 and 8", rate: 36, exam: "ABRSM" },
    ],
  },
  {
    subject: "Piano",
    blurb: "The one where practice at home matters most, so we are honest about it before you start rather than at the first report.",
    levels: [
      { level: "Beginner to Grade 3", rate: 26, exam: "ABRSM, Trinity or none at all" },
      { level: "Grade 4 to 6", rate: 30, exam: "ABRSM or Trinity" },
      { level: "Grade 7, 8 and diploma", rate: 38, exam: "ABRSM, DipABRSM" },
    ],
  },
  {
    subject: "Singing",
    blurb: "From eleven. Younger than that we teach it in the choir rather than one to one, because a growing voice does not need pressure.",
    levels: [
      { level: "Grade 1 to 5", rate: 28, exam: "ABRSM, Trinity, LCM musical theatre" },
      { level: "Grade 6 to 8", rate: 34, exam: "ABRSM, Trinity" },
    ],
  },
];

function P() {
  return (
    <SiteChrome
      name="The Rivelin Music School"
      tagline="Eleven instruments, forty teachers, a converted chapel on Walkley Lane."
      links={[
        { label: "Lessons", href: "#/lessons" },
        { label: "Timetable", href: "#/timetable" },
        { label: "Fees", href: "#/fees" },
      ]}
      action={{ label: "Book a taster", href: "#/lessons" }}
    >
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 lg:grid-cols-[minmax(0,15rem)_1fr]">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Instruments</p>
          <nav className="mt-3 flex flex-col gap-1">
            {RAIL.map((r) => (
              <a key={r.href} href={r.href} className="rounded-md px-3 py-2 hover:bg-muted">
                <span className="block text-sm font-medium">{r.label}</span>
                <span className="block text-xs text-muted-foreground">{r.note}</span>
              </a>
            ))}
          </nav>
          <div className="mt-8 rounded-xl border border-border p-5">
            <p className="text-sm font-medium">Instruments are lent free</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Every size, every instrument on this page, for as long as a child is learning with us.
              A £30 deposit and nothing else.
            </p>
          </div>
        </aside>

        <main className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Since 1974 · A registered charity · Bursaries for a third of pupils
          </p>
          <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">
            Choose the instrument, then the stage
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Everything else follows from those two — which teacher, which room, which evening, and
            what a term costs. Fees are per TERM, because that is how you will be billed; the
            hourly figures below are what they work out at.
          </p>

          {/* THE ROOMS, AND WHAT IS IN THEM. A parent choosing between two
              music schools is choosing between two buildings they have never
              seen, and the questions are practical: is there a real piano or a
              keyboard, is there anywhere to sit and wait, is the drum room
              soundproofed or is it a cupboard. Each caption answers one of
              them with a fact rather than an adjective. */}
          <section className="mt-10">
            <MediaGrid
              columns={4}
              ratio="4/3"
              items={[
                { src: null, alt: "The main room with the Yamaha upright, two chairs and a stand", caption: "Two acoustic uprights, tuned twice a year. Not keyboards." },
                { src: null, alt: "The drum room, kit set up, foam panels on three walls", caption: "Properly treated. The room next door can still teach through it." },
                { src: null, alt: "The waiting area — six chairs, a kettle, a noticeboard of concert dates", caption: "Somewhere to sit for half an hour. Parents wait here every week." },
                { src: null, alt: "The summer concert at the Methodist hall, about eighty in the audience", caption: "Two concerts a year, and everybody plays whether they are ready or not." },
              ]}
            />
          </section>

          <section className="mt-12" id="strings">
            <SectionHeader
              eyebrow="What we teach"
              title="Eleven instruments, at every stage"
              description="Rates rise with grade because the teaching does. A Grade 8 lesson is preparation for a diploma and is taught by somebody who has one."
            />
            <div className="mt-8">
              <SubjectList subjects={SUBJECTS} per="an hour" />
            </div>
            <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Guitar, flute, clarinet, saxophone, trumpet, trombone, percussion and organ are all
              taught on the same scale.{" "}
              <a className="underline underline-offset-4" href="#/lessons">The full list is on the lessons page.</a>
            </p>
          </section>

          <section className="mt-14" id="keys">
            <SectionHeader
              eyebrow="How lessons run"
              title="Thirty minutes to start, and that is not a lesser lesson"
              description="A seven-year-old's concentration is about twenty minutes. Selling a parent an hour is selling forty minutes of a child looking out of a window."
            />
            <div className="mt-8 grid gap-6 md:grid-cols-3">
              <div className="rounded-xl border border-border p-6">
                <p className="font-medium">30 minutes</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Beginners to about Grade 3. Most children stay here for two or three years and
                  there is no rush past it.
                </p>
              </div>
              <div className="rounded-xl border border-border p-6">
                <p className="font-medium">45 minutes</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Grade 4 upwards, or any adult. The point where scales and a piece no longer fit
                  into half an hour together.
                </p>
              </div>
              <div className="rounded-xl border border-border p-6">
                <p className="font-medium">60 minutes</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Grade 7, 8 and diploma work. Also anybody preparing for a conservatoire audition,
                  which we do about six of a year.
                </p>
              </div>
            </div>
          </section>

          <section className="mt-14" id="wind">
            <SectionHeader eyebrow="Who teaches" title="Forty teachers, and you get to pick" />
            <div className="mt-8 grid gap-6 md:grid-cols-2">
              <PractitionerCard
                name="Marta Oyelaran"
                role="Head of strings"
                letters="MMus, PGCE"
                treats={["Violin", "Viola", "Suzuki from age 4", "Diploma preparation"]}
                languages={["English", "Yoruba"]}
                note="Sixteen years here and eight in the Hallé before that. Takes the youngest beginners as well as the diploma candidates, which is unusual and deliberate."
                accepting
              />
              <PractitionerCard
                name="Dominic Peach"
                role="Piano"
                letters="BMus, DipABRSM"
                treats={["Piano", "Organ", "Jazz piano", "Adult returners"]}
                note="Teaches almost all of our adult pupils. Specialises in people who stopped at Grade 4 thirty years ago and always meant to go back."
                accepting={false}
              />
            </div>
            <p className="mt-5 text-sm text-muted-foreground">
              Two of the forty are full this term.{" "}
              <a className="underline underline-offset-4" href="#/timetable">The timetable shows who has space.</a>
            </p>
          </section>

          <section className="mt-14" id="voice">
            <SectionHeader title="What parents ask first" />
            <div className="mt-6">
              <Faq
                items={[
                  {
                    question: "Do we have to buy an instrument?",
                    answer:
                      "No. Every instrument on this page is lent free for as long as a child is learning here, at whatever size fits, with a £30 refundable deposit. It is the single most useful thing this school does.",
                  },
                  {
                    question: "How much practice does it really need?",
                    answer:
                      "Fifteen minutes on five days beats an hour on one, at every grade. We would rather tell you that now than write it on a report in December.",
                  },
                  {
                    question: "Do they have to take exams?",
                    answer:
                      "No, and about a third of our pupils never do. Grades are a useful structure for some children and a source of dread for others, and we will follow your lead on it.",
                  },
                  {
                    question: "Are there bursaries?",
                    answer:
                      "A third of pupils hold one and it covers between 25% and 100% of fees. It is means-tested on household income, applied for in one page, and nobody on the teaching staff is told who holds one.",
                  },
                ]}
              />
            </div>
          </section>
        </main>
      </div>
    </SiteChrome>
  );
}
