// farm-shop /season — the year, month by month. The calendar answers "what is
// there", and this page answers the question underneath it: what do I cook in
// March, when the answer is leeks and purple sprouting and nothing else.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Gallery } from "@/components/ui/gallery";
import { ProduceCalendar } from "@/components/ui/produce-calendar";
import { SectionHeader } from "@/components/ui/section-header";
import { GROWN } from "./index";
export const Route = createFileRoute("/season")({ component: P });
const MONTHS = [
  { m: "January", head: "Roots, and the last of the barn", what: "Leeks, kale, cabbage, stored potatoes, onions, carrots and forced rhubarb. Thin, and the month people find hardest.", cook: "Soup, and a lot of it. The forced rhubarb is the one bright thing and it only lasts six weeks." },
  { m: "February", head: "The hungry gap starts", what: "Leeks, kale, cabbage, stored roots. Purple sprouting begins at the end if the winter has been mild.", cook: "Braises. This is the month people ask for strawberries and it is the reason the calendar exists." },
  { m: "March", head: "Purple sprouting", what: "Purple sprouting broccoli, leeks, the end of the stored apples and onions.", cook: "Purple sprouting with anything. Three weeks of the best vegetable of the year and then it is gone." },
  { m: "April", head: "The first green", what: "Salad and rocket start, rhubarb outdoors, the last purple sprouting.", cook: "Salad again, after four months without. Rhubarb and ginger." },
  { m: "May", head: "Asparagus", what: "Asparagus, salad, rhubarb, the first radishes.", cook: "Asparagus, six weeks, and then nothing until next year. Do not buy it in July from anywhere." },
  { m: "June", head: "It all starts at once", what: "Strawberries, broad beans, asparagus finishing, salad, early carrots, rhubarb.", cook: "Strawberries every day for three weeks. Broad beans small enough to eat raw." },
  { m: "July", head: "The heavy month", what: "New potatoes, courgettes, tomatoes, raspberries, beans, carrots, salad.", cook: "Everything. The boxes are at their heaviest and their easiest." },
  { m: "August", head: "Glut", what: "Courgettes, tomatoes, potatoes, raspberries, plums, beans, salad, onions lifting.", cook: "Freeze and preserve. If your box has three courgettes in it, that is August being honest." },
  { m: "September", head: "Apples and the turn", what: "Apples, plums, potatoes lifting, tomatoes finishing, last raspberries, first cabbages.", cook: "Crumble, chutney, and the last outdoor tomatoes of the year." },
  { m: "October", head: "Lifting and storing", what: "Apples, potatoes, carrots, first leeks, cabbage, kale beginning.", cook: "Roasts start. The barn fills up and that is what carries January." },
  { m: "November", head: "Greens and roots", what: "Leeks, kale, cabbage, carrots, stored potatoes, apples, onions.", cook: "Kale properly cooked, not raw in a smoothie. Leek and potato." },
  { m: "December", head: "Sprouts, obviously", what: "Sprouts, kale, leeks, cabbage, stored roots and apples.", cook: "Sprouts on the stalk from the second week. They keep a fortnight that way and taste better." },
];
function P() {
  return (
    <SiteChrome name="Hollin Busk Farm Shop" tagline="A working farm and shop above Stocksbridge, growing on eleven acres."
      links={[{ label: "Home", href: "/" }, { label: "Order a box", href: "/order" }]}
      action={{ label: "Order a box", href: "/order" }}>

      <div className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="The year" title="Twelve months, and what is really there"
          description="A farm shop that stocks the same things every week is a supermarket with a gravel car park. Here is the actual year, including the two months that are hard." />

        <div className="mt-10">
          <ProduceCalendar items={GROWN} now={new Date(2026, 7, 2)} caption="Everything we grow" />
        </div>

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="Month by month" title="And what to do with it"
            description="Written by Ruth, who has cooked out of this farm for twenty-two years and has opinions about asparagus." />
          <div className="mt-8 grid gap-x-10 gap-y-8 md:grid-cols-2 lg:grid-cols-3">
            {MONTHS.map((x) => (
              <article key={x.m} className="border-t border-border pt-5">
                <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{x.m}</p>
                <h3 className="mt-1 text-xl font-medium tracking-tight">{x.head}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{x.what}</p>
                <p className="mt-2 text-sm leading-relaxed">{x.cook}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="The hungry gap" title="February to April, and why nobody talks about it"
            description="The stores are running out and nothing new is ready. Every farm in the country has it, and most sites deal with it by quietly buying produce in and saying nothing." />
          <div className="mt-6 max-w-prose space-y-4 text-base leading-relaxed text-muted-foreground">
            <p>
              What we do instead: the boxes get smaller in variety and stay the same price, we lean
              hard on the brassicas that actually like a cold field, and we tell you what is bought
              in on the label.
            </p>
            <p>
              It is also when the food is most interesting, if you let it be. Purple sprouting for
              three weeks in March is worth more than tomatoes in February, and forced rhubarb in
              January is a genuinely seasonal luxury that costs almost nothing.
            </p>
            <p>
              If you want strawberries at Easter there is a supermarket eight minutes down the hill
              and no hard feelings. We would rather say that than pretend.
            </p>
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="The farm" title="Eleven acres, four fields and two polytunnels" />
          <Gallery className="mt-8" columns={4} items={[
            { src: null, alt: "The top field in May" },
            { src: null, alt: "Asparagus beds" },
            { src: null, alt: "The polytunnel in July" },
            { src: null, alt: "Potato harvest" },
            { src: null, alt: "The barn in November" },
            { src: null, alt: "Purple sprouting in March" },
            { src: null, alt: "The orchard" },
            { src: null, alt: "The hens at the top of the lane" },
          ]} />
        </section>
      </div>
    </SiteChrome>
  );
}
