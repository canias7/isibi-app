// driving-school /book — the first lesson, and specifically what happens in it,
// because "book a lesson" is a frightening thing to click for a lot of people.
//
// THE LICENCE CHECK IS A LEGAL REQUIREMENT and the single most common reason a
// first lesson does not happen: no provisional, or the photocard expired. It
// is stated as the first item rather than discovered on a doorstep.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { AvailabilityGrid } from "@/components/ui/availability-grid";
import { WeekStrip } from "@/components/ui/week-strip";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/book")({ component: P });

const BRING = [
  { what: "Your provisional licence", detail: "The photocard itself. I have to see it before the engine starts — it is a legal requirement, not a formality, and an expired photo is the usual problem." },
  { what: "Glasses or lenses, if you wear them", detail: "You will be asked to read a plate at 20 metres. Do it now in your own street rather than find out at a test." },
  { what: "Sensible shoes", detail: "Not new trainers with a thick sole and not sandals. You need to feel the pedals and that is genuinely most of clutch control." },
  { what: "Nothing else", detail: "No paperwork, no deposit, no forms. Payment is at the end of the lesson, card or transfer." },
];

const FIRST = [
  { n: "1", what: "Ten minutes sitting still", detail: "Seat, mirrors, and where everything is. Nobody has ever regretted the ten minutes and plenty of people have been thrown by not having them." },
  { n: "2", what: "A quiet estate, moving off and stopping", detail: "Ballifield or the roads behind Sheffield Lane Top depending on where you are. Twenty minutes of exactly two things." },
  { n: "3", what: "The rest of the two hours on that", detail: "Moving off, stopping, and steering round a corner. That is the whole first lesson and it is meant to be." },
  { n: "4", what: "An honest estimate at the end", detail: "How many hours I think you need. It is a guess after two hours and I will say so, and I will revise it out loud as we go." },
];

function P() {
  return (
    <SiteChrome
      name="Loxley Drive"
      tagline="The first lesson — what happens, and what to bring."
      links={[
        { label: "Pass rate", href: "#/" },
        { label: "Lessons and prices", href: "#/lessons" },
      ]}
      action={{ label: "Lessons and prices", href: "#/lessons" }}
    >
      <div className="mx-auto max-w-5xl px-6 py-14">
        <h1 className="text-4xl font-semibold tracking-tight text-balance">Book a first lesson</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Two hours, £76, paid at the end. No deposit and no commitment to anything after it. If
          you decide I am not the right instructor, say so and I will suggest two others.
        </p>

        <section className="mt-12">
          <SectionHeader eyebrow="Bring" title="Four things, and one of them stops the lesson" />
          <ul className="mt-6 divide-y divide-border border-y border-border">
            {BRING.map((b) => (
              <li key={b.what} className="grid gap-2 py-5 md:grid-cols-[minmax(0,17rem)_1fr] md:gap-8">
                <p className="font-medium">{b.what}</p>
                <p className="text-sm leading-relaxed text-muted-foreground">{b.detail}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-14">
          <SectionHeader
            eyebrow="What actually happens"
            title="Far less than people fear"
            description="Nobody drives on a main road in their first lesson. If somebody has told you otherwise they were describing a different instructor."
          />
          <ol className="mt-6 divide-y divide-border border-y border-border">
            {FIRST.map((f) => (
              <li key={f.n} className="flex gap-5 py-5">
                <span className="w-6 shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">{f.n}</span>
                <div className="min-w-0">
                  <p className="font-medium">{f.what}</p>
                  <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">{f.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-14">
          <SectionHeader
            eyebrow="When"
            title="Two weeks out, and Tuesdays go first"
            description="Pick a day, then a start time. Lessons are two hours, so a 10:00 slot runs to 12:00."
          />
          <div className="mt-8 space-y-8">
            <div>
              <p className="text-sm font-medium">Week beginning 17 August</p>
              <div className="mt-3">
                <WeekStrip start={new Date("2026-08-17T00:00:00Z")} value="2026-08-19" disabled={["2026-08-22", "2026-08-23"]} />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Weekends are for existing learners taking tests. I do not teach beginners on a
                Saturday and I would rather say so than show you a slot that is not really there.
              </p>
            </div>
            <div>
              <p className="text-sm font-medium">Wednesday 19 August</p>
              <div className="mt-3">
                <AvailabilityGrid
                  slots={["08:00", "10:00", "12:00", "14:00", "16:00", "18:00"]}
                  taken={["10:00", "14:00", "16:00"]}
                  value="12:00"
                />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                The 18:00 slot runs until eight and is fine in summer. From late October I stop
                teaching beginners after dark, which is a preference rather than a rule.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader title="First lesson questions" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "I am extremely nervous.",
                  answer:
                    "Say so when you book and I will start somewhere emptier and quieter. About a third of people say this. The ten minutes sitting still is mostly for exactly that and it works.",
                },
                {
                  question: "Can I book without a provisional licence?",
                  answer:
                    "You can book, but the lesson cannot happen until it arrives — I am not permitted to teach without seeing it. Apply now; it takes about three weeks and it is the thing people leave too late.",
                },
                {
                  question: "How do I pay?",
                  answer: "Card in the car or a transfer afterwards. Nothing up front for a single lesson, and blocks are only ever paid for once you have had one.",
                },
                {
                  question: "What if I need to cancel?",
                  answer:
                    "48 hours and it costs nothing. Less than that on a first lesson is still free — you have not met me yet and charging somebody for changing their mind is a poor start.",
                },
              ]}
            />
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            <a className="underline underline-offset-4" href="#/">The pass rate</a>
            {" · "}
            <a className="underline underline-offset-4" href="#/lessons">Prices and blocks</a>
          </p>
        </section>
      </div>
    </SiteChrome>
  );
}
