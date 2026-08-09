// local-shop /shop — what is stocked and what can be ordered in. A village
// shop's real proposition is not a catalogue: it is that somebody will get
// whatever you ask for by Thursday, which is a thing you have to say out loud
// because nobody assumes it.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { CounterServices } from "@/components/ui/counter-services";
import { Faq } from "@/components/ui/faq";
import { Gallery } from "@/components/ui/gallery";
import { PriceList } from "@/components/ui/price-list";
import { SectionHeader } from "@/components/ui/section-header";
import { SERVICES } from "./index";
export const Route = createFileRoute("/shop")({ component: P });
function P() {
  return (
    <SiteChrome name="Bolsterstone Stores" tagline="The village shop and Post Office. Open at six, seven days."
      links={[{ label: "Home", href: "/" }, { label: "What we do", href: "/#find-us" }]}
      action={{ label: "Ring 0114 288 3012", href: "tel:01142883012" }}>

      <div className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="What we stock" title="And what we will get in by Thursday"
          description="Which is the actual proposition. A shop this size cannot carry everything, and the useful thing is that anything you ask for on a Monday is here on a Thursday at no extra cost." />

        <section className="mt-10 grid gap-12 lg:grid-cols-[1fr_1fr]">
          <div>
            <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">In, every day</h2>
            <ul className="mt-3 divide-y divide-border border-y border-border text-base">
              <li className="py-3.5">
                <span className="font-medium">Bread from the Holmfirth bakery</span>
                <span className="block text-sm text-muted-foreground">In at seven. Sourdough and tin loaves Tuesday, Thursday and Saturday; the rest of the week it is the ordinary white and wholemeal, which is fine.</span>
              </li>
              <li className="py-3.5">
                <span className="font-medium">Milk, four sizes, and it does not run out</span>
                <span className="block text-sm text-muted-foreground">Two deliveries a day in summer. Oat, soya and lactose-free as well, in the fridge by the door.</span>
              </li>
              <li className="py-3.5">
                <span className="font-medium">Papers, all of them, and magazines to order</span>
                <span className="block text-sm text-muted-foreground">In by half five. Delivered to about forty houses in the village at no charge — ask and you go on the round.</span>
              </li>
              <li className="py-3.5">
                <span className="font-medium">Meat from the butcher in Penistone</span>
                <span className="block text-sm text-muted-foreground">Wednesday and Friday. Bacon, sausage, mince, chops. Anything else on order for the next delivery.</span>
              </li>
              <li className="py-3.5">
                <span className="font-medium">Fruit and veg</span>
                <span className="block text-sm text-muted-foreground">The usual twenty things, plus whatever the farm at the top of the lane has. It is not a greengrocer and we will not pretend it is.</span>
              </li>
              <li className="py-3.5">
                <span className="font-medium">Beer, wine and spirits</span>
                <span className="block text-sm text-muted-foreground">Including six from the brewery at Wortley. Licensed until ten, and half nine on a Sunday.</span>
              </li>
              <li className="py-3.5">
                <span className="font-medium">The everything shelf</span>
                <span className="block text-sm text-muted-foreground">Batteries, lightbulbs, tin openers, calamine lotion, birthday cards, dog food, WD-40, sellotape. If you have run out of it at nine at night, we probably have it.</span>
              </li>
            </ul>
          </div>
          <div>
            <div className="rounded-lg border border-border bg-muted/50 p-6">
              <h2 className="text-lg font-semibold tracking-tight">Ask for it and we will get it</h2>
              <p className="mt-2 text-base leading-relaxed text-muted-foreground">
                Anything from the wholesaler ordered by Monday teatime is here on Thursday morning,
                and it costs what it costs — no ordering fee, no minimum, and no deposit. People use
                this for gluten-free things, a particular baby formula, a brand of tea they cannot
                find, and once for forty-eight bottles of tonic.
              </p>
              <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                Write it on the pad by the till or ring. We will tell you on the spot if it is not
                something the wholesaler carries rather than taking the order and going quiet.
              </p>
            </div>

            <h2 className="mt-8 text-sm font-medium uppercase tracking-widest text-muted-foreground">A few prices, so you know</h2>
            <PriceList className="mt-3" items={[
              { name: "Milk, 2 pints", price: 1.45 },
              { name: "Tin loaf, Holmfirth bakery", price: 2.4 },
              { name: "Six eggs, from the farm up the lane", price: 1.9 },
              { name: "Bag of coal, 20kg", price: 14.5, meta: "Winter only" },
              { name: "Calor 13kg butane exchange", price: 38 },
              { name: "Wortley Brewery, 500ml", price: 3.6, description: "Six of them, and they change" },
            ]} />
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              We are dearer than a supermarket on most things and cheaper on almost none, which is
              what a shop four miles from the nearest one costs to run. On milk, bread and papers we
              are within a few pence, deliberately.
            </p>
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="The counter" title="The same list as the front page"
            description="Repeated because people arrive here from a search for 'post office near me' and should not have to go looking for the hours." />
          <div className="mt-8 max-w-3xl">
            <CounterServices services={SERVICES} heading="What you can do here" />
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="The shop" title="It is one room and a counter" />
          <Gallery className="mt-8" columns={4} items={[
            { src: null, alt: "The shop front from the road" },
            { src: null, alt: "The Post Office counter" },
            { src: null, alt: "The bread shelf at eight in the morning" },
            { src: null, alt: "The everything shelf" },
            { src: null, alt: "The fridge by the door" },
            { src: null, alt: "The local beer shelf" },
            { src: null, alt: "The noticeboard" },
            { src: null, alt: "The cash machine on the outside wall" },
          ]} />
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="max-w-3xl">
            <SectionHeader eyebrow="Asked often" title="About stock" />
            <Faq className="mt-6" items={[
              { question: "Can you get gluten-free bread?", answer: "Yes, and we keep two loaves in the freezer permanently for exactly this. Anything else gluten-free, ask by Monday and it is here Thursday." },
              { question: "Do you do a delivery round?", answer: "Papers and prescriptions only, about forty houses, free. We are not set up for a grocery round and the last time we tried it we could not staff it." },
              { question: "Will you keep something back for me?", answer: "Yes, on the shelf behind the till with your name on it. Ring before nine and it is there when you get in." },
              { question: "Do you take card for small amounts?", answer: "Any amount, including 80p for a paper. There is no minimum and there never has been." },
              { question: "Is there a cash machine?", answer: "On the outside wall, free, and it is the only one within four miles. It is refilled on Tuesdays and Fridays and it does run out on a bank holiday weekend." },
              { question: "Do you sell stamps?", answer: "At the Post Office counter until half five, and books of first and second class at the till until we shut at ten." },
            ]} />
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
