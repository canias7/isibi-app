// optician /eye-test — what happens in the thirty minutes, because "book an
// eye test" is a vaguely alarming thing to click for anybody who has not had
// one.
//
// AN EYE TEST IS A HEALTH CHECK AND ALMOST NOBODY KNOWS IT. Diabetes, high
// blood pressure, a brain tumour and glaucoma are all things an optometrist has
// spotted first, in somebody who came in about reading glasses. Saying so is
// both true and the strongest argument for booking one.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { PractitionerCard } from "@/components/ui/practitioner-card";
import { AvailabilityGrid } from "@/components/ui/availability-grid";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/eye-test")({ component: P });

const STEPS = [
  { n: "1", what: "Questions, five minutes", detail: "What you have noticed, your general health, medication, and whether anybody in the family has glaucoma. The medication question matters more than people expect." },
  { n: "2", what: "Retinal photographs", detail: "A bright flash and nothing else. No drops for this one. It is included at no charge and it is the record we compare against in two years' time." },
  { n: "3", what: "The letters chart", detail: "The part everybody pictures. It is a few minutes of the thirty and it is the least diagnostic thing we do." },
  { n: "4", what: "Which is better, one or two", detail: "Refraction. There is no wrong answer and 'they look the same' is genuinely useful information, not a failure." },
  { n: "5", what: "The pressure test and the field test", detail: "A puff of air, then some flashing dots. These two are the glaucoma checks and they are the reason the whole appointment is worth having." },
  { n: "6", what: "What we found, in plain words", detail: "Including when the answer is that nothing has changed. You leave with your prescription printed whether or not you buy anything." },
];

function P() {
  return (
    <SiteChrome
      name="Hillsborough Eyecare"
      tagline="Thirty minutes, six parts, and what each one is actually for."
      links={[
        { label: "Home", href: "#/" },
        { label: "Frames and lenses", href: "#/frames" },
      ]}
      action={{ label: "Book a test", href: "#book" }}
    >
      <div className="mx-auto max-w-5xl px-6 py-14">
        <h1 className="text-4xl font-semibold tracking-tight text-balance">The eye test</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Thirty minutes, and only a few of them are the letters chart. Most of it is a health
          check — an optometrist is often the first person to spot diabetes, high blood pressure or
          glaucoma, in somebody who came in about reading glasses.
        </p>

        <section className="mt-12">
          <SectionHeader eyebrow="What happens" title="Six parts, in this order" />
          <ol className="mt-6 divide-y divide-border border-y border-border">
            {STEPS.map((s) => (
              <li key={s.n} className="flex gap-5 py-5">
                <span className="w-6 shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">{s.n}</span>
                <div className="min-w-0">
                  <p className="font-medium">{s.what}</p>
                  <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">{s.detail}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Nothing in it hurts. The puff of air is startling once and then it is over. Nobody has
            ever had to identify a colour, and there is no part you can fail.
          </p>
        </section>

        <section className="mt-14">
          <SectionHeader eyebrow="Bring" title="Three things, and none of them essential" />
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">Your current glasses</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                All of them, including the pair from the chemist. We measure what you actually have
                rather than what the last prescription said.
              </p>
            </div>
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">A list of your medication</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                A photograph of the boxes is fine. Several common drugs affect vision and it changes
                what we look for.
              </p>
            </div>
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">Somebody to drive, possibly</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Only if we need to use drops, which is uncommon and which we would warn you about
                when booking. They wear off in about four hours.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader eyebrow="Who you will see" title="Two optometrists, both here every week" />
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <PractitionerCard
              name="Nadia Ferreira"
              role="Optometrist"
              letters="BSc(Hons) MCOptom"
              register="GOC"
              registerNumber="01-29114"
              treats={["Adults and children", "Glaucoma monitoring", "Dry eye", "Contact lens fitting"]}
              languages={["English", "Portuguese"]}
              note="Here since 2011 and the reason a lot of people come from the other side of the city. Particularly good with children and with anybody who has had a bad experience elsewhere."
              accepting
            />
            <PractitionerCard
              name="Tom Ridgeway"
              role="Optometrist"
              letters="MOptom MCOptom"
              register="GOC"
              registerNumber="01-31882"
              treats={["Adults", "Low vision", "Complex prescriptions", "Post-cataract"]}
              note="Also runs the low-vision clinic on Wednesday mornings, which is a longer appointment and free on referral."
              accepting
            />
          </div>
        </section>

        <section className="mt-14" id="book">
          <SectionHeader
            eyebrow="Book"
            title="Thursday 6 August"
            description="Or ring 0114 234 5510. There is usually something within a week, and same-day if somebody cancels."
          />
          <div className="mt-6 max-w-2xl">
            <AvailabilityGrid
              slots={["09:00", "09:40", "10:20", "11:00", "14:00", "14:40", "15:20", "16:00", "17:20", "18:00"]}
              taken={["09:40", "11:00", "14:00", "16:00"]}
              value="10:20"
            />
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader title="Test questions" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "My child will not sit still.",
                  answer:
                    "That is fine and expected. We can test a child who cannot read, cannot talk, or will not cooperate — there are pictures, mirrors and objective methods that need nothing from them at all.",
                },
                {
                  question: "Will you tell me I need glasses when I do not?",
                  answer:
                    "No. About one test in five here ends with 'nothing has changed, come back in two years'. We would rather have you for thirty years than sell you a pair today.",
                },
                {
                  question: "What if you find something serious?",
                  answer:
                    "We refer, usually same day for anything urgent, and we ring you rather than write. The Hallamshire eye casualty takes our referrals directly.",
                },
                {
                  question: "Can I get a test at home?",
                  answer:
                    "If you cannot leave the house unaccompanied you are entitled to a free NHS domiciliary test. We do not do them ourselves and we will give you the number of the service that does.",
                },
              ]}
            />
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            <a className="underline underline-offset-4" href="#/">Back to booking and frames</a>
            {" · "}
            <a className="underline underline-offset-4" href="#/frames">Frames and lenses</a>
          </p>
        </section>
      </div>
    </SiteChrome>
  );
}
