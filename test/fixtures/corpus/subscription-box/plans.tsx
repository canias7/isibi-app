// subscription-box /plans — every plan priced, with the per-cup figure, which
// is the only comparison anybody can actually make between a bag of coffee and
// a bag of coffee.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { PlanCard } from "@/components/ui/plan-card";
import { FrequencyPicker } from "@/components/ui/frequency-picker";
import { CancelPolicy } from "@/components/ui/cancel-policy";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/plans")({ component: P });

function P() {
  return (
    <SiteChrome
      name="Neepsend Coffee Club"
      tagline="Four plans and the price per cup, which is the only fair comparison."
      links={[
        { label: "Home", href: "/" },
        { label: "Skip or cancel", href: "/manage" },
      ]}
      action={{ label: "Start a box", href: "/" }}
    >
      <div className="mx-auto max-w-5xl px-6 py-14">
        <h1 className="text-4xl font-semibold tracking-tight text-balance">Plans</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Priced per bag and per cup. A 1&nbsp;kg bag looks dearer and is cheaper, and no
          subscription page anywhere makes that easy to see, so here it is in the same row.
        </p>

        <section className="mt-12">
          <SectionHeader eyebrow="By size" title="Four bags" />
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <PlanCard
              name="250g — about 16 cups"
              price="£9.00"
              period="delivery"
              action={{ label: "Start with this", href: "/" }}
            />
            <PlanCard
              name="500g — about 33 cups"
              price="£16.00"
              period="delivery"
              current
              action={{ label: "Start with this", href: "/" }}
            />
            <PlanCard
              name="1kg — about 66 cups"
              price="£29.00"
              period="delivery"
              action={{ label: "Start with this", href: "/" }}
            />
            <PlanCard
              name="Office — 2kg, ground"
              price="£54.00"
              period="delivery"
              action={{ label: "Start with this", href: "/" }}
            />
          </div>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[32rem] text-sm">
              <caption className="sr-only">Price per cup by bag size</caption>
              <thead>
                <tr className="border-b border-border text-start">
                  <th scope="col" className="py-2 font-medium">Bag</th>
                  <th scope="col" className="py-2 font-medium">Price</th>
                  <th scope="col" className="py-2 font-medium">Cups</th>
                  <th scope="col" className="py-2 font-medium">Per cup</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                <tr className="border-b border-border"><td className="py-2">250g</td><td>£9.00</td><td>16</td><td>56p</td></tr>
                <tr className="border-b border-border"><td className="py-2">500g</td><td>£16.00</td><td>33</td><td>48p</td></tr>
                <tr className="border-b border-border"><td className="py-2">1kg</td><td>£29.00</td><td>66</td><td>44p</td></tr>
                <tr><td className="py-2">2kg office</td><td>£54.00</td><td>133</td><td>41p</td></tr>
              </tbody>
            </table>
          </div>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            A cup here is 16g of beans, which is a proper one. If you use 10g the figures are a
            third lower and the ranking is unchanged.
          </p>
        </section>

        <section className="mt-14">
          <SectionHeader
            eyebrow="How often"
            title="Frequency changes the price a little, and the freshness a lot"
            description="A monthly 1kg bag is the cheapest thing on this page and the last third of it will not be at its best. That is a real trade and it is yours to make."
          />
          <div className="mt-6">
            <FrequencyPicker
              columns={4}
              defaultValue="Every two weeks"
              options={[
                { label: "Every week", perYear: 52, pricePerVisit: 8.5 },
                { label: "Every two weeks", perYear: 26, pricePerVisit: 9 },
                { label: "Once a month", perYear: 12, pricePerVisit: 9.5 },
                { label: "One-off", perYear: 0, pricePerVisit: 11 },
              ]}
            />
          </div>
        </section>

        <section className="mt-14">
          <div className="grid items-start gap-10 lg:grid-cols-[1fr_1fr]">
            <div>
              <SectionHeader eyebrow="Commitment" title="There is not one" />
              <p className="mt-5 max-w-lg text-sm leading-relaxed text-muted-foreground">
                No minimum number of boxes, no discount clawed back if you leave early, no annual
                plan that is cheaper because it is harder to escape. The price is the price.
              </p>
            </div>
            <CancelPolicy
              hours={48}
              deposit="Nothing is held and nothing is charged on cancellation. The only deadline is the Sunday cut-off for the box already being roasted."
            />
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader title="Plan questions" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "Can I change bag size without cancelling?",
                  answer: "Yes, from the next delivery, in the account. Size and frequency are separate settings and either can move on its own.",
                },
                {
                  question: "Is the office plan only for offices?",
                  answer: "No. It is 2kg ground to one setting, which suits a large household perfectly well. It is called that because that is who buys it.",
                },
                {
                  question: "Do you do decaf?",
                  answer: "One decaf, sugar-cane process from Colombia, same price as the others. Choose it as the standing preference or on a single delivery.",
                },
              ]}
            />
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            <a className="underline underline-offset-4" href="/">Back to the start</a>
            {" · "}
            <a className="underline underline-offset-4" href="/manage">Skipping and cancelling</a>
          </p>
        </section>
      </div>
    </SiteChrome>
  );
}
