// driving-school /lessons — what each kind of lesson actually suits, rather
// than a price grid where the biggest block is highlighted.
//
// THE HONEST ADVICE IS "BUY THE SMALL BLOCK FIRST". A twenty-hour block from
// an instructor you have never met is a bet on a working relationship, and
// every school pushes it because it is the money. Saying so costs a few
// up-front sales and is the reason people recommend you.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { PriceList } from "@/components/ui/price-list";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/lessons")({ component: P });

const KINDS = [
  {
    what: "Hourly, pay as you go",
    suits: "Everybody, for the first few",
    detail:
      "Start here. You are buying a working relationship as much as tuition and neither of us knows yet whether it fits. Nobody should hand over £660 to somebody they have not sat in a car with.",
  },
  {
    what: "Block of 10",
    suits: "Once you know it is working",
    detail:
      "£35 an hour rather than £38, valid twelve months, refundable pro rata and transferable to a family member. There is no version of this where you lose money by stopping.",
  },
  {
    what: "Block of 20",
    suits: "Somebody starting from nothing with time to commit",
    detail:
      "£33 an hour. Roughly half of what a beginner needs, so it is not a whole course and I will not describe it as one.",
  },
  {
    what: "Intensive week",
    suits: "Only somebody who already drives",
    detail:
      "A licence from abroad, or years of private practice. For a complete beginner I turn these down — thirty hours in five days produces people who pass a test and cannot drive in the rain.",
  },
  {
    what: "Test-day hire",
    suits: "Anybody using my car for the test",
    detail:
      "Two hours before, then the car for the test itself. Included free if you have had ten or more hours with me, because charging for it then is charging twice.",
  },
  {
    what: "Motorway lesson",
    suits: "The fortnight after passing",
    detail:
      "Legal on a provisional since 2018 and almost nobody does it. Two hours on the M1 with somebody beside you is worth more than any other two hours you will buy.",
  },
];

const PRICES = [
  { name: "Single hour", price: 38, meta: "per hour" },
  { name: "Block of 10", description: "Valid 12 months, refundable pro rata", price: 350, meta: "£35 an hour" },
  { name: "Block of 20", description: "Valid 12 months, refundable pro rata", price: 660, meta: "£33 an hour" },
  { name: "Intensive week", description: "30 hours over five days, existing drivers only", price: 980, meta: "flat" },
  { name: "Test-day hire", description: "Free after 10 hours with me", price: 130, meta: "flat" },
  { name: "Motorway lesson", description: "Two hours, after passing", price: 80, meta: "flat" },
  { name: "Theory test support", description: "An hour going through the hazard perception properly", price: 30, meta: "flat" },
];

function P() {
  return (
    <SiteChrome
      name="Loxley Drive"
      tagline="What each kind of lesson actually suits."
      links={[
        { label: "Pass rate", href: "/" },
        { label: "Book a first lesson", href: "/book" },
      ]}
      action={{ label: "Book a first lesson", href: "/book" }}
    >
      <div className="mx-auto max-w-5xl px-6 py-14">
        <h1 className="text-4xl font-semibold tracking-tight text-balance">Lessons</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Buy an hour first. Not because I am being modest about the blocks — because you are
          buying a person as much as tuition, and neither of us knows yet whether it works.
        </p>

        <section className="mt-12">
          <SectionHeader eyebrow="Six kinds" title="And who each one is actually for" />
          <ul className="mt-6 divide-y divide-border border-y border-border">
            {KINDS.map((k) => (
              <li key={k.what} className="py-5">
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <p className="font-medium">{k.what}</p>
                  <p className="text-sm text-muted-foreground">{k.suits}</p>
                </div>
                <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">{k.detail}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-14">
          <div className="grid items-start gap-10 lg:grid-cols-[1fr_1fr]">
            <div>
              <SectionHeader
                eyebrow="Prices"
                title="Seven lines, and that is the whole list"
                description="No booking fee, no fuel surcharge, no admin charge for moving a lesson. Prices held from January 2025 and reviewed each January."
              />
              <p className="mt-5 max-w-lg text-sm leading-relaxed text-muted-foreground">
                Lessons are two hours by default. One hour is available and I would rather you did
                not — twenty minutes of it is getting to somewhere useful and back.
              </p>
            </div>
            <PriceList items={PRICES} />
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader
            eyebrow="Cancelling"
            title="48 hours, and the exceptions are real"
            description="Less than that and it is charged, because the slot cannot be filled. Illness, a bereavement or a shift changed on you are not charged, and I will not ask for proof."
          />
        </section>

        <section className="mt-14">
          <SectionHeader title="Lesson questions" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "Can I use a block for the theory support hour?",
                  answer: "Yes, and for the motorway lesson afterwards. Block hours are hours — they are not restricted to any particular sort of lesson.",
                },
                {
                  question: "What if I want to stop mid-block?",
                  answer:
                    "The unused hours come back at the block rate, no questions and no admin fee. It is your money and you are entitled to change your mind about me.",
                },
                {
                  question: "Do you pick up from work or college?",
                  answer:
                    "Anywhere in S6, S10, S35 and S36. Further out is fine if the lesson is two hours — otherwise most of it is spent driving to somewhere worth practising.",
                },
                {
                  question: "Can a parent sit in?",
                  answer:
                    "Yes, any lesson, and for the first one I often suggest it. It helps a lot with private practice afterwards if they have heard what I am asking for.",
                },
              ]}
            />
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            <a className="underline underline-offset-4" href="/">The pass rate</a>
            {" · "}
            <a className="underline underline-offset-4" href="/book">Book a first lesson</a>
          </p>
        </section>
      </div>
    </SiteChrome>
  );
}
