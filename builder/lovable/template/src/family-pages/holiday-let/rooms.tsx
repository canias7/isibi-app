// holiday-let /rooms — every room and what is in it. The page that stops the
// disappointed arrival: a twin room described as a twin, a bathroom that says
// there is no shower over the bath, and a staircase that says it is steep.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { CtaBand } from "@/components/ui/cta-band";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
export const Route = createFileRoute("/rooms")({ component: P });
const ROOMS = [
  {
    name: "Sitting room",
    blurb: "One room across the front of the cottage with the window looking down the valley. The burner is the heating in here and it does the whole downstairs — there are radiators too but nobody uses them once it is lit.",
    has: ["Wood burner, logs included", "Two-seat sofa and two armchairs", "Smart TV, Freeview and the usual apps", "Books, maps and a box of board games", "Wifi, 74Mb, reaches the garden"],
    not: "It is a cottage sitting room, so four people is cosy and six would not work.",
  },
  {
    name: "Kitchen and dining",
    blurb: "At the back, a step down from the sitting room. Table seats four properly and six at a squeeze. Everything is real — a proper oven, a proper fridge, decent knives.",
    has: ["Electric oven and induction hob", "Fridge with a small freezer box", "Dishwasher, washing machine", "Cafetière, moka pot and a grinder", "Enough crockery for eight"],
    not: "No separate freezer and no microwave. There is a step down from the sitting room, unlit.",
  },
  {
    name: "Main bedroom",
    blurb: "Double, at the front, with the same view as downstairs and a window you can actually open. Blackout curtains, because in June it is light at half four.",
    has: ["King-size bed, proper mattress", "Blackout curtains", "Wardrobe and chest of drawers", "Reading lights both sides, and sockets"],
    not: "The ceiling slopes on the window side — 1.8m at the low point.",
  },
  {
    name: "Second bedroom",
    blurb: "Twin, at the back, over the kitchen. Beds can be pushed together into a small double if you say when you book.",
    has: ["Two single beds, zip-and-link", "Travel cot and high chair on request", "Blackout blind", "Small wardrobe"],
    not: "It is the small room. Two adults fit; two adults and a cot is tight.",
  },
  {
    name: "Bathroom",
    blurb: "Upstairs, between the two bedrooms. Roll-top bath with a shower over it, and the hot water is a proper cylinder rather than a combi, so two baths in a row is fine.",
    has: ["Roll-top bath with shower over", "Heated towel rail", "Towels and hand soap provided", "Loo, basin, and a window"],
    not: "One bathroom for four people, and no separate shower cubicle.",
  },
  {
    name: "Garden and outside",
    blurb: "Walled, west-facing, so it gets the evening. A table and four chairs, a washing line, and a hose by the back door for the muddy end of a walk.",
    has: ["Table and four chairs", "Charcoal barbecue and a bag of coal", "Hose and an outdoor tap", "Log store and a drying room off the back"],
    not: "It is walled but not fully enclosed at the top corner — a determined dog could get out.",
  },
];
function P() {
  return (
    <SiteChrome name="Wren Cottage" tagline="A two-bedroom stone cottage above Hathersage, in the Peak District."
      links={[{ label: "Home", href: "/" }, { label: "Round about", href: "/area" }]}
      action={{ label: "Check availability", href: "/" }}>

      <div className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="The rooms" title="Six rooms, described honestly"
          description="Including what is wrong with each one. A cottage that reads perfectly online is a cottage somebody arrives at disappointed, and we would rather lose the booking than the review." />

        <div className="mt-12 space-y-14">
          {ROOMS.map((r, i) => (
            <section key={r.name} className="border-t border-border pt-10">
              <div className={`grid gap-10 lg:grid-cols-2 ${i % 2 ? "lg:[&>*:first-child]:order-2" : ""}`}>
                <div>
                  <h2 className="text-3xl font-semibold tracking-tight">{r.name}</h2>
                  <p className="mt-4 max-w-prose text-base leading-relaxed text-muted-foreground">{r.blurb}</p>
                  <ul className="mt-6 divide-y divide-border border-y border-border text-base">
                    {r.has.map((h) => <li key={h} className="py-2.5">{h}</li>)}
                  </ul>
                  {/* The honest half, at the same weight as the good half. A
                      caveat set in grey small print is a caveat nobody reads. */}
                  <p className="mt-4 text-base leading-relaxed">
                    <span className="font-medium">Worth knowing. </span>
                    <span className="text-muted-foreground">{r.not}</span>
                  </p>
                </div>
                <SafeImage src={null} alt={r.name} ratio="4/3" fallbackSeed={r.name} />
              </div>
            </section>
          ))}
        </div>

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="Access" title="Things that are genuinely difficult"
            description="Written out rather than left to a wheelchair symbol that would be a lie either way." />
          <ul className="mt-6 divide-y divide-border border-y border-border text-base">
            <li className="py-3">The stairs are original, steep, and turn at the bottom. There is a handrail on one side only.</li>
            <li className="py-3">There is no downstairs loo, so every trip in the night is the staircase.</li>
            <li className="py-3">One step at the front door, 140mm, and a step down into the kitchen.</li>
            <li className="py-3">The lane is steep and cobbled at the top. Fine to drive, hard to push a chair up.</li>
            <li className="py-3">The nearest step-free cottage we know of is in the village and we will happily give you their number.</li>
          </ul>
        </section>

        <section className="mt-14">
          <CtaBand title="Still sounds right?"
            description="The calendar has every night and every price on it, so you can work the week out yourself."
            action={{ label: "See what is free", href: "/" }} />
        </section>
      </div>
    </SiteChrome>
  );
}
