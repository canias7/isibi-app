// bed-and-breakfast — BOOK-DIRECT-FIRST: the same stay priced here against the
// platform, computed, with the date it was checked. "Best price guaranteed" is
// on every small hotel's site and nobody believes it; two numbers and the gap
// between them is checkable in one glance.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { DirectSaving } from "@/components/ui/direct-saving";
import { Faq } from "@/components/ui/faq";
import { LocationCard } from "@/components/ui/location-card";
import { RateCard } from "@/components/ui/rate-card";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { TestimonialGrid } from "@/components/ui/testimonial";
export const Route = createFileRoute("/")({ component: P });
export const TARIFF = [
  { period: "The Garden Room", units: 1, price: 85, more: [110], note: "Ground floor, walk-in shower, doors onto the terrace. The one to ask for" },
  { period: "The Blue Room", units: 1, price: 78, more: [98], note: "First floor, bath with a shower over, looks up the valley" },
  { period: "The Back Room", units: 1, price: 70, more: [88], note: "First floor, smallest, shower only. Quietest room in the house" },
  { period: "The Attic", units: 1, price: 78, more: [98, 128], note: "Two rooms on the top floor taken together — a double and a twin, one bathroom. Sleeps four" },
];
export const QUOTES = [
  { quote: "I travel for work and I am always charged as though I am two people. Here the single rate was on the website and it was the price I paid.", name: "Rhona Kellett", role: "Two nights, February" },
  { quote: "Breakfast at half six because I had a train. Nobody sighed.", name: "Dev Sandhu", role: "One night, March" },
  { quote: "We booked through Booking.com the first time and direct every time since, which I think was the plan.", name: "The Ackroyds", role: "Four stays" },
];
function P() {
  return (
    <SiteChrome name="Thurgoland House" tagline="Four rooms above the Don valley. Breakfast until nine, and later if you ask."
      links={[{ label: "The rooms", href: "#/rooms" }, { label: "Staying", href: "#/stay" }, { label: "Find us", href: "#find-us" }]}
      action={{ label: "Book direct", href: "#/stay" }}>

      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid items-start gap-12 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Four rooms · breakfast included · parking for five</p>
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">
                The same room, £17 less
              </h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                Not a loyalty scheme and not a members' rate — just the commission, which we would
                rather you had than a website in Amsterdam. The numbers are both here so you can
                check rather than take our word for it.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <a className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" href="#/stay">Book direct</a>
                <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="#/rooms">See the rooms</a>
              </div>
              <div className="mt-10">
                <SafeImage src={null} alt="The house from the lane" ratio="16/9" />
              </div>
            </div>
            {/* THE COMPUTED COMPARISON, above everything. A guest who has just
                come from a platform has no way to check "best price
                guaranteed" without opening the tab where they book. */}
            <DirectSaving platform="Booking.com" platformPrice={132} ourPrice={115}
              checked="28 July" nights="Garden Room, two people, Friday 14 August, one night"
              instead="What direct does buy is a person on the phone, a late arrival sorted out in one call, and a cancellation that does not need a form." />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="The tariff" title="And what one person actually pays"
          description="A solo traveller assumes half of the double rate and it is never half — the room costs what the room costs. Here is the real number rather than a phone call to find it out." />
        <div className="mt-8 grid gap-10 lg:grid-cols-[1.2fr_1fr]">
          <RateCard label="Room" unit="night" bands={["One person", "Two people", "Three or four"]}
            caption="Per night, breakfast included" rates={TARIFF}
            note="Every rate includes breakfast, parking and VAT. There is no charge for a cot, and no single supplement dressed up as a discount off a number nobody pays." />
          <div>
            <h3 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Included, and not extra</h3>
            <ul className="mt-3 divide-y divide-border border-y border-border text-base">
              <li className="py-3">Full breakfast, cooked to order, 07:30–09:00 — earlier by arrangement and it is never a problem</li>
              <li className="py-3">Off-road parking for five cars, which is one per room and one spare</li>
              <li className="py-3">Tea, coffee and cake in the sitting room, all day, help yourself</li>
              <li className="py-3">A cot and a highchair, free, if you say when you book</li>
              <li className="py-3">Drying room for boots and waterproofs — this is walking country and everybody arrives wet at some point</li>
              <li className="py-3">A lift to the station in Penistone at eight, if you are catching a train</li>
            </ul>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              There is no minimum stay, no weekend supplement and no charge for a single night on a
              Saturday. Those three are why most B&Bs are cheaper on a platform and this one is not.
            </p>
          </div>
        </div>
      </section>

      <section id="find-us" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr]">
            <div>
              <SectionHeader eyebrow="Where" title="Above the valley, off the A629" />
              <LocationCard className="mt-6" name="Thurgoland House"
                address="Halifax Road, Thurgoland, Sheffield, S35 7AN"
                note="Twelve minutes from junction 36 of the M1, four miles from Penistone station, and the Trans Pennine Trail runs along the bottom of the garden. Parking is on the gravel, off the road." />
              <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
                Sheffield is twenty-five minutes, Holmfirth twenty, and the Peak District boundary
                is about six miles. People stay here for weddings at Wortley Hall, for walking, and
                because the M1 is close enough to be useful and far enough not to be heard.
              </p>
            </div>
            <div>
              <SectionHeader eyebrow="What people said" title="Including about the single rate" />
              <TestimonialGrid className="mt-6" columns={1} items={QUOTES} />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <div className="max-w-3xl">
          <SectionHeader eyebrow="Asked often" title="Before you book" />
          <Faq className="mt-6" items={[
            { question: "Is it really cheaper direct?", answer: "Yes, by whatever the platform's commission is — about fifteen per cent. If you find it lower there today, tell us and we will match it; the comparison on this page is dated for exactly that reason." },
            { question: "What is the single rate?", answer: "It is on the tariff above, per room. The Back Room is £70 for one and £88 for two. Nobody pays the double rate for sleeping alone here." },
            { question: "Can we arrive late?", answer: "Any time up to eleven if you tell us, and there is a key safe after that. Ring rather than guess — we live here, so somebody is nearly always in." },
            { question: "Do you do evening meals?", answer: "No. The Bridge in Thurgoland does proper food and is a six-minute walk, and we will book you a table if you ask at breakfast." },
            { question: "Are dogs allowed?", answer: "In the Garden Room, one dog, £10 for the stay. Not in the breakfast room, which is a food hygiene rule rather than a preference." },
            { question: "How do I cancel?", answer: "Up to 48 hours before, free, by phone or email. Inside that we ask for the first night if we cannot fill it, and we usually can." },
          ]} />
        </div>
      </section>
    </SiteChrome>
  );
}
