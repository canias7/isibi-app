// garden-centre /plants — the stock BY SEASON, with what will not survive being
// planted now shown rather than hidden.
//
// A NURSERY THAT HIDES THE OUT-OF-SEASON STOCK IS A NURSERY YOU CANNOT PLAN
// WITH. Somebody deciding what to do in October needs to see October's list in
// August. The season picker changes what is emphasised, not what exists.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { SeasonPicker } from "@/components/ui/season-picker";
import { ProductCard } from "@/components/ui/product-card";
import { PriceList } from "@/components/ui/price-list";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/plants")({ component: P });

const NOW = [
  { name: "Spring bulbs, loose", price: 4.5, note: "Sold by weight from the barrels. Daffodil, allium, crocus, tulip, camassia." },
  { name: "Wallflowers, bare root", price: 3.2, note: "Bundles of ten, in until October." },
  { name: "Strawberry runners", price: 5.5, note: "Plant now for a full crop next June." },
  { name: "Autumn raspberry canes", price: 8.5, note: "Autumn Bliss and Polka. No support needed." },
  { name: "Hardy geranium, 2L", price: 9, note: "Six varieties, all grown here." },
  { name: "Hedging whips, bare root", price: 1.4, note: "From November. Ordering now for a winter hedge is the sensible move.", soldOut: true },
];

const COMING = [
  { name: "Winter bedding", when: "From 15 September", detail: "Pansy, viola, cyclamen, primula. Grown in the tunnels here and about a fortnight hardier than anything bought in." },
  { name: "Bare-root roses", when: "From 1 November", detail: "Forty varieties from a Yorkshire grower. Cheaper and better than potted, and they establish twice as well." },
  { name: "Fruit trees, bare root", when: "From 15 November", detail: "Apple, pear, plum and damson on four rootstocks. This is the moment to buy one and nobody realises." },
  { name: "Hedging whips", when: "From 20 November", detail: "Hawthorn, beech, hornbeam, mixed native. About a fifth the cost of potted and they catch up in two years." },
  { name: "Seed potatoes", when: "From mid-January", detail: "Chitting from January, planting from March. Twenty-two varieties last year." },
  { name: "Summer bedding", when: "From late April", detail: "Not before. Anything on sale in March has been in a heated greenhouse and will sulk for a month." },
];

const JOBS = [
  { name: "Take cuttings", description: "Pelargonium, penstemon, salvia, lavender — all root easily from now to mid-September", price: null, meta: "free to do" },
  { name: "Order bulbs", description: "The choice is best in the next fortnight and thin by October", price: null, meta: "now" },
  { name: "Cut back and feed", description: "Anything that has finished flowering. A feed now gives a second flush on a lot of things", price: null, meta: "now" },
  { name: "Plan the hedge", description: "Order bare-root now for November delivery. A fifth the price of potted", price: null, meta: "now" },
  { name: "Water the pots", description: "Twice a day in this weather. It is the only real August job", price: null, meta: "daily" },
];

function P() {
  return (
    <SiteChrome
      name="Hollin Busk Nursery"
      tagline="What is in now, what is coming, and when each thing should go in."
      links={[
        { label: "This month", href: "#/" },
        { label: "Visiting", href: "#/visit" },
      ]}
      action={{ label: "Plan a visit", href: "#/visit" }}
    >
      <div className="mx-auto max-w-6xl px-6 py-16">
        <h1 className="text-5xl font-semibold tracking-tight text-balance">What is in</h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          By season, including the seasons that have not arrived. Somebody deciding on a hedge in
          August needs to see November's list now — that is when the ordering happens.
        </p>

        <div className="mt-10 max-w-xs">
          <SeasonPicker
            label="Season"
            value="late-summer"
            seasons={[
              { id: "spring", label: "Spring — March to May", complete: true },
              { id: "summer", label: "Early summer — June, July", complete: true },
              { id: "late-summer", label: "Late summer — August, September", current: true },
              { id: "autumn", label: "Autumn — October, November" },
              { id: "winter", label: "Winter — December to February" },
            ]}
          />
        </div>

        <section className="mt-14">
          <SectionHeader
            eyebrow="On the benches now"
            title="Six things worth planting in August"
            description="Everything here will establish if it goes in this month. The last card is coming rather than gone, and it says so."
          />
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {NOW.map((p) => (
              <ProductCard key={p.name} product={p} />
            ))}
          </div>
        </section>

        <section className="mt-16">
          <div className="grid gap-14 lg:grid-cols-[1fr_1.15fr]">
            <div className="lg:pt-6">
              <SectionHeader
                eyebrow="Coming"
                title="What arrives, and exactly when"
                description="Published a season ahead because half of gardening is ordering something months before it goes in the ground."
              />
              <p className="mt-5 max-w-lg text-sm leading-relaxed text-muted-foreground">
                Bare-root season — November to March — is the cheapest and best time to buy almost
                any tree, rose or hedge, and almost nobody knows it. A bare-root hedge is a fifth of
                the cost of a potted one and outgrows it within two years.
              </p>
            </div>
            <ul className="divide-y divide-border border-y border-border">
              {COMING.map((c) => (
                <li key={c.name} className="py-4">
                  <div className="flex flex-wrap items-baseline gap-x-3">
                    <p className="font-medium">{c.name}</p>
                    <p className="text-sm tabular-nums text-muted-foreground">{c.when}</p>
                  </div>
                  <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">{c.detail}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mt-16">
          <div className="grid gap-14 lg:grid-cols-[1.15fr_1fr]">
            <div>
              <SectionHeader
                eyebrow="This month's jobs"
                title="Most of which need nothing from us"
                description="A nursery whose advice only ever ends in buying something is an advert. Four of these five cost nothing."
              />
            </div>
            <PriceList items={JOBS} />
          </div>
        </section>

        <section className="mt-16">
          <SectionHeader title="Plant questions" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "What will grow in heavy clay?",
                  answer:
                    "More than people think, and most of Sheffield is on it. Hardy geraniums, roses, hydrangea, viburnum, and virtually any tree. What will not is anything Mediterranean — lavender and rosemary rot within two winters unless the bed is raised.",
                },
                {
                  question: "I have a north-facing garden.",
                  answer:
                    "Ferns, hosta, hellebore, hydrangea, Japanese anemone and a great many others. North-facing is a different palette rather than a worse one, and it is far easier than a hot dry border.",
                },
                {
                  question: "Do you do peat-free compost?",
                  answer:
                    "Only peat-free, since 2021, and all our own plants are grown in it. It behaves differently — it looks dry on top when it is wet underneath, which is why people over-water at first.",
                },
                {
                  question: "Can you order something in?",
                  answer:
                    "Usually, if it is available from a British grower, with no deposit. We will also say when a plant is a bad idea for your garden before ordering it, which is the more useful half of the service.",
                },
              ]}
            />
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            <a className="underline underline-offset-4" href="#/">This month's advice</a>
            {" · "}
            <a className="underline underline-offset-4" href="#/visit">Getting here</a>
          </p>
        </section>
      </div>
    </SiteChrome>
  );
}
