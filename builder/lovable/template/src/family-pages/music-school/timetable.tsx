// music-school /timetable — the week by teacher and room, with what is
// actually free.
//
// A TIMETABLE THAT ONLY SHOWS AVAILABILITY IS USELESS TO AN EXISTING PARENT
// and a timetable that only shows the full week is useless to a new one. Both
// are here: the lanes are the teachers, the blocks are what is booked, and the
// gaps are therefore the answer to "when could we come".
//
// `laneHeight` is raised, because a block carrying a name and a grade wraps to
// three lines in a narrow slot and the default 48px slices it.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { TimeLaneGrid } from "@/components/ui/time-lane-grid";
import { SessionTable } from "@/components/ui/session-table";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/timetable")({ component: P });

const LANES = [
  { key: "oyelaran", label: "M Oyelaran · Strings · Room 1" },
  { key: "peach", label: "D Peach · Piano · Room 4" },
  { key: "ferrand", label: "J Ferrand · Wind · Room 2" },
  { key: "sowande", label: "K Sowande · Brass · The hall" },
];

const BLOCKS = [
  { id: "a1", lane: "oyelaran", start: 16, end: 16.5, label: "Violin · Gr 2" },
  { id: "a2", lane: "oyelaran", start: 16.5, end: 17, label: "Violin · Gr 1" },
  { id: "a3", lane: "oyelaran", start: 17.75, end: 18.5, label: "Viola · Gr 6" },
  { id: "a4", lane: "oyelaran", start: 18.5, end: 19.5, label: "Cello · DipABRSM" },
  { id: "b1", lane: "peach", start: 15.5, end: 16, label: "Piano · Gr 1" },
  { id: "b2", lane: "peach", start: 16, end: 16.75, label: "Piano · Gr 5" },
  { id: "b3", lane: "peach", start: 17.5, end: 18.25, label: "Piano · Gr 7" },
  { id: "b4", lane: "peach", start: 19, end: 20, label: "Adult · returner" },
  { id: "c1", lane: "ferrand", start: 16, end: 16.5, label: "Clarinet · Gr 2" },
  { id: "c2", lane: "ferrand", start: 16.5, end: 17.25, label: "Flute · Gr 4" },
  { id: "c3", lane: "ferrand", start: 18.5, end: 19.25, label: "Sax · Gr 6" },
  { id: "d1", lane: "sowande", start: 16.25, end: 16.75, label: "Cornet · beginner" },
  { id: "d2", lane: "sowande", start: 17, end: 17.75, label: "Trombone · Gr 5" },
  { id: "d3", lane: "sowande", start: 18, end: 20, label: "Brass band" },
];

function P() {
  return (
    <SiteChrome
      name="The Rivelin Music School"
      tagline="The week by teacher. The gaps are what is free."
      links={[
        { label: "Instruments", href: "#/" },
        { label: "Lessons", href: "#/lessons" },
        { label: "Fees", href: "#/fees" },
      ]}
      action={{ label: "Fees per term", href: "#/fees" }}
    >
      <div className="mx-auto max-w-6xl px-6 py-14">
        <h1 className="text-4xl font-semibold tracking-tight text-balance">The timetable</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Autumn term, week two. Teachers down the side, the afternoon and evening across. What is
          booked is a block; the gaps between them are what we can offer you.
        </p>

        <section className="mt-12">
          <SectionHeader
            eyebrow="Wednesday"
            title="A typical afternoon"
            description="Most families want between four and six, which is why that band is solid and half past seven is wide open."
          />
          <div className="mt-8 overflow-x-auto">
            <div className="min-w-[46rem]">
              {/* 68px rather than the default 48 — a block carrying an
                  instrument and a grade wraps to two lines in a 30-minute slot. */}
              <TimeLaneGrid lanes={LANES} blocks={BLOCKS} from={15} to={21} laneHeight={68} />
            </div>
          </div>
          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            If nothing here fits, ask anyway — teachers add hours when there is demand, and Saturday
            mornings have more room than any weekday evening.
          </p>
        </section>

        <section className="mt-14">
          <SectionHeader
            eyebrow="Ensembles"
            title="Free, and open now"
            description="Places left is the useful column. An orchestra needing violas will say so rather than take another violin."
          />
          <div className="mt-8">
            <SessionTable
              fundedLabel="Free with any lesson here"
              days={[
                {
                  day: "Tuesday",
                  sessions: [
                    { name: "Junior strings, grades 1–3", from: "17:00", to: "18:00", placesLeft: 4, funded: true, note: "Violas especially — nine violins, two violas." },
                    { name: "Senior orchestra, grade 5+", from: "18:15", to: "20:00", placesLeft: 2, funded: true },
                  ],
                },
                {
                  day: "Wednesday",
                  sessions: [
                    { name: "Wind band", from: "17:30", to: "19:00", placesLeft: 6, funded: true },
                    { name: "Jazz group, grade 4+", from: "19:15", to: "20:30", placesLeft: 0, funded: true, note: "Full — waiting list, two places usually free up in January." },
                  ],
                },
                {
                  day: "Saturday",
                  sessions: [
                    { name: "Brass band, all grades", from: "09:30", to: "11:30", placesLeft: 8, funded: true },
                    { name: "Beginner strings", from: "11:45", to: "12:30", placesLeft: 5, funded: true },
                  ],
                },
              ]}
            />
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader title="Timetable questions" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "Is the slot the same every week?",
                  answer:
                    "Yes, for the whole term. It is the same teacher, the same room and the same time, which is most of why a school works better than a diary of ad-hoc bookings.",
                },
                {
                  question: "What happens in the school holidays?",
                  answer:
                    "We follow Sheffield term dates and there are no lessons in the holidays. A term is billed as ten or eleven weeks and the fee reflects the actual count, not an average.",
                },
                {
                  question: "Can two children have back-to-back slots?",
                  answer: "We arrange that wherever we can — it is the single most requested thing and it saves a parent an hour in a car park. Ask when you book.",
                },
                {
                  question: "What if we miss a lesson?",
                  answer:
                    "A missed lesson is not refunded, because the teacher was there. Illness with a day's notice gets one catch-up a term, and everybody gets one — it is not a favour to be asked for.",
                },
              ]}
            />
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            <a className="underline underline-offset-4" href="#/">Instruments</a>
            {" · "}
            <a className="underline underline-offset-4" href="#/lessons">Lessons and ensembles</a>
            {" · "}
            <a className="underline underline-offset-4" href="#/fees">Fees</a>
          </p>
        </section>
      </div>
    </SiteChrome>
  );
}
