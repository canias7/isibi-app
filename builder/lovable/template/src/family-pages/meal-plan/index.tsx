// meal-plan — THIS-WEEK'S-MENU-FIRST: the food leads and the plan is chosen
// after it, because nobody subscribes to a box of unknowns.
//
// THE CUT-OFF IS ON EVERY PAGE. It is the only thing on this site that
// expires, and a recipe box whose deadline is discoverable only at checkout
// produces the same complaint every week. It sits above the dishes, not below
// them.
//
// CARD-GRID structure: this is a browsing job. Ten dishes read as ten cards,
// and prose between them would only be in the way.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { CutoffTime } from "@/components/ui/cutoff-time";
import { MenuSection } from "@/components/ui/menu-section";
import { PlanCard } from "@/components/ui/plan-card";
import { DeliverySlot } from "@/components/ui/delivery-slot";
import { MediaGrid } from "@/components/ui/media-grid";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/")({ component: P });

const THIS_WEEK = [
  {
    name: "Meat and fish",
    note: "Everything is British and the farm is named on the card in the box.",
    items: [
      { name: "Lamb kofta, flatbreads, pickled onion", description: "35 minutes · Derbyshire lamb", meta: "Serves 2 or 4" },
      { name: "Chicken thighs with peppers and orzo", description: "One pan, 30 minutes", meta: "Serves 2 or 4" },
      { name: "Cod, brown shrimp butter, greens", description: "20 minutes · line-caught, Peterhead", meta: "Serves 2" },
      { name: "Pork and fennel ragù", description: "Slow, 90 minutes, mostly unattended", meta: "Serves 4" },
    ],
  },
  {
    name: "Vegetarian and vegan",
    note: "Six of the ten each week. Not an afterthought and not more expensive.",
    items: [
      { name: "Squash and sage gnocchi", description: "25 minutes", meta: "V · Serves 2 or 4" },
      { name: "Black bean chilli, lime crema", description: "40 minutes · freezes well", meta: "Vegan option · Serves 4" },
      { name: "Paneer saag with chapatis", description: "35 minutes", meta: "V · Serves 2" },
      { name: "Leek and cheddar tart", description: "50 minutes, one of them making pastry", meta: "V · Serves 4" },
    ],
  },
];

function P() {
  return (
    <SiteChrome
      name="Rivelin Kitchen"
      tagline="Ten dishes a week, boxed in Sheffield on Wednesday, delivered Thursday and Friday."
      links={[
        { label: "Full menu", href: "#/menu" },
        { label: "Plans", href: "#/plans" },
        { label: "Questions", href: "#questions" },
      ]}
      action={{ label: "See this week", href: "#week" }}
    >
      {/* THE CUT-OFF, ABOVE THE FOOD. */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 pt-10">
          <CutoffTime
            by="Monday 23:59"
            promise="delivery on Thursday or Friday this week"
            remaining="1 day 6 hours"
            nextPromise="After midnight tonight the next available delivery is the following Thursday. Nothing is charged in between."
          />
        </div>
      </section>

      <section className="border-b border-border" id="week">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Week of 3 August
            </p>
            <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">
              Ten dishes. Choose the food first.
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
              The plan is a decision about how many and how often, and it is a much easier one to
              make after you have seen whether you would actually eat this week's list.
            </p>
          </div>
          <div className="mt-10">
            <MenuSection groups={THIS_WEEK} />
          </div>
          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Two more turn up on the full menu each Friday for the following week, so there are
            always twelve to pick from by the weekend.{" "}
            <a className="underline underline-offset-4" href="#/menu">Next week is already published.</a>
          </p>
        </div>
      </section>

      {/* THIS WEEK'S FOOD, PHOTOGRAPHED THIS WEEK. Every recipe box on earth
          reuses the same twelve studio shots all year, which is why the
          delivered box never looks like the website. These carry the week
          number so a repeat customer can tell whether the picture is current —
          and if it is not, that is worth knowing too. */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <MediaGrid
            columns={4}
            ratio="1/1"
            items={[
              { src: null, alt: "The harissa chicken traybake, straight from the oven in the dish", caption: "Week 32 · in the dish, not styled" },
              { src: null, alt: "The lentil and squash bowl, one portion in a bowl on a wooden board", caption: "Week 32 · this is one portion" },
              { src: null, alt: "An open box on a kitchen table, everything laid out beside it", caption: "What actually arrives. Paper bags, one ice pack, no plastic trays." },
              { src: null, alt: "The recipe card propped against a chopping board, splashed", caption: "The card. Six steps, one pan, and it survives being cooked from." },
            ]}
          />
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <SectionHeader
            eyebrow="Then the plan"
            title="How many meals, how often"
            description="Priced per serving, which is the comparison worth making — a three-meal box for two and a four-meal box for four are not otherwise comparable."
          />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <PlanCard name="3 meals for 2" price="£32.50" period="week" action={{ label: "Choose", href: "#/plans" }} />
            <PlanCard name="4 meals for 2" price="£40.00" period="week" current action={{ label: "Choose", href: "#/plans" }} />
            <PlanCard name="3 meals for 4" price="£56.00" period="week" action={{ label: "Choose", href: "#/plans" }} />
            <PlanCard name="5 meals for 4" price="£88.00" period="week" action={{ label: "Choose", href: "#/plans" }} />
          </div>
          <p className="mt-5 text-sm text-muted-foreground">
            That is £5.42, £5.00, £4.67 and £4.40 a serving.{" "}
            <a className="underline underline-offset-4" href="#/plans">The full table is on the plans page.</a>
          </p>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <SectionHeader
            eyebrow="When"
            title="Two delivery days, and one of them fills up"
            description="Thursday goes first every week. Friday is almost always open on Monday evening."
          />
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <DeliverySlot day="Thursday 6 Aug" window="08:00 – 13:00" full />
            <DeliverySlot day="Thursday 6 Aug" window="13:00 – 18:00" selected />
            <DeliverySlot day="Friday 7 Aug" window="08:00 – 13:00" />
            <DeliverySlot day="Friday 7 Aug" window="13:00 – 18:00" />
          </div>
        </div>
      </section>

      <section id="questions">
        <div className="mx-auto max-w-3xl px-6 py-14">
          <SectionHeader title="Before the first box" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "What happens if I forget to choose?",
                  answer:
                    "We send your usual mix rather than nothing, and you can swap any dish up to the cut-off. If you would rather a missed choice meant no box, that is a setting — say so and we will honour it.",
                },
                {
                  question: "Do I have to subscribe?",
                  answer:
                    "No. A one-off box is £4 more and there is no account to close afterwards. Plenty of people do that first and it is a sensible way to try it.",
                },
                {
                  question: "How much packaging is there?",
                  answer:
                    "A cardboard box, paper bags, and sheep's wool insulation you can return in any box the following week. No plastic tray liners. It is not zero and we would rather not pretend.",
                },
                {
                  question: "Are the allergens listed?",
                  answer:
                    "In a full matrix on the menu page — all fourteen, per dish, including 'may contain' where a shared surface is involved. Not a disclaimer at the bottom.",
                },
              ]}
            />
          </div>
        </div>
      </section>
    </SiteChrome>
  );
}
