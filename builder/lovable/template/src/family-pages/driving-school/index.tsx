// driving-school — PASS-RATE-FIRST: the figure with its sample size, and the
// two waits nobody warns a learner about.
//
// A PASS RATE WITHOUT A DENOMINATOR IS NOT A FIGURE. "92% pass rate" on an
// instructor who put four people through last year means three of them passed,
// and every driving school in the country publishes it that way. The count is
// printed next to it.
//
// THE TEST-CENTRE WAIT IS THE REAL CONSTRAINT and no school mentions it,
// because it makes the whole thing look slow. It is not the school's fault and
// saying so first is more useful than pretending lessons are the bottleneck.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { PriceList } from "@/components/ui/price-list";
import { RatingSummary } from "@/components/ui/rating-summary";
import { PractitionerCard } from "@/components/ui/practitioner-card";
import { MediaGrid } from "@/components/ui/media-grid";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/")({ component: P });

const PRICES = [
  { name: "Single hour", description: "Pay as you go, no commitment", price: 38, meta: "per hour" },
  { name: "Block of 10", description: "Paid up front, valid a year", price: 350, meta: "£35 an hour" },
  { name: "Block of 20", description: "The usual amount somebody needs from scratch", price: 660, meta: "£33 an hour" },
  { name: "Test-day hire", description: "Two-hour warm-up plus the car for the test", price: 130, meta: "flat" },
  { name: "Motorway lesson, after passing", description: "Two hours, worth doing", price: 80, meta: "flat" },
];

function P() {
  return (
    <SiteChrome
      name="Loxley Drive"
      tagline="One instructor, one car, Sheffield north and west. Learning since 2009."
      links={[
        { label: "Lessons and prices", href: "#/lessons" },
        { label: "Book a first lesson", href: "#/book" },
        { label: "Questions", href: "#questions" },
      ]}
      action={{ label: "Book a first lesson", href: "#/book" }}
    >
      <section className="border-b border-border">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            DVSA approved driving instructor · Grade A · Badge 429117
          </p>
          <h1 className="mt-3 max-w-3xl text-5xl font-semibold tracking-tight text-balance">
            61 of 84 passed first time last year
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            That is 73%, against a national average of about 48%. The number that matters there is
            the 84 — a school quoting 92% off nine candidates is quoting you eight people, and
            almost all of them do.
          </p>

          <div className="mt-10 grid gap-8 md:grid-cols-3">
            <div>
              <p className="text-4xl font-semibold tabular-nums">73%</p>
              <p className="mt-1 text-sm text-muted-foreground">First-time pass rate, 84 candidates, 2025</p>
            </div>
            <div>
              <p className="text-4xl font-semibold tabular-nums">2 weeks</p>
              <p className="mt-1 text-sm text-muted-foreground">Wait for a first lesson with me</p>
            </div>
            <div>
              <p className="text-4xl font-semibold tabular-nums">17 weeks</p>
              <p className="mt-1 text-sm text-muted-foreground">Wait for a test at Sheffield Handsworth</p>
            </div>
          </div>

          <p className="mt-8 max-w-2xl leading-relaxed text-muted-foreground">
            That third figure is the one that decides how long this takes and it is nothing to do
            with me. Book the theory test now, and book the practical the moment you are eligible —
            a date can always be moved forward if one frees up, and it cannot be conjured.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <a className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" href="#/book">
              Book a first lesson
            </a>
            <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="#/lessons">
              Prices and blocks
            </a>
          </div>
        </div>
      </section>

      {/* THE CAR, WHICH IS A REAL QUESTION AND NOT A VANITY ONE. Learners ask
          what car before they ask almost anything else, because a first lesson
          in something enormous is genuinely frightening and because a manual
          licence and an automatic one are different licences. The dual
          controls are the other half — a parent paying for lessons wants to
          see them. */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <MediaGrid
            columns={3}
            ratio="4/3"
            items={[
              { src: null, alt: "The Corsa on a residential street, roof box off, school sign on the door", caption: "A 1.2 Corsa. Small, light, and forgiving of a first clutch." },
              { src: null, alt: "The passenger footwell showing the dual clutch and brake pedals", caption: "Dual controls, checked every service. Nobody is ever alone with it." },
              { src: null, alt: "The Sheffield test centre car park at Handsworth, three cars waiting", caption: "Handsworth. We do the last four lessons on the actual test routes." },
            ]}
          />
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <div className="grid items-start gap-10 lg:grid-cols-[1fr_1fr]">
            <div>
              <SectionHeader
                eyebrow="What it costs"
                title="Blocks are cheaper and they are not a trap"
                description="Valid a year, refundable pro rata if you stop, and transferable to a sibling. Nobody should lose money because life happened."
              />
              <p className="mt-5 max-w-lg text-sm leading-relaxed text-muted-foreground">
                Most people from scratch need between 35 and 45 hours. Anybody quoting you twenty is
                either teaching you to pass one route or has not met you yet.
              </p>
            </div>
            <PriceList items={PRICES} />
          </div>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <div className="grid items-start gap-10 md:grid-cols-2">
            <PractitionerCard
              name="Ade Kowalczyk"
              role="Approved driving instructor"
              letters="ADI, grade A"
              register="DVSA"
              registerNumber="429117"
              treats={["Complete beginners", "Nervous drivers", "Retests after a fail", "Licence exchange from abroad"]}
              languages={["English", "Polish"]}
              note="Sixteen years. Was a paramedic before this and it shows in how I teach observation — most learners are looking at the wrong thing rather than looking too little."
              accepting
            />
            <div>
              <SectionHeader eyebrow="What people say" title="87 reviews, and the ones that are not five stars" />
              <div className="mt-6">
                {/* index 0 is ONE star — the distribution runs upwards. */}
                <RatingSummary average={4.8} total={87} distribution={[1, 1, 2, 9, 74]} />
              </div>
              <p className="mt-5 max-w-lg text-sm leading-relaxed text-muted-foreground">
                The one-star is somebody I stopped teaching after they turned up to a lesson having
                had a drink. I would do it again and I would rather the review stayed up.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="questions">
        <div className="mx-auto max-w-3xl px-6 py-14">
          <SectionHeader title="Before the first lesson" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "How many lessons will I actually need?",
                  answer:
                    "Between 35 and 45 from a standing start, plus private practice if you can get it. I will give you a real estimate after two hours, and I will revise it out loud rather than quietly sell you more.",
                },
                {
                  question: "Do you do intensive courses?",
                  answer:
                    "A week-long course, yes, for somebody who already drives — a licence from abroad, or years of private practice. For a complete beginner I will decline, because it produces people who pass and cannot drive.",
                },
                {
                  question: "Which test centre?",
                  answer:
                    "Handsworth mainly. Rotherham is often six weeks sooner and I am happy to take you there — the routes are different but not harder, and I teach both.",
                },
                {
                  question: "I failed twice with someone else.",
                  answer:
                    "Roughly a fifth of my learners are in exactly that position and the pass rate above includes them. Two hours to see where you are, then an honest plan.",
                },
                {
                  question: "Automatic?",
                  answer: "Manual only, in a Corsa. I would rather send you to somebody who does automatics properly than buy a second car and be mediocre at it.",
                },
              ]}
            />
          </div>
        </div>
      </section>
    </SiteChrome>
  );
}
