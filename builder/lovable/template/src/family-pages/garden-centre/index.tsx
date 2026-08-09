// garden-centre — WHAT'S-GOOD-NOW-FIRST. A site that does not change with the
// season is wrong, in the strong sense: it is telling somebody in August to
// plant something that will die.
//
// SELLING A DOOMED PLANT LOSES A CUSTOMER FOREVER. Somebody who buys bedding in
// October, watches it die in the first frost and concludes they are bad at
// gardening does not come back. Saying "not now, and here is why" costs one
// sale and keeps somebody for thirty years.
//
// EDITORIAL structure: this is advice, written by somebody who grows things,
// not a product grid.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { SeasonPicker } from "@/components/ui/season-picker";
import { ProductCard } from "@/components/ui/product-card";
import { MediaGrid } from "@/components/ui/media-grid";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/")({ component: P });

const NOW = [
  { name: "Spring bulbs — daffodil, allium, crocus", price: 4.5, note: "Plant September to November. In now and the choice is best in the next fortnight." },
  { name: "Wallflowers, bare root", price: 3.2, note: "Bundles of ten. Go in now for April." },
  { name: "Strawberry runners", price: 5.5, note: "Now until October gives a full crop next June." },
  { name: "Autumn-fruiting raspberry canes", price: 8.5, note: "Now to March. Easier than summer varieties and they need no support." },
  { name: "Hardy geranium, 2 litre", price: 9, note: "Plant any time the ground is not frozen. Genuinely indestructible." },
  { name: "Winter bedding — pansy, viola, cyclamen", price: 3.8, note: "From mid-September. Not yet — three weeks." , soldOut: true },
];

function P() {
  return (
    <SiteChrome
      name="Hollin Busk Nursery"
      tagline="Plants grown a mile up the road, not shipped from Holland."
      links={[
        { label: "What is in", href: "/plants" },
        { label: "Visiting", href: "/visit" },
        { label: "Questions", href: "#questions" },
      ]}
      action={{ label: "Plan a visit", href: "/visit" }}
    >
      {/* WHAT IS GOOD NOW, PHOTOGRAPHED NOW. This is the one trade where a
          stock photograph is actively dishonest: a picture of a full bench of
          bedding in a week when there is none brings people in for something
          we have not got. Dated captions are the whole discipline — if the
          picture is three weeks old, that is worth knowing before driving
          out. */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 pt-10">
          <MediaGrid
            columns={4}
            ratio="4/3"
            items={[
              { src: null, alt: "The bench of late-summer perennials, rudbeckia and echinacea in flower", caption: "Taken Monday. What is actually in flower on the bench today." },
              { src: null, alt: "Bare-root hedging heeled into sand under the netting, labels visible", caption: "Bare-root season starts November. This is what it looks like." },
              { src: null, alt: "The polytunnel with the propagation benches, seed trays coming on", caption: "About 60% of what we sell is grown here, not bought in." },
              { src: null, alt: "The yard — bags of compost, aggregate bays, a trolley", caption: "Compost, bark and aggregate by the bag or the tonne." },
            ]}
          />
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid gap-16 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                August · The awkward month
              </p>
              <h1 className="mt-4 text-6xl font-semibold leading-[1.03] tracking-tight text-balance">
                Plant almost nothing, order everything
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
                August is the month gardening magazines struggle with. The ground is hard, anything
                planted now needs watering twice a day, and half of what is on sale everywhere else
                will be dead by November.
              </p>
              <p className="mt-4 max-w-xl leading-relaxed text-muted-foreground">
                What August IS for is bulbs — the choice is at its best in the next fortnight and
                gone by October — and for cutting back, taking cuttings, and deciding what next
                spring looks like.
              </p>
            </div>

            <div className="lg:pt-20">
              <div className="rounded-xl border-2 border-foreground p-6">
                <p className="font-medium">Three things not to buy this month</p>
                <ul className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">
                  <li>
                    <span className="font-medium text-foreground">Summer bedding.</span> It is
                    half price everywhere because it has six weeks left. Buying it now is buying
                    six weeks.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">Turf.</span> It will not root in
                    August and you will water it every evening for a month. Wait until the middle
                    of September and it establishes itself.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">Anything bare-root.</span> It is
                    not the season and anybody selling it now is selling you a dormant plant that
                    is not dormant.
                  </li>
                </ul>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                  We would rather lose the sale. Somebody who watches their first purchase die
                  decides they are bad at gardening and does not come back.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid gap-16 lg:grid-cols-[1fr_1.3fr]">
            <div className="lg:pt-6">
              <SectionHeader
                eyebrow="In now"
                title="What is worth carrying home this week"
                description="Everything here can go in the ground in August and will be better for it. The last card is in the list because it is coming, and it is marked so."
              />
              <div className="mt-6 max-w-xs">
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
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {NOW.map((p) => (
                <ProductCard key={p.name} product={p} href="/plants" />
              ))}
            </div>
          </div>
          <p className="mt-8 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            The winter bedding card says sold out because it is not here yet rather than because it
            has gone — three weeks. We would rather show you it exists than have you buy pansies
            somewhere else in a month.{" "}
            <a className="underline underline-offset-4" href="/plants">Everything, by season.</a>
          </p>
        </div>
      </section>

      <section id="questions">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <SectionHeader title="What people ask on the way round" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "Do you grow any of this yourselves?",
                  answer:
                    "About sixty percent, in the tunnels behind the car park. The rest comes from four British nurseries we have used for years. Nothing here has been on a lorry from the Netherlands and it is the reason the perennials establish so well.",
                },
                {
                  question: "Will you tell me if a plant will not do well in my garden?",
                  answer:
                    "Constantly. Bring a photograph and a rough idea of how much sun it gets. Half the plants that die in Sheffield gardens died of the wrong aspect rather than of neglect.",
                },
                {
                  question: "Is anything guaranteed?",
                  answer:
                    "Trees and shrubs for a year, if you follow the planting note. Perennials and bedding are not, because whether they survive is mostly about what happens after they leave.",
                },
                {
                  question: "Are you dog friendly?",
                  answer: "Everywhere including the cafe, on a lead. There are water bowls at both gates and a tap by the tunnels.",
                },
              ]}
            />
          </div>
        </div>
      </section>
    </SiteChrome>
  );
}
