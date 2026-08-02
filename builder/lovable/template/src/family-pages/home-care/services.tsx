// home-care /services — each kind of care, and what a visit of it actually
// includes. "Personal care" is a phrase from a regulator, not a description of
// what somebody will do in your mother's kitchen at half seven.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Faq } from "@/components/ui/faq";
import { InspectionRating } from "@/components/ui/inspection-rating";
import { RateCard } from "@/components/ui/rate-card";
import { SectionHeader } from "@/components/ui/section-header";
import { RATING, RATES } from "./index";
export const Route = createFileRoute("/services")({ component: P });
const SERVICES = [
  {
    name: "Personal care",
    who: "Somebody who needs help washing, dressing or getting to the loo",
    what: "The one the phrase is usually hiding. Washing or a full shower, dressing, continence care, catheter bags, skin checks and creams, teeth and hair. Done at your pace, in your bathroom, by somebody who has done it four hundred times and will not make it strange.",
    typical: "Twice a day, 45 minutes each",
  },
  {
    name: "Medication support",
    who: "Somebody managing more tablets than is reasonable",
    what: "Prompting, or administering from a blister pack the pharmacy makes up. We keep a chart and we count what is left, which is how you find out early that somebody has stopped taking something. Insulin and anything invasive is a district nurse and we make the referral.",
    typical: "Alongside another call, no extra charge",
  },
  {
    name: "Meals and shopping",
    who: "Somebody eating badly, or not eating",
    what: "A hot meal cooked in your kitchen and sat with while it is eaten, which is the part that matters — most people who stop eating stop because eating alone is miserable. Plus the fridge checked, the shopping done or ordered, and the bins out.",
    typical: "Once a day, an hour",
  },
  {
    name: "Sitting and companionship",
    who: "A family carer who needs to leave the house",
    what: "Two to four hours with no task list. A walk, the crossword, the garden, cards, or the telly with somebody in the room. It is the service that keeps family carers going and the one people feel silly asking for.",
    typical: "Weekly, 2–4 hours",
  },
  {
    name: "Dementia care",
    who: "Somebody who needs the same face and the same order every time",
    what: "The same two carers, always, because a new face at the door is the thing that goes wrong. Routines kept in the same order, prompting rather than doing, and a log that tells the family what a normal day looks like so a bad one is visible.",
    typical: "Two to four calls a day",
  },
  {
    name: "Waking nights and live-in",
    who: "Somebody who cannot safely be alone",
    what: "A carer awake in the house for ten hours, repositioning, the loo, medication and reassurance. Or live-in: one carer resident, with two hours off a day and a break every fortnight covered by somebody you have met.",
    typical: "Nightly, or a week at a time",
  },
  {
    name: "Reablement after hospital",
    who: "Somebody home after a fall or an operation",
    what: "More care at the start and less every week, which is the opposite of how most packages go. Six weeks is typical and about half our reablement clients need nothing at the end of it. We will tell you when to stop paying us.",
    typical: "Reducing over 6 weeks",
  },
  {
    name: "End of life care",
    who: "Somebody who wants to die at home",
    what: "Alongside the district nurses and the hospice team, not instead of them. Whatever hours are needed, arranged within a day, and we do not put the rate up. The same carers to the end, because by then they are not strangers.",
    typical: "Whatever it takes",
  },
];
function P() {
  return (
    <SiteChrome name="Loxley Home Care" tagline="Care at home in west Sheffield. Employed carers, CQC Good."
      links={[{ label: "Home", href: "#/" }, { label: "Arrange", href: "#/arrange" }]}
      action={{ label: "Arrange an assessment", href: "#/arrange" }}>

      <div className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="What we do" title="Eight kinds of care, described properly"
          description="'Personal care' is a phrase from a regulator. This is what somebody actually does in your mother's kitchen at half past seven in the morning." />

        <div className="mt-10 divide-y divide-border border-y border-border">
          {SERVICES.map((s) => (
            <article key={s.name} className="grid gap-x-10 gap-y-3 py-8 lg:grid-cols-[1fr_1.6fr]">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">{s.name}</h2>
                <p className="mt-2 text-base text-muted-foreground">{s.who}</p>
                <p className="mt-3 text-sm">
                  <span className="text-muted-foreground">Typically </span>
                  <span className="font-medium">{s.typical}</span>
                </p>
              </div>
              <p className="max-w-prose text-base leading-relaxed text-muted-foreground">{s.what}</p>
            </article>
          ))}
        </div>

        <section className="mt-14 border-t border-border pt-10">
          <div className="grid gap-12 lg:grid-cols-[1.2fr_1fr]">
            <div>
              <SectionHeader eyebrow="What each costs" title="One rate, by length and by day"
                description="Every service above is charged at the same rates — what changes is how long and how often, not what kind of care it is. A dementia call is not dearer than any other call." />
              <RateCard className="mt-6" unit="hour" bands={["Weekday", "Weekend", "Bank holiday"]} rates={RATES} />
            </div>
            <div>
              <InspectionRating {...RATING} />
              <h3 className="mt-8 text-sm font-medium uppercase tracking-widest text-muted-foreground">What we do not do</h3>
              <ul className="mt-3 divide-y divide-border border-y border-border text-base">
                <li className="py-3">Injections, insulin, or anything under the skin — that is a district nurse</li>
                <li className="py-3">Anything a two-carer risk assessment says needs two, with one carer</li>
                <li className="py-3">Fifteen-minute calls. You cannot wash and dress somebody in fifteen minutes</li>
                <li className="py-3">Cleaning as a service on its own — we tidy what we use and we are not a cleaner</li>
                <li className="py-3">Handle money beyond the shopping, with a receipt every time</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="max-w-3xl">
            <SectionHeader eyebrow="Asked often" title="About the care itself" />
            <Faq className="mt-6" items={[
              { question: "What if we need more later?", answer: "We add calls with a week's notice, or the same day in a crisis. The assessment gets redone free whenever things change, and we will also tell you when a home is the honest answer instead." },
              { question: "Can we change the times?", answer: "Within about half an hour either way, easily. Everybody wants eight in the morning and there are only so many eight o'clocks, so an early call and a late one are the easiest to get." },
              { question: "Do carers get told what happened last time?", answer: "There is a log in the house and a shared record. A carer arriving knows what yesterday was like, which is how a slow decline gets spotted rather than a crisis." },
              { question: "What if we do not get on with a carer?", answer: "Say so and we change them, with no explanation needed and no awkwardness. It happens a few times a year and it is nobody's fault." },
              { question: "Do you work with the district nurses?", answer: "Every day. We refer, we let them in, and we ring them when something has changed. A good care package is us and them, not one instead of the other." },
            ]} />
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
