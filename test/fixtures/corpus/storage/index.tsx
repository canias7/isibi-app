// storage — SIZE-FIRST: the sizes with prices and a live free/taken state, on
// the page. The industry hides prices behind a quote form because the quote IS
// the sales call, which is exactly why publishing them is the opening.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Faq } from "@/components/ui/faq";
import { LocationCard } from "@/components/ui/location-card";
import { OpeningHours } from "@/components/ui/opening-hours";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { SizeGuide } from "@/components/ui/size-guide";
import { TrustStrip } from "@/components/ui/trust-strip";
import { UnitCard } from "@/components/ui/unit-card";
export const Route = createFileRoute("/")({ component: P });
function P() {
  return (
    <SiteChrome name="Neepsend Self Store" tagline="Self-storage in a former steel works, five minutes from Sheffield city centre."
      links={[{ label: "Size guide", href: "/sizes" }, { label: "Reserve", href: "/reserve" }, { label: "Find us", href: "#find-us" }]}
      action={{ label: "Reserve a unit", href: "/reserve" }}>

      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Neepsend · 24-hour access · no deposit · one week's notice to leave</p>
          <h1 className="mt-3 max-w-3xl text-5xl font-semibold tracking-tight text-balance">
            Prices on the page, and what is actually free today
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Everybody else in this trade makes you fill in a form to find out what a unit costs. We
            would rather you knew before you rang, so here is the whole list, what fits in each one,
            and how many of them are empty this morning.
          </p>
          <TrustStrip className="mt-10" items={[
            { title: "No deposit", description: "Pay the first month and move in" },
            { title: "One week's notice", description: "No minimum term, no exit fee" },
            { title: "Insured to £5,000", description: "Included. More is £4 a month" },
          ]} />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <SectionHeader eyebrow="The sizes" title="Six sizes, all priced"
            description="Updated every morning from the board in the office. A size showing none free genuinely has none — we do not hold one back for a walk-in." />
          <a className="text-sm font-medium underline underline-offset-4" href="/sizes">Which one do I need? →</a>
        </div>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <UnitCard size="Locker" dimensions="1.2m × 1.2m × 1.5m high" price={22} available={7}
            fits="Paperwork, a few boxes, a bike with the front wheel off."
            features={["Ground floor", "Shelved", "Walk-in access"]} />
          <UnitCard size="25 sq ft" dimensions="1.5m × 1.5m × 2.4m high" price={38} available={3}
            fits="A studio flat's worth — a single bed, a wardrobe and about fifteen boxes."
            features={["Ground floor", "Roller shutter", "Drive to the door"]} />
          <UnitCard size="50 sq ft" dimensions="2.3m × 2.0m × 2.4m high" price={58} available={1}
            fits="A one-bed flat, or a motorbike and the rest of a garage."
            features={["Ground or first floor", "Roller shutter", "Trolleys provided"]} />
          <UnitCard size="75 sq ft" dimensions="3.0m × 2.3m × 2.4m high" price={79} available={4}
            fits="A two-bed house, or the contents of a small shop."
            features={["Ground floor", "Double doors", "Pallet truck access"]} />
          <UnitCard size="125 sq ft" dimensions="4.6m × 2.5m × 2.4m high" price={124} available={0}
            fits="A three or four-bed house, including the garden furniture and the loft."
            features={["Ground floor", "Double doors", "Van bay outside"]} />
          <UnitCard size="Container" dimensions="6.0m × 2.4m × 2.6m high" price={165} available={2}
            fits="A four-bed house with room left, or a car off the road for the winter."
            features={["Outside, drive right up", "Own padlock", "24-hour access"]} />
        </div>
        <p className="mt-6 text-sm text-muted-foreground">
          All prices are per month including VAT. Nothing is added at the desk — no admin fee, no
          padlock charge, no minimum term.
        </p>
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid gap-12 lg:grid-cols-[1.15fr_1fr]">
            <div>
              <SectionHeader eyebrow="Which one" title="In furniture, not in square feet"
                description="Nobody can picture 50 square feet. Everybody can picture a one-bed flat, which is what 50 square feet holds." />
              <SizeGuide className="mt-8" sizes={[
                { name: "Locker", area: 8, areaLabel: "8 sq ft", like: "A filing cabinet's worth", price: "£22 a month", alsoFits: ["6–8 boxes", "a bike", "seasonal decorations"] },
                { name: "25 sq ft", area: 25, areaLabel: "25 sq ft", like: "A large garden shed", price: "£38 a month", alsoFits: ["a single bed", "a wardrobe", "15 boxes"] },
                { name: "50 sq ft", area: 50, areaLabel: "50 sq ft", like: "A one-bedroom flat", price: "£58 a month", alsoFits: ["a double bed", "a 2-seat sofa", "a fridge", "30 boxes"] },
                { name: "75 sq ft", area: 75, areaLabel: "75 sq ft", like: "A two-bedroom house", price: "£79 a month", alsoFits: ["two beds", "a 3-seat sofa", "a washing machine", "50 boxes"] },
                { name: "125 sq ft", area: 125, areaLabel: "125 sq ft", like: "A three or four-bedroom house", price: "£124 a month", alsoFits: ["everything from a family house", "including the loft and the shed"] },
                { name: "Container", area: 155, areaLabel: "155 sq ft", like: "A single garage", price: "£165 a month", alsoFits: ["a car", "a four-bed house with room spare", "trade stock on pallets"] },
              ]} />
              <a className="mt-6 inline-block text-sm font-medium underline underline-offset-4" href="/sizes">The full guide, room by room →</a>
            </div>
            <div className="space-y-4">
              <SafeImage src={null} alt="The ground-floor corridor" ratio="4/3" />
              <SafeImage src={null} alt="A 50 sq ft unit with the shutter up" ratio="4/3" />
            </div>
          </div>
        </div>
      </section>

      <section id="find-us" className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-12 lg:grid-cols-[1fr_1fr]">
          <div>
            <SectionHeader eyebrow="Access and security" title="Yours, any hour" />
            <div className="mt-6 space-y-3 text-base leading-relaxed text-muted-foreground">
              <p>
                Your own code on the gate and your own padlock on the unit — we do not hold a key
                and we cannot get in. Twenty-four hours, every day, including Christmas.
              </p>
              <p>
                Fourteen cameras, recorded for ninety days, and every gate opening logged against
                the code that opened it. Somebody is on site 8 till 6 on weekdays.
              </p>
              <p>
                Trolleys, a pallet truck and a loading bay you can back a Luton into. All free, and
                you do not have to book them.
              </p>
            </div>
            <h3 className="mt-8 text-sm font-medium uppercase tracking-widest text-muted-foreground">Office hours</h3>
            <OpeningHours className="mt-3" days={[
              { day: 1, label: "Monday", open: "08:00", close: "18:00" },
              { day: 2, label: "Tuesday", open: "08:00", close: "18:00" },
              { day: 3, label: "Wednesday", open: "08:00", close: "18:00" },
              { day: 4, label: "Thursday", open: "08:00", close: "18:00" },
              { day: 5, label: "Friday", open: "08:00", close: "18:00" },
              { day: 6, label: "Saturday", open: "09:00", close: "16:00" },
              { day: 0, label: "Sunday", open: "10:00", close: "14:00" },
            ]} />
            <p className="mt-3 text-sm text-muted-foreground">
              Office hours are for signing up and buying boxes. Your unit is open all the time.
            </p>
          </div>
          <div>
            <LocationCard name="Neepsend Self Store"
              address="Unit 9, Rutland Works, Neepsend Lane, Sheffield, S3 8AT"
              note="Five minutes from the inner ring road, ten from the M1 J34. Drive-up access to every ground-floor unit and a loading bay for the first floor." />
            <Faq className="mt-8" items={[
              { question: "Is there really no deposit?", answer: "None. Pay the first month, sign one page, and you can move in the same hour if a unit is free." },
              { question: "How much notice to leave?", answer: "A week. There is no minimum term and no exit fee, and we refund the unused days rather than keeping them." },
              { question: "Can I get in at night?", answer: "Yes, any hour of any day. Your gate code works at three in the morning on Christmas Day." },
              { question: "Do you sell boxes?", answer: "At cost, in the office. Tape, bubble wrap, wardrobe boxes and mattress bags. We will also take back the ones you do not use." },
              { question: "What can I not store?", answer: "Anything living, anything perishable, anything flammable, and nothing you cannot legally own. Otherwise it is your unit and your business." },
              { question: "Is it insured?", answer: "To £5,000 as part of the price. Above that it is £4 a month per extra £5,000, and we will tell you honestly if your own home policy already covers it." },
            ]} />
          </div>
        </div>
      </section>
    </SiteChrome>
  );
}
