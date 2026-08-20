// solar /survey — free, no obligation, and what it actually measures.
//
// "FREE NO-OBLIGATION SURVEY" IS THE MOST DEVALUED PHRASE IN THIS INDUSTRY,
// because it usually means a two-hour sales visit with a discount that expires
// at the door. Saying what the ninety minutes measures — rafter centres, a
// shading instrument, the consumer unit — and that nobody will ask for a
// decision on the day, is how it becomes a real offer again.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { QuoteRequest } from "@/components/ui/quote-request";
import { ArrangementSteps } from "@/components/ui/arrangement-steps";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/survey")({ component: P });

const MEASURES = [
  { what: "The roof, from outside and from in the loft", why: "Pitch, orientation, area, and the rafter centres — which decide the mounting and occasionally decide that it cannot be done." },
  { what: "Shading, with an instrument", why: "A device that maps the sun's path against the horizon for the whole year. Doing it by eye in August is how people are sold arrays that lose a fifth of their output in winter." },
  { what: "The consumer unit and the earthing", why: "Some older installations need a board upgrade and it is £400 to £600. Better found now than added to an invoice." },
  { what: "The cable run", why: "Where the inverter goes and how far it is from the board. It is the thing that turns a two-day job into a three-day one." },
  { what: "Your actual consumption", why: "From the bill, and from a conversation about who is in during the day. This moves the payback more than any hardware choice." },
];

function P() {
  return (
    <SiteChrome
      name="Rivelin Renewables"
      tagline="A real survey — ninety minutes, an instrument, and no decision asked for."
      links={[
        { label: "Estimate", href: "/" },
        { label: "How it works", href: "/how-it-works" },
      ]}
      action={{ label: "How it works", href: "/how-it-works" }}
    >
      <div className="mx-auto max-w-5xl px-6 py-14">
        <h1 className="text-4xl font-semibold tracking-tight text-balance">Book a survey</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Free, ninety minutes, and nobody will ask you to decide anything on the day. There is no
          price that expires when the surveyor leaves — the quote is held for six months and it is
          the same figure whether you say yes in a week or in May.
        </p>

        <section className="mt-12">
          <SectionHeader
            eyebrow="What it measures"
            title="Five things, with an instrument for the one that matters"
            description="A shading survey done by eye on a sunny afternoon is not a survey. This is what separates a real one from a sales visit."
          />
          <ul className="mt-8 divide-y divide-border border-y border-border">
            {MEASURES.map((m) => (
              <li key={m.what} className="grid gap-1 py-5 md:grid-cols-[minmax(0,19rem)_1fr] md:gap-8">
                <p className="font-medium">{m.what}</p>
                <p className="text-sm leading-relaxed text-muted-foreground">{m.why}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-14">
          <div className="grid items-start gap-10 lg:grid-cols-[1fr_1fr]">
            <div>
              <SectionHeader
                eyebrow="Tell us what you are thinking about"
                title="And how soon"
                description="Nothing here commits you to anything. Most people who fill this in are comparing three installers, which is exactly what we would do."
              />
              <p className="mt-5 max-w-lg text-sm leading-relaxed text-muted-foreground">
                If your roof is on the list of things we turn down, we will say so on the phone
                rather than sending somebody out and finding a reason to quote anyway.
              </p>
            </div>
            <QuoteRequest
              trades={["Solar panels", "Solar and a battery", "Battery only", "Heat pump", "EV charger", "Not sure yet"]}
              urgencies={["As soon as possible", "In the next few months", "Just getting figures"]}
              onSubmit={() => {}}
            />
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader
            eyebrow="What happens after"
            title="Three things, and none of them is a phone call at seven in the evening"
            description="One follow-up, and then nothing unless you get in touch. That is the whole policy."
          />
          <div className="mt-8 max-w-3xl">
            <ArrangementSteps
              nothingLabel="Nothing you need to do"
              steps={[
                {
                  title: "A written quote",
                  what: "One figure, everything in it, plus the generation estimate as a band with its assumptions and the shading survey attached as a chart.",
                  when: "Three working days",
                },
                {
                  title: "One follow-up",
                  what: "A single email a fortnight later asking whether you have questions. If you do not reply we will not chase, and you will not hear from us again.",
                  youDo: "Reply, or do not. Both are fine.",
                  when: "Two weeks later",
                },
                {
                  title: "The quote stays valid for six months",
                  what: "Same price, no expiry pressure, no 'if you sign today'. If the panel price moves in your favour we will pass that on rather than hold you to the old figure.",
                  when: "Six months",
                },
              ]}
            />
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader title="Survey questions" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "Is it really free?",
                  answer:
                    "Yes, including if we then tell you not to bother. About one survey in six ends with us recommending against it, and we would rather that than an install somebody regrets.",
                },
                {
                  question: "Do I have to be in?",
                  answer:
                    "For the loft and the consumer unit, yes. The roof and the shading can be done from outside, so if the loft is already accessible somebody else can let us in.",
                },
                {
                  question: "Will you use my data for anything?",
                  answer:
                    "No. We do not sell leads, we are not part of a lead-generation network, and if you go elsewhere your details are deleted. That is worth saying because a lot of 'free survey' offers in this industry exist to sell your details.",
                },
                {
                  question: "Can I get a quote without a survey?",
                  answer:
                    "We will give you a range from a satellite image and a phone call. We will not give you a price, because a price from an aerial photograph is a guess dressed as a commitment.",
                },
              ]}
            />
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            <a className="underline underline-offset-4" href="/">The estimate</a>
            {" · "}
            <a className="underline underline-offset-4" href="/how-it-works">The install and what we refuse</a>
          </p>
        </section>
      </div>
    </SiteChrome>
  );
}
