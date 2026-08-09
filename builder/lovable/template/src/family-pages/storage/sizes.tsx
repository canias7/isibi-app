// storage /sizes — the guide, in furniture rather than square feet. The whole
// page is the answer to "how big is big enough", which is the question every
// enquiry in this trade begins with and which nobody publishes an answer to.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { CtaBand } from "@/components/ui/cta-band";
import { Faq } from "@/components/ui/faq";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { SizeGuide } from "@/components/ui/size-guide";
export const Route = createFileRoute("/sizes")({ component: P });
const BY_HOME = [
  ["A single room being cleared", "25 sq ft", "A bed, a wardrobe, a chest of drawers and about fifteen boxes."],
  ["A studio or a one-bed flat", "50 sq ft", "A double bed, a small sofa, a fridge, a table and thirty boxes."],
  ["A two-bed house", "75 sq ft", "Two bedrooms of furniture, a three-seat sofa, white goods and fifty boxes."],
  ["A three-bed house", "125 sq ft", "Everything from a family house including the loft, the shed and the garden furniture."],
  ["A four-bed house", "Container", "As above with room to spare, or the same again with a car in front of it."],
];
const BY_JOB = [
  ["Between houses", "One size up from your house", "Movers pack loosely and boxes end up bigger than you think. The extra £20 a month is cheaper than a second van."],
  ["Trade stock", "75 sq ft or a container", "Pallet access, a truck you can use free, and a loading bay you can reverse into."],
  ["A car or a motorbike over winter", "Container, or 50 sq ft for a bike", "Drive-up, dry, and your own padlock. We will not start it for you."],
  ["Paperwork you legally have to keep", "Locker", "Shelved, ground floor, and cheaper than the floor space it takes up in an office."],
  ["A student summer", "Locker or 25 sq ft", "Two people usually share a 25. June to September is our quietest period and the easiest to get."],
];
function P() {
  return (
    <SiteChrome name="Neepsend Self Store" tagline="Self-storage in a former steel works, five minutes from Sheffield city centre."
      links={[{ label: "Home", href: "/" }, { label: "Reserve", href: "/reserve" }]}
      action={{ label: "Reserve a unit", href: "/reserve" }}>

      <div className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="Size guide" title="How big is big enough"
          description="Square feet mean nothing to anybody. These are the same six units described in things you own, which is how everybody actually works it out." />

        <div className="mt-10 grid gap-12 lg:grid-cols-[1.15fr_1fr]">
          <SizeGuide caption="Every size, to scale" sizes={[
            { name: "Locker", area: 8, areaLabel: "8 sq ft · 1.2 × 1.2m", like: "A filing cabinet's worth", price: "£22 a month", alsoFits: ["6–8 boxes", "a bike", "a christmas tree and the decorations"] },
            { name: "25 sq ft", area: 25, areaLabel: "25 sq ft · 1.5 × 1.5m", like: "A large garden shed", price: "£38 a month", alsoFits: ["a single bed", "a wardrobe", "15 boxes", "a lawnmower"] },
            { name: "50 sq ft", area: 50, areaLabel: "50 sq ft · 2.3 × 2.0m", like: "A one-bedroom flat", price: "£58 a month", alsoFits: ["a double bed", "a 2-seat sofa", "a fridge", "30 boxes"] },
            { name: "75 sq ft", area: 75, areaLabel: "75 sq ft · 3.0 × 2.3m", like: "A two-bedroom house", price: "£79 a month", alsoFits: ["two beds", "a 3-seat sofa", "a washing machine", "50 boxes"] },
            { name: "125 sq ft", area: 125, areaLabel: "125 sq ft · 4.6 × 2.5m", like: "A three or four-bedroom house", price: "£124 a month", alsoFits: ["a whole family house", "the loft", "the shed", "garden furniture"] },
            { name: "Container", area: 155, areaLabel: "155 sq ft · 6.0 × 2.4m", like: "A single garage", price: "£165 a month", alsoFits: ["a car", "a four-bed house with room spare", "pallets of trade stock"] },
          ]} />
          <div className="space-y-4">
            <SafeImage src={null} alt="A 25 sq ft unit, packed" ratio="4/3" />
            <SafeImage src={null} alt="A 125 sq ft unit with the doors open" ratio="4/3" />
            <SafeImage src={null} alt="The container row from outside" ratio="4/3" />
          </div>
        </div>

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="By what you are moving" title="If you are emptying a house"
            description="These assume ordinary packing rather than professional packing. Movers stack looser and use bigger boxes, so go one up if a firm is doing it." />
          <ul className="mt-6 divide-y divide-border border-y border-border">
            {BY_HOME.map(([what, size, detail]) => (
              <li key={what} className="grid gap-x-8 gap-y-1 py-4 sm:grid-cols-[1fr_9rem_1.4fr]">
                <span className="font-medium">{what}</span>
                <span className="text-base tabular-nums">{size}</span>
                <span className="text-sm leading-relaxed text-muted-foreground">{detail}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="By what it is for" title="If it is not a house move" />
          <ul className="mt-6 divide-y divide-border border-y border-border">
            {BY_JOB.map(([what, size, detail]) => (
              <li key={what} className="grid gap-x-8 gap-y-1 py-4 sm:grid-cols-[1fr_13rem_1.4fr]">
                <span className="font-medium">{what}</span>
                <span className="text-base">{size}</span>
                <span className="text-sm leading-relaxed text-muted-foreground">{detail}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="max-w-3xl">
            <SectionHeader eyebrow="Asked often" title="Getting the size right" />
            <Faq className="mt-6" items={[
              { question: "What if I pick the wrong one?", answer: "Move up or down whenever you like, at the difference in price and nothing else. It takes about half an hour with our trolleys and we do not charge for the swap." },
              { question: "Should I round up or down?", answer: "Up, but only one. People overestimate what they own about as often as they underestimate it, and the real mistake is a unit you cannot get to the back of." },
              { question: "Can I come and look first?", answer: "Yes, walk in. Somebody will unlock an empty one of each size and let you stand in it, which tells you more than any list." },
              { question: "How high can I stack?", answer: "To the ceiling if the boxes take it. Every unit is 2.4m high and the container is 2.6m, so the top metre is usually wasted space nobody thinks about." },
              { question: "Do I need to leave a gangway?", answer: "Leave yourself one down the middle. Everybody who packs solid to the door comes back in a fortnight for the one thing at the back." },
            ]} />
          </div>
        </section>

        <section className="mt-14">
          <CtaBand title="Still not sure?"
            description="Ring and describe the pile. Whoever answers has done this several thousand times and will tell you honestly if a smaller one would do."
            action={{ label: "Reserve a unit", href: "/reserve" }} />
        </section>
      </div>
    </SiteChrome>
  );
}
