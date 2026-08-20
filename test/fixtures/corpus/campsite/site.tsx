// campsite /site — the facilities including the ones that are shut, how far
// they are from each field, and the full rules. A shower block is only useful
// relative to where you are pitched, which no campsite site ever says.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { AmenityList } from "@/components/ui/amenity-list";
import { Faq } from "@/components/ui/faq";
import { Gallery } from "@/components/ui/gallery";
import { HouseRules } from "@/components/ui/house-rules";
import { LocationCard } from "@/components/ui/location-card";
import { PriceList } from "@/components/ui/price-list";
import { SectionHeader } from "@/components/ui/section-header";
import { RULES } from "./index";
export const Route = createFileRoute("/site")({ component: P });
function P() {
  return (
    <SiteChrome name="Ewden Beck Camping" tagline="Forty-eight pitches on the river, four miles above Stocksbridge."
      links={[{ label: "Home", href: "/" }, { label: "Book a pitch", href: "/book" }]}
      action={{ label: "Book a pitch", href: "/book" }}>

      <div className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="The site" title="What is here, and how far from your tent"
          description="A shower block is only useful relative to where you are pitched, and nobody tells you that until you have carried a washing-up bowl across two fields in the dark." />

        <section className="mt-10 grid gap-12 lg:grid-cols-[1fr_1fr]">
          <div>
            <AmenityList amenities={[
              { id: "showers", what: "Shower block — 6 showers, 4 basins", note: "Free, hot, cleaned at 09:00 and 17:00. Two of the six are wet-room sized" },
              { id: "acc", what: "Accessible shower and toilet", note: "Level from the top field. RADAR key not needed — it is unlocked" },
              { id: "sinks", what: "Washing-up sinks, covered", note: "Hot water, four sinks, and a light that works" },
              { id: "chem", what: "Chemical disposal point", note: "Behind the shower block, with a hose" },
              { id: "water", what: "Drinking water taps ×4", note: "One in each field and one at the barn" },
              { id: "laundry", what: "Laundry — washer and dryer", outOfOrder: true, backOn: "Thursday", note: "Dryer element failed 28 July, part on order. The washer works" },
              { id: "shop", what: "Small shop", note: "Milk, bread, eggs, gas, wood, teabags. 08:00–10:00 and 17:00–19:00" },
              { id: "wifi", what: "Wifi, at the barn only", note: "Nowhere else. One bar of EE in the top field and nothing below it" },
              { id: "play", what: "Play area", note: "Swings, a frame and a lot of mud. Top field, in sight of most pitches" },
              { id: "firepit", what: "Fire pits to hire", bookable: true, note: "£8 for the stay. Ask at the barn" },
              { id: "fridge", what: "Freezer for ice blocks", note: "In the shop. Free, and it is emptied on Mondays" },
              { id: "ev", what: "Electric car charging", outOfOrder: true, note: "We do not have any and there is no plan to. Nearest rapid is Stocksbridge, four miles" },
            ]} />
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              We list what is broken rather than quietly removing it, which is why the dryer is on
              this page. If something has failed while you are here, tell us — half the time it is
              a trip switch in the barn and it is back in five minutes.
            </p>
          </div>
          <div>
            <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">How far, from where</h2>
            <ul className="mt-3 divide-y divide-border border-y border-border text-base">
              <li className="py-3.5">
                <span className="font-medium">Top field — hardstandings</span>
                <span className="block text-sm text-muted-foreground">
                  Shower block 30 seconds, shop 30 seconds, level tarmac the whole way. This is the
                  field to ask for with small children or if walking is difficult.
                </span>
              </li>
              <li className="py-3.5">
                <span className="font-medium">Middle field — grass with electric</span>
                <span className="block text-sm text-muted-foreground">
                  About a minute to the block, gently uphill on grass. Fine in trainers, less fine
                  carrying a full washing-up bowl at eleven at night.
                </span>
              </li>
              <li className="py-3.5">
                <span className="font-medium">Bottom field — grass, no electric</span>
                <span className="block text-sm text-muted-foreground">
                  Ninety seconds and a proper climb back. Quietest part of the site by a distance
                  and right on the beck, which is the trade.
                </span>
              </li>
              <li className="py-3.5">
                <span className="font-medium">Hedge pitches — small tents</span>
                <span className="block text-sm text-muted-foreground">
                  Two minutes. Cars stay at the barn, so it is a walk with your kit — most people
                  here have arrived on a bike or on foot anyway.
                </span>
              </li>
            </ul>

            <h2 className="mt-8 text-sm font-medium uppercase tracking-widest text-muted-foreground">The shop</h2>
            <PriceList className="mt-3" items={[
              { name: "Milk, 2 pints", price: 1.5 },
              { name: "Bread, from the bakery in Stocksbridge", price: 2.4, meta: "Delivered daily except Sunday" },
              { name: "Eggs, half dozen", price: 1.8, description: "From the farm at the top of the lane" },
              { name: "Bag of logs", price: 6 },
              { name: "Gas — Campingaz 907 exchange", price: 32 },
              { name: "Bag of kindling", price: 2.5 },
            ]} />
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="The rules" title="Six of them, and two are enforced"
            description="Marked as such, because a business that prints every preference as an absolute gets all of them treated as preferences." />
          <div className="mt-8 max-w-3xl">
            <HouseRules rules={RULES} heading="While you are here" />
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="The valley" title="Four acres of it, and a beck you can swim in" />
          <Gallery className="mt-8" columns={4} items={[
            { src: null, alt: "The top field hardstandings" },
            { src: null, alt: "The middle field in July" },
            { src: null, alt: "The bottom field and the beck" },
            { src: null, alt: "The shower block" },
            { src: null, alt: "The barn and the shop" },
            { src: null, alt: "The play area" },
            { src: null, alt: "The river meadow" },
            { src: null, alt: "The lane down from Midhopestones" },
          ]} />
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr]">
            <div>
              <SectionHeader eyebrow="Asked often" title="About being here" />
              <Faq className="mt-6" items={[
                { question: "Can we swim in the beck?", answer: "People do, all summer, at the pool below the bottom field. It is about waist deep and properly cold. Nobody supervises it and we would not pretend otherwise." },
                { question: "Is there anywhere to eat?", answer: "The Fox at Midhopestones, a mile and a half up the lane, does food till eight and is worth the walk. Nothing on site beyond the shop." },
                { question: "What is the walking like?", answer: "Straight onto the moor from the top gate, and the Trans Pennine Trail is twenty minutes. Two of the four reservoir circuits start from the lane end." },
                { question: "Do we need to bring water?", answer: "No — four taps and it is mains. The beck is not drinking water whatever it looks like." },
                { question: "Is it noisy?", answer: "The beck is. Nothing else is after half ten, which is enforced rather than requested. There is no road noise at all — the lane carries about six cars an hour." },
                { question: "What about the midges?", answer: "Late June to mid August, at dusk, near the water. The top field gets almost none because of the breeze. Bring something, or ask at the shop and we will sell you some." },
              ]} />
            </div>
            <div>
              <LocationCard name="Ewden Beck Camping"
                address="Ewden Village, Stocksbridge, Sheffield, S36 4ZG"
                note="Off the A616 at Midhopestones, then two miles down. Single-track with passing places for the last half mile — fine for a 10m outfit taken slowly, and not something to attempt in the dark on your first visit." />
              <div className="mt-6 rounded-lg border border-border bg-muted/50 p-5">
                <p className="text-base font-medium">The one thing worth reading twice</p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  The barrier is locked at ten and there is no way in without the code — no night
                  porter, no keypad, nobody to wake. If you are going to be later than eight, ring
                  before you set off. It takes thirty seconds and it is the difference between
                  arriving and sleeping in a lay-by.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
