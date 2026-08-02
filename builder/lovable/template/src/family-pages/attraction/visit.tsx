// attraction /visit — getting here, access, food, what to bring. The page a
// family reads the night before, so it answers the things that ruin a day out
// rather than the things that sell one.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { AdmissionPrices } from "@/components/ui/admission-prices";
import { Faq } from "@/components/ui/faq";
import { LocationCard } from "@/components/ui/location-card";
import { OpeningHours } from "@/components/ui/opening-hours";
import { PriceList } from "@/components/ui/price-list";
import { SectionHeader } from "@/components/ui/section-header";
import { TICKETS, FAMILY } from "./index";
export const Route = createFileRoute("/visit")({ component: P });
function P() {
  return (
    <SiteChrome name="Wharncliffe Farm & Wildlife Park" tagline="Ninety acres, a steam railway and forty species, north of Sheffield."
      links={[{ label: "Home", href: "#/" }, { label: "What's on", href: "#/whats-on" }]}
      action={{ label: "Book tickets", href: "#/#prices" }}>

      <div className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="Plan your visit" title="The things that ruin a day out"
          description="Rather than the things that sell one. Read this the night before and you will not be the family standing at the gate at half past two." />

        <section className="mt-10 grid gap-12 lg:grid-cols-[1fr_1fr]">
          <div>
            <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Getting here</h2>
            <LocationCard className="mt-3" name="Wharncliffe Farm & Wildlife Park"
              address="Woodhead Road, Wharncliffe Side, Sheffield, S35 0DP"
              note="Signed from the A616 and from Oughtibridge. Satnavs send some people up Coumes Lane, which is single-track and wrong — follow the brown signs instead." />
            <ul className="mt-6 divide-y divide-border border-y border-border text-base">
              <li className="py-3">
                <span className="font-medium">Parking is free</span>
                <span className="block text-sm text-muted-foreground">
                  400 spaces on hardstanding, plus an overflow field used maybe eight days a year.
                  On those days it is grass and a wet one is a problem for a low car.
                </span>
              </li>
              <li className="py-3">
                <span className="font-medium">The 57 bus</span>
                <span className="block text-sm text-muted-foreground">
                  Stops at the end of the lane, then a ten-minute walk with no pavement for the last
                  hundred yards. Fine for adults, less fine with a pushchair.
                </span>
              </li>
              <li className="py-3">
                <span className="font-medium">Nearest station is Deepcar, 4 miles</span>
                <span className="block text-sm text-muted-foreground">
                  There is no useful bus between the two. A taxi is about £11 and we can ring one
                  from the desk for the way back.
                </span>
              </li>
            </ul>
          </div>
          <div>
            <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Opening</h2>
            <OpeningHours className="mt-3" days={[
              { day: 1, label: "Monday", open: "10:00", close: "17:00" },
              { day: 2, label: "Tuesday", open: "10:00", close: "17:00" },
              { day: 3, label: "Wednesday", open: "10:00", close: "17:00" },
              { day: 4, label: "Thursday", open: "10:00", close: "17:00" },
              { day: 5, label: "Friday", open: "10:00", close: "17:00" },
              { day: 6, label: "Saturday", open: "10:00", close: "17:30" },
              { day: 0, label: "Sunday", open: "10:00", close: "17:30" },
            ]} />
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Last admission 90 minutes before closing. November to February we shut at 16:00, the
              railway does not run, and the price drops to the winter rate at the gate without
              anybody having to ask for it.
            </p>

            <h2 className="mt-8 text-sm font-medium uppercase tracking-widest text-muted-foreground">Access</h2>
            <ul className="mt-3 divide-y divide-border border-y border-border text-base">
              <li className="py-3">Level or ramped everywhere except the wood boardwalk, which has four steps at the far end and a signed flat route round it</li>
              <li className="py-3">Carers come in free with the person they support, no proof and no form</li>
              <li className="py-3">Two accessible toilets and a changing places room by the tea room</li>
              <li className="py-3">Three manual wheelchairs to borrow, free, first come. Ring ahead and we will put one aside</li>
              <li className="py-3">The train has a ramp into the guard's van, which takes one chair per departure</li>
              <li className="py-3">Quiet hour on the first Sunday of the month, 10–11: no tannoy, no music, and the play barn at half capacity</li>
            </ul>
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="Eating" title="Bring a picnic or don't, both are fine"
            description="Three picnic areas with tables, and nobody minds. The tea room is a tea room — it is good at cake and honest about the rest." />
          <div className="mt-8 grid gap-10 lg:grid-cols-[1.2fr_1fr]">
            <PriceList items={[
              { name: "Sandwich, made that morning", price: 4.8, description: "Cheese, ham, egg, or coronation chicken on a good day" },
              { name: "Jacket potato with a filling", price: 6.5, description: "The most popular thing we sell and the queue at one o'clock proves it" },
              { name: "Children's lunch box", price: 4.5, description: "Sandwich, fruit, a biscuit and a drink. No toy and no upsell" },
              { name: "Soup and bread", price: 5.2, meta: "Winter only" },
              { name: "Cake", price: 3.2, description: "Made here. The parkin is the one to have" },
              { name: "Tea or filter coffee", price: 2.4, meta: "Refills 80p" },
            ]} />
            <div>
              <h3 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Worth knowing</h3>
              <ul className="mt-3 divide-y divide-border border-y border-border text-base">
                <li className="py-3">The queue is worst 12:30–13:30 and almost nothing at 11:45 or 14:00</li>
                <li className="py-3">Free hot water for baby bottles, always, ask at the counter</li>
                <li className="py-3">Gluten free bread and dairy free milk in stock; the kitchen is not a separate space and we will say so rather than promise otherwise</li>
                <li className="py-3">There is a kiosk by the play barn doing ice cream and drinks only, which saves the walk back</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="Prices" title="Same table as the front page"
            description="Repeated here because this is the page people read the night before, and going back for a number is a reason to close the tab." />
          <div className="mt-8 max-w-3xl">
            <AdmissionPrices tickets={TICKETS} family={FAMILY} caption="Day admission"
              note="Annual pass £58 an adult, £42 a child — three visits and it has paid for itself, which is the whole calculation and we are not going to dress it up." />
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="max-w-3xl">
            <SectionHeader eyebrow="Asked often" title="Before you set off" />
            <Faq className="mt-6" items={[
              { question: "What should we wear?", answer: "Boots or old trainers. It is a working farm on a hillside and about a third of the paths are not surfaced. In winter it is properly muddy and we would rather warn you than sell you a day you did not enjoy." },
              { question: "Is there anywhere to change a baby?", answer: "Three places — the tea room, the play barn and the main toilets by the entrance. All of them, not just the ladies'." },
              { question: "Can we leave and come back?", answer: "Yes, all day. Get your hand stamped at the gate. Plenty of people go to the car for lunch and come back in." },
              { question: "How busy is it?", answer: "Bank holidays and the first fortnight of the summer holidays are heaving. A weekday in term time you will have the place nearly to yourself, which is genuinely the best way to see it." },
              { question: "Is there a discount for groups?", answer: "Fifteen or more, £2 a head off, booked a week ahead. Schools have their own rate and a free planning visit for the teacher." },
              { question: "What happens if it pours?", answer: "The play barn, the reptile house and the tea room are about ninety minutes indoors. If it is genuinely torrential at opening we will tell you at the gate and you can come back another day on the same ticket." },
            ]} />
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
