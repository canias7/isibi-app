// meal-plan /plans — portions, frequency, and the price PER SERVING, which is
// the only honest comparison between boxes of different shapes.
//
// A three-meal box for two and a five-meal box for four are not comparable at
// the headline price and every recipe-box site leaves it that way, because the
// small box looks cheap and the big one looks like a commitment. Per serving
// they order the other way round.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { PlanCard } from "@/components/ui/plan-card";
import { FrequencyPicker } from "@/components/ui/frequency-picker";
import { DeliverySlot } from "@/components/ui/delivery-slot";
import { CutoffTime } from "@/components/ui/cutoff-time";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/plans")({ component: P });

const ROWS = [
  { plan: "3 meals for 2", week: "£32.50", servings: 6, per: "£5.42" },
  { plan: "4 meals for 2", week: "£40.00", servings: 8, per: "£5.00" },
  { plan: "5 meals for 2", week: "£47.50", servings: 10, per: "£4.75" },
  { plan: "3 meals for 4", week: "£56.00", servings: 12, per: "£4.67" },
  { plan: "4 meals for 4", week: "£72.00", servings: 16, per: "£4.50" },
  { plan: "5 meals for 4", week: "£88.00", servings: 20, per: "£4.40" },
];

function P() {
  return (
    <SiteChrome
      name="Rivelin Kitchen"
      tagline="Six plans, priced per serving so they can be compared."
      links={[
        { label: "This week", href: "/" },
        { label: "Full menu", href: "/menu" },
      ]}
      action={{ label: "See this week", href: "/" }}
    >
      <div className="mx-auto max-w-5xl px-6 py-14">
        <h1 className="text-4xl font-semibold tracking-tight text-balance">Plans</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Six of them. The weekly figure is not comparable across different box shapes, so the
          per-serving column is there too — and it reverses the order you would guess from the
          headline prices.
        </p>

        <section className="mt-12">
          <SectionHeader eyebrow="The table" title="Every plan, per serving" />
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[34rem] text-sm">
              <caption className="sr-only">Weekly price and price per serving by plan</caption>
              <thead>
                <tr className="border-b border-border text-start">
                  <th scope="col" className="py-2 font-medium">Plan</th>
                  <th scope="col" className="py-2 font-medium">A week</th>
                  <th scope="col" className="py-2 font-medium">Servings</th>
                  <th scope="col" className="py-2 font-medium">Per serving</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {ROWS.map((r) => (
                  <tr key={r.plan} className="border-b border-border last:border-0">
                    <td className="py-2">{r.plan}</td>
                    <td>{r.week}</td>
                    <td>{r.servings}</td>
                    <td className="font-medium">{r.per}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Delivery is included on every plan. There is no separate charge at checkout and no
            surcharge for the outlying postcodes we deliver to.
          </p>
        </section>

        <section className="mt-14">
          <SectionHeader eyebrow="The common four" title="What most people take" />
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <PlanCard name="3 for 2" price="£32.50" period="week" action={{ label: "Choose", href: "/" }} />
            <PlanCard name="4 for 2" price="£40.00" period="week" current action={{ label: "Choose", href: "/" }} />
            <PlanCard name="3 for 4" price="£56.00" period="week" action={{ label: "Choose", href: "/" }} />
            <PlanCard name="5 for 4" price="£88.00" period="week" action={{ label: "Choose", href: "/" }} />
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader
            eyebrow="How often"
            title="Weekly, fortnightly, or whenever you fancy"
            description="Fortnightly is not a lesser plan and it is not priced as one. Plenty of households want three cooked meals every other week and nothing in between."
          />
          <div className="mt-6">
            <FrequencyPicker
              columns={3}
              defaultValue="Every week"
              options={[
                { label: "Every week", perYear: 52, pricePerVisit: 40, note: "Skip any week from the account, up to the Monday." },
                { label: "Every two weeks", perYear: 26, pricePerVisit: 40, note: "Same price per box. There is no premium for ordering less often." },
                { label: "One-off", perYear: 0, pricePerVisit: 44, note: "No account, no subscription. £4 more and a sensible way to try it." },
              ]}
            />
          </div>
        </section>

        <section className="mt-14">
          <div className="grid items-start gap-10 lg:grid-cols-[1fr_1fr]">
            <div>
              <SectionHeader eyebrow="Delivery" title="Thursday or Friday" />
              <p className="mt-5 max-w-lg text-sm leading-relaxed text-muted-foreground">
                Choose a standing slot and change it any week. Thursday morning fills first and is
                usually gone by Sunday night.
              </p>
              <div className="mt-6">
                <CutoffTime by="Monday 23:59" promise="that week's Thursday or Friday" remaining="1 day 6 hours" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <DeliverySlot day="Thursday" window="08:00 – 13:00" full />
              <DeliverySlot day="Thursday" window="13:00 – 18:00" selected />
              <DeliverySlot day="Friday" window="08:00 – 13:00" />
              <DeliverySlot day="Friday" window="13:00 – 18:00" />
            </div>
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader title="Plan questions" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "Is there an introductory discount?",
                  answer:
                    "Half price on the first box, once, and that is the only offer we run. We do not do the sixty-percent-off-then-quietly-double thing, because the second box is where people leave.",
                },
                {
                  question: "Can I change plan mid-subscription?",
                  answer: "Any week, before the Monday cut-off, in either direction. It is the most common change and there is no penalty attached to it.",
                },
                {
                  question: "What if I am away?",
                  answer: "Skip the week. Skipping is free, unlimited, and does not pause or cancel anything — the following week arrives as normal.",
                },
              ]}
            />
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            <a className="underline underline-offset-4" href="/">This week's dishes</a>
            {" · "}
            <a className="underline underline-offset-4" href="/menu">Next week and the allergens</a>
          </p>
        </section>
      </div>
    </SiteChrome>
  );
}
