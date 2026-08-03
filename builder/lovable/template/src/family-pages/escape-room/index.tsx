// escape-room — PICK-A-SLOT-FIRST, with the MINIMUM GROUP SIZE on the card.
//
// A COUPLE ARRIVING FOR A FOUR-PERSON ROOM IS THE COMMONEST DISAPPOINTMENT IN
// THIS BUSINESS. Escape rooms are designed around a number of pairs of hands
// and two people in a room built for five have a frustrating hour. Every venue
// knows it and puts "2–6 players" on the card, which reads as a range rather
// than as advice. Saying "works badly with two" is the useful version.
//
// AND THE ESCAPE RATE IS PUBLISHED. It is the only honest measure of difficulty
// and venues hide it because a 22% room sounds like a bad time.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { AvailabilityGrid } from "@/components/ui/availability-grid";
import { RatingSummary } from "@/components/ui/rating-summary";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/")({ component: P });

// `shot` IS THE ROOM, NOT A LOGO. A picture of a set is the only way to answer
// "how dark is it", "is it a shed or is it built", and "will my mother enjoy
// this" — which are the three things people actually want and which no
// difficulty rating can say. Written as art direction rather than as a label,
// because the placeholder prints the alt and the alt is what a photographer
// would be handed.
const ROOMS = [
  { name: "The Grinding Hull", difficulty: "Hard", rate: "31% escape", best: "4 to 6", worst: "Poor with two — too many locks for one pair of hands", mins: 60, note: "1890s cutlery works. The most physical room and the one with the crawl.", shot: "The grinding trough, lit by one bulb, water still on the stone" },
  { name: "The Flood", difficulty: "Medium", rate: "48% escape", best: "3 to 5", worst: "Fine with two, tight with six", mins: 60, note: "1864, the night the dam went. Our most popular and the best first room.", shot: "The dam keeper's desk at 11pm, lamp burning, the ledger open" },
  { name: "Cutlery Patent 1913", difficulty: "Easy", rate: "67% escape", best: "2 to 4", worst: "Six is too many — people stand about", mins: 45, note: "The one to bring somebody who has never done this. Genuinely fun to fail.", shot: "The cutler's bench in daylight — bright, warm, nothing hidden" },
  { name: "The Nightwatchman", difficulty: "Very hard", rate: "12% escape", best: "5 to 6", worst: "Do not attempt with fewer than four", mins: 75, note: "Built for people who have done ten of these. Most groups do not get out and that is the point.", shot: "The watchman's hut, four minutes to midnight, keys on the hook" },
];

function P() {
  return (
    <SiteChrome
      name="Neepsend Lock-In"
      tagline="Four rooms in a Victorian cutlery works. Sheffield."
      links={[
        { label: "The rooms", href: "#/rooms" },
        { label: "Book", href: "#/book" },
        { label: "Questions", href: "#questions" },
      ]}
      action={{ label: "Book a slot", href: "#tonight" }}
    >
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <h1 className="max-w-3xl text-5xl font-semibold tracking-tight text-balance">
            How many of you, and how hard do you want it
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Every card says the escape rate and the group size it actually works with — not the
            range it technically allows. Two people in a room built for five have a frustrating
            hour and it is the commonest way an evening goes wrong.
          </p>

          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {ROOMS.map((r) => (
              <article key={r.name} className="overflow-hidden rounded-xl border border-border">
                <SafeImage src={null} alt={r.shot} ratio="16/9" className="rounded-none" />
                <div className="p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h2 className="text-lg font-semibold">{r.name}</h2>
                  <span className="text-sm tabular-nums text-muted-foreground">{r.mins} minutes</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{r.note}</p>
                <dl className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div>
                    <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Difficulty</dt>
                    <dd className="mt-0.5 text-sm font-medium">{r.difficulty}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Escape rate</dt>
                    <dd className="mt-0.5 text-sm font-medium tabular-nums">{r.rate}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Best with</dt>
                    <dd className="mt-0.5 text-sm font-medium">{r.best}</dd>
                  </div>
                </dl>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{r.worst}</p>
                </div>
              </article>
            ))}
          </div>
          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            The escape rates are real and updated monthly. The Nightwatchman is 12% and we are not
            embarrassed about it — it is built for people who have done ten of these, and most
            groups do not get out.
          </p>
        </div>
      </section>

      <section className="border-b border-border" id="tonight">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <SectionHeader
            eyebrow="Tonight"
            title="Thursday 6 August — what is still free"
            description="Four rooms running in parallel. A slot is the room for the hour whatever your group size, so five people cost the same as three."
          />
          <div className="mt-8 max-w-3xl">
            <AvailabilityGrid
              slots={["17:00", "18:15", "19:30", "20:45", "22:00"]}
              taken={["18:15", "19:30"]}
              value="20:45"
            />
          </div>
          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Arrive fifteen minutes before. The briefing is about eight minutes and the clock does
            not start until it is finished — a late group loses their own time rather than the next
            group's.
          </p>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <div className="grid items-start gap-10 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <SectionHeader
                eyebrow="What actually happens"
                title="An hour, a games master, and as many clues as you want"
                description="Nobody is locked in — the door opens from the inside at any moment and always will. That is a fire regulation and it is also just decent."
              />
              <ul className="mt-6 space-y-3 text-sm leading-relaxed text-muted-foreground">
                <li>A briefing, about eight minutes, before the clock starts.</li>
                <li>A games master watches on camera and talks to you through a speaker.</li>
                <li>Clues are unlimited and free. Nobody has ever been "penalised" for asking and we would not run a room that way.</li>
                <li>You can leave at any point, for any reason, and there is a photograph afterwards if you want one.</li>
              </ul>
            </div>
            <div>
              <SectionHeader eyebrow="What people say" title="412 reviews" />
              <div className="mt-6">
                {/* index 0 is one star — the distribution runs upwards. */}
                <RatingSummary average={4.7} total={412} distribution={[4, 6, 22, 71, 309]} />
              </div>
              <p className="mt-5 max-w-lg text-sm leading-relaxed text-muted-foreground">
                Most of the three-star reviews are people who did the Nightwatchman with three
                players. It is on the card and we should probably say it louder.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="questions">
        <div className="mx-auto max-w-3xl px-6 py-14">
          <SectionHeader title="Before you book" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "Is it actually scary?",
                  answer:
                    "No jump scares, no actors, and nothing touches you. The Grinding Hull is dark in places and has a crawl through a low space — if that is a problem tell us and there is a route round it.",
                },
                {
                  question: "Can children do it?",
                  answer:
                    "Over eight with an adult in the room, and Cutlery Patent is the one for them. Under-eights genuinely do not enjoy it and we would rather say so than take the booking.",
                },
                {
                  question: "Is it accessible?",
                  answer:
                    "The Flood and Cutlery Patent are step-free and workable in a wheelchair — we have done it many times. The Grinding Hull has a crawl and the Nightwatchman has a staircase; neither is, and we will not pretend.",
                },
                {
                  question: "What if we do not get out?",
                  answer:
                    "Most groups in some rooms do not, and it is not a failure. The games master walks you through what was left and everybody stays for the last bit — that is often the best part of the hour.",
                },
              ]}
            />
          </div>
        </div>
      </section>
    </SiteChrome>
  );
}
