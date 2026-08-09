// music-school /lessons — one-to-one, group and ensemble, and who each suits.
//
// THE ENSEMBLES ARE FREE AND THAT IS THE ARGUMENT FOR THE SCHOOL. A private
// teacher gives a better hour; an orchestra gives a child a reason to practise.
// Saying which is which honestly is more persuasive than claiming both.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { SubjectList } from "@/components/ui/subject-list";
import { SessionTable } from "@/components/ui/session-table";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/lessons")({ component: P });

const ALL = [
  {
    subject: "Flute, clarinet and saxophone",
    blurb: "From about eight, when hands and lungs are big enough. Clarinet first is a common and sensible route into saxophone.",
    levels: [
      { level: "Beginner to Grade 3", rate: 26, exam: "ABRSM or Trinity" },
      { level: "Grade 4 to 6", rate: 30, exam: "ABRSM or Trinity" },
      { level: "Grade 7 and 8", rate: 36, exam: "ABRSM" },
    ],
  },
  {
    subject: "Trumpet, trombone and tuba",
    blurb: "Cornet to start for the small. We have a strong brass tradition here and three of the local bands take our players straight from Grade 5.",
    levels: [
      { level: "Beginner to Grade 3", rate: 26, exam: "ABRSM, Trinity" },
      { level: "Grade 4 to 8", rate: 32, exam: "ABRSM, Trinity" },
    ],
  },
  {
    subject: "Classical and electric guitar",
    blurb: "Two different instruments taught by two different people, and we will say honestly which one a child actually wants.",
    levels: [
      { level: "Beginner to Grade 3", rate: 26, exam: "ABRSM, RGT, Rockschool" },
      { level: "Grade 4 to 8", rate: 32, exam: "ABRSM, RGT, Rockschool" },
    ],
  },
  {
    subject: "Percussion",
    blurb: "Drum kit, orchestral and tuned. No kit needed at home to start — a practice pad and a table does the first two years.",
    levels: [
      { level: "Beginner to Grade 3", rate: 26, exam: "Trinity Rock & Pop, ABRSM" },
      { level: "Grade 4 to 8", rate: 32, exam: "Trinity Rock & Pop, ABRSM" },
    ],
  },
];

function P() {
  return (
    <SiteChrome
      name="The Rivelin Music School"
      tagline="One-to-one, group and ensemble — and which is right at which stage."
      links={[
        { label: "Instruments", href: "/" },
        { label: "Timetable", href: "/timetable" },
        { label: "Fees", href: "/fees" },
      ]}
      action={{ label: "Fees per term", href: "/fees" }}
    >
      <div className="mx-auto max-w-5xl px-6 py-14">
        <h1 className="text-4xl font-semibold tracking-tight text-balance">Lessons</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Three shapes, and they do genuinely different things. A private teacher gives a better
          hour; an orchestra gives a child a reason to practise. We would rather be clear about
          which is which than claim both for everything.
        </p>

        <section className="mt-12">
          <SectionHeader eyebrow="Three shapes" title="What each one is for" />
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">One to one</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                The only way to fix technique, and technique is what stops people at Grade 5. Every
                pupil taking exams has one. £26 to £38 an hour depending on stage.
              </p>
            </div>
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">Small group, two or three</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Beginners only, and it works well for about eighteen months. £14 a head. Cheaper,
                more fun, and it stops being enough somewhere around Grade 2.
              </p>
            </div>
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">Ensembles</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Free, for anybody having lessons here. Four orchestras, two choirs, a wind band and
                a jazz group. This is the part children actually turn up for.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader
            eyebrow="The rest of the instruments"
            title="Everything not on the front page"
            description="Same scale, same teachers' room, same loan scheme."
          />
          <div className="mt-8">
            <SubjectList subjects={ALL} per="an hour" />
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader
            eyebrow="Ensembles"
            title="Free, and this is the timetable"
            description="Places left is what matters here. A string orchestra that needs violas and has too many violins will say so rather than take everybody."
          />
          <div className="mt-8">
            <SessionTable
              fundedLabel="Free with any lesson here"
              days={[
                {
                  day: "Tuesday",
                  sessions: [
                    { name: "Junior strings, grades 1–3", from: "17:00", to: "18:00", placesLeft: 4, funded: true, note: "Violas especially welcome — we have nine violins and two violas." },
                    { name: "Senior orchestra, grade 5+", from: "18:15", to: "20:00", placesLeft: 2, funded: true },
                  ],
                },
                {
                  day: "Wednesday",
                  sessions: [
                    { name: "Wind band", from: "17:30", to: "19:00", placesLeft: 6, funded: true },
                    { name: "Jazz group, grade 4+", from: "19:15", to: "20:30", placesLeft: 0, funded: true, note: "Full. A waiting list runs and two places usually come up in January." },
                  ],
                },
                {
                  day: "Thursday",
                  sessions: [
                    { name: "Junior choir, years 3–6", from: "16:45", to: "17:45", placesLeft: null, funded: true, note: "No audition, no limit, no requirement to have lessons here." },
                    { name: "Chamber choir, 14+", from: "18:00", to: "19:30", placesLeft: 3, funded: true, note: "Audition in September only." },
                  ],
                },
                {
                  day: "Saturday",
                  sessions: [
                    { name: "Brass band, all grades", from: "09:30", to: "11:30", placesLeft: 8, funded: true },
                    { name: "Beginner strings, first year", from: "11:45", to: "12:30", placesLeft: 5, funded: true },
                  ],
                },
              ]}
            />
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader title="Lesson questions" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "Can my child start in a group and move to one-to-one?",
                  answer:
                    "That is the usual route and we will tell you when it is time — normally around Grade 2, when the pieces stop being the same for everybody in the room.",
                },
                {
                  question: "Do adults come here?",
                  answer:
                    "About seventy of them. Mostly evenings, mostly piano and guitar, and mostly people who stopped as a teenager. Nobody will make you do an exam or play in a concert.",
                },
                {
                  question: "Are the ensembles really free?",
                  answer:
                    "Yes, for anybody having lessons here, including group lessons. The junior choir is free for anybody at all. Concerts, tours and music are the only things ever charged for.",
                },
                {
                  question: "What if we want to change teacher?",
                  answer:
                    "Ask the office and it is arranged without any conversation with the current teacher unless you want one. It happens a few times a term and it is nobody's failure.",
                },
              ]}
            />
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            <a className="underline underline-offset-4" href="/">Instruments and stages</a>
            {" · "}
            <a className="underline underline-offset-4" href="/timetable">The week</a>
            {" · "}
            <a className="underline underline-offset-4" href="/fees">What a term costs</a>
          </p>
        </section>
      </div>
    </SiteChrome>
  );
}
