// waste /sizes — every size against a real comparison, and WHAT EACH ONE
// REALISTICALLY HOLDS.
//
// "6 CUBIC YARDS" IS NOT A UNIT ANYBODY THINKS IN. Somebody clearing a loft
// thinks in bin bags and somebody stripping a kitchen thinks in kitchens. A
// size chart in cubic yards is a chart the customer has to translate, and they
// translate it wrong in the direction that costs them a second skip.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { SizeGuide } from "@/components/ui/size-guide";
import { PriceList } from "@/components/ui/price-list";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/sizes")({ component: P });

const PRICES = [
  { name: "2-yard mini, 14 days", description: "Mixed waste. Fits on a single drive", price: 125 },
  { name: "4-yard midi, 14 days", description: "Mixed waste. The commonest domestic hire", price: 185 },
  { name: "6-yard builder's, 14 days", description: "Mixed. The largest that can legally be filled with rubble", price: 240 },
  { name: "6-yard rubble only, 14 days", description: "Inert waste only — soil, brick, concrete, tile", price: 165 },
  { name: "8-yard builder's, 14 days", description: "Mixed, light. Not for soil", price: 290 },
  { name: "12-yard maxi, 14 days", description: "Bulky light waste only. Furniture, packaging, garden", price: 380 },
  { name: "Grab lorry, per load", description: "16 tonnes of soil or rubble, loaded by us. No skip needed", price: 260 },
  { name: "Extra week", description: "Any size, if the job runs on", price: 25 },
  { name: "Road permit", description: "At cost. Sheffield City Council sets it and we apply", price: 42 },
];

const HOW = [
  { job: "A bathroom rip-out", size: "2 or 4-yard", why: "A suite, tiles and a floor is about 30 bags. The 2-yard does it unless there is a wall coming down." },
  { job: "A kitchen", size: "4-yard", why: "Units, worktop, appliances and floor. People book a 6 and half-fill it." },
  { job: "A full house clearance", size: "6 or 8-yard", why: "Three bedrooms of furniture is usually a 6. Add a shed or a loft and it is an 8." },
  { job: "A patio coming up", size: "6-yard rubble only", why: "Never bigger. Flags and hardcore are dense, and the weight limit stops you before the space does." },
  { job: "Garden clearance", size: "6 or 12-yard", why: "Green waste is bulky and light, which is the one case the 12-yard is genuinely right for." },
  { job: "A single sofa and a mattress", size: "None — book a collection", why: "£60 for the two, at the door, no skip. Cheaper than any skip and far less trouble." },
];

function P() {
  return (
    <SiteChrome
      name="Loxley Skips"
      tagline="Every size against something you can picture, and the job each one suits."
      links={[
        { label: "Home", href: "#/" },
        { label: "Book", href: "#/book" },
      ]}
      action={{ label: "Book a skip", href: "#/book" }}
    >
      <div className="mx-auto max-w-5xl px-6 py-14">
        <h1 className="text-4xl font-semibold tracking-tight text-balance">Sizes</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Cubic yards mean nothing to anybody. Bin bags do, and so does "this is what a kitchen
          fills" — the translation is where people go wrong, always in the direction that ends with
          a second skip.
        </p>

        <section className="mt-12">
          <SectionHeader eyebrow="Six sizes" title="In bags, and in jobs" />
          <div className="mt-6">
            <SizeGuide
              caption="A bag is a standard black refuse sack, filled but liftable. It is the only unit anybody has ever measured a clear-out in."
              sizes={[
                { name: "2-yard mini", area: 2, areaLabel: "2 yd³ · 1.5m × 1.3m", like: "About 25 bin bags", alsoFits: ["A small bathroom", "One afternoon of garden"], price: "£125" },
                { name: "4-yard midi", area: 4, areaLabel: "4 yd³ · 1.8m × 1.5m", like: "About 45 bin bags", alsoFits: ["A kitchen", "A loft"], price: "£185" },
                { name: "6-yard builder's", area: 6, areaLabel: "6 yd³ · 3.6m × 1.7m", like: "About 65 bin bags", alsoFits: ["Soil and rubble", "A three-bedroom clearance"], price: "£240" },
                { name: "6-yard rubble only", area: 6, areaLabel: "6 yd³ · 3.6m × 1.7m", like: "About 4 tonnes of hardcore", alsoFits: ["A patio", "A driveway"], price: "£165" },
                { name: "8-yard builder's", area: 8, areaLabel: "8 yd³ · 3.9m × 1.8m", like: "About 85 bin bags", alsoFits: ["An extension strip-out"], price: "£290" },
                { name: "12-yard maxi", area: 12, areaLabel: "12 yd³ · 3.9m × 1.8m, tall", like: "About 130 bin bags", alsoFits: ["Bulky light waste only", "NOT soil, rubble or plaster"], price: "£380" },
              ]}
            />
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader
            eyebrow="By job"
            title="What people actually book, and what they should have"
            description="These are from twenty years of collecting half-empty skips and being rung for a second one."
          />
          <ul className="mt-8 divide-y divide-border border-y border-border">
            {HOW.map((h) => (
              <li key={h.job} className="grid gap-1 py-4 md:grid-cols-[minmax(0,15rem)_minmax(0,11rem)_1fr] md:gap-6">
                <p className="font-medium">{h.job}</p>
                <p className="text-sm">{h.size}</p>
                <p className="text-sm text-muted-foreground">{h.why}</p>
              </li>
            ))}
          </ul>
          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            If you are between two sizes, take the smaller and ring us if it fills. A swap is £25
            plus the difference and it still costs less than a half-empty larger one.
          </p>
        </section>

        <section className="mt-14">
          <div className="grid items-start gap-10 lg:grid-cols-[1fr_1fr]">
            <div>
              <SectionHeader
                eyebrow="Prices"
                title="Nine lines, all in"
                description="Delivery, collection, fourteen days' hire, tipping and VAT. The only additions are the extra week and the permit, both at the bottom and both at cost."
              />
              <p className="mt-5 max-w-lg text-sm leading-relaxed text-muted-foreground">
                A grab lorry is worth knowing about: for soil and rubble it takes sixteen tonnes in
                one go, needs no permit, and is often cheaper than three skips. Nobody asks for it
                because nobody knows it exists.
              </p>
            </div>
            <PriceList items={PRICES} />
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader title="Size questions" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "Why can I not put rubble in a 12-yard?",
                  answer:
                    "Weight. A 12-yard of hardcore is about 14 tonnes and the lorry's arms are rated for 8. It is a legal limit rather than a preference, and a company that says yes is not planning to collect it as loaded.",
                },
                {
                  question: "What if it does not fit on my drive?",
                  answer:
                    "Then it goes on the road and needs a permit — £42 and five working days. Send a photograph of the frontage and we will tell you which, at no charge and before you book.",
                },
                {
                  question: "Can I have it longer than fourteen days?",
                  answer: "Yes, £25 a week, arranged whenever. Nobody has ever been charged for running one or two days over.",
                },
                {
                  question: "Do you do bags instead?",
                  answer:
                    "Hippo-type bags, yes, £95 filled and collected, up to about 1.5 yards. Good for a small job with no space; poor value above that and we will say so.",
                },
              ]}
            />
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            <a className="underline underline-offset-4" href="#/">What cannot go in</a>
            {" · "}
            <a className="underline underline-offset-4" href="#/book">Book one</a>
          </p>
        </section>
      </div>
    </SiteChrome>
  );
}
