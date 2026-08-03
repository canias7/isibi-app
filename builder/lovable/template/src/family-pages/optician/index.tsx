// optician — TEST-THEN-FRAMES: an appointment on one side and a shop on the
// other, kept visibly apart because they are two different visits.
//
// THE NHS ENTITLEMENT IS STATED IN THE HERO. Most people who qualify for a free
// eye test do not know they do — over 60, diabetic, glaucoma in the family,
// on certain benefits — and every optician's website leaves it in a footer
// beside the terms. Putting it at the top costs a few paid tests and is the
// single most useful sentence on the page.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { AvailabilityGrid } from "@/components/ui/availability-grid";
import { PriceList } from "@/components/ui/price-list";
import { OpeningHours } from "@/components/ui/opening-hours";
import { MediaGrid } from "@/components/ui/media-grid";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/")({ component: P });

const FREE = [
  "You are 60 or over",
  "You are under 16, or under 19 and in full-time education",
  "You have diabetes, or glaucoma",
  "You are 40 or over and a parent, sibling or child has glaucoma",
  "You are on Income Support, Pension Credit Guarantee, or Universal Credit under the threshold",
  "You hold an NHS HC2 certificate, or an HC3 for part of it",
];

const FRAMES = [
  { name: "Own-brand acetate", description: "About forty shapes, made in Italy", price: 89, meta: "frame only" },
  { name: "Own-brand titanium", description: "Light, hypoallergenic, bends rather than snaps", price: 129, meta: "frame only" },
  { name: "Designer", description: "Twelve names. Priced as they come and we do not mark them up further", price: null, meta: "£150 – £320" },
  { name: "Children's frames", description: "Free on an NHS voucher, and we mean genuinely free", price: 0, meta: "with a voucher" },
  { name: "Reglazing your own frame", description: "If it is sound. We will say honestly if it is not", price: 35, meta: "plus lenses" },
];

// TWO COMPONENTS EXPORT `DayHours` — working-hours-input's is
// {key, open: boolean, from, to} and opening-hours' is {day: number, label,
// open, close}. This is the latter: `day` is 0 = Sunday, matching
// Date.getDay(), and a closed day is a null `open` rather than a false flag.
const HOURS = [
  { day: 1, label: "Monday", open: "09:00", close: "17:30" },
  { day: 2, label: "Tuesday", open: "09:00", close: "17:30" },
  { day: 3, label: "Wednesday", open: "09:00", close: "13:00" },
  { day: 4, label: "Thursday", open: "09:00", close: "19:00" },
  { day: 5, label: "Friday", open: "09:00", close: "17:30" },
  { day: 6, label: "Saturday", open: "09:00", close: "16:00" },
  { day: 0, label: "Sunday", open: null, close: null },
];

function P() {
  return (
    <SiteChrome
      name="Hillsborough Eyecare"
      tagline="An independent optician on Middlewood Road since 1988."
      links={[
        { label: "The eye test", href: "#/eye-test" },
        { label: "Frames and lenses", href: "#/frames" },
        { label: "Questions", href: "#questions" },
      ]}
      action={{ label: "Book an eye test", href: "#book" }}
    >
      {/* THE TEST ROOM FIRST, THE FRAMES SECOND, and that order is the whole
          family. Every optician's website leads with a wall of frames, which
          sells the accessory and hides the clinical half — and the clinical
          half is what an OCT scan is, what it costs, and why it matters. A
          photograph of the actual equipment is the only way to show that this
          is a health appointment rather than a shopping trip. */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 pt-10">
          <MediaGrid
            columns={4}
            ratio="4/3"
            items={[
              { src: null, alt: "The test room with the chart and the phoropter, chair empty, lights up", caption: "Thirty minutes with an optometrist. Not fifteen." },
              { src: null, alt: "The OCT scanner, screen showing a cross-section of a retina", caption: "OCT, £25. It sees under the retina — this is the one worth paying for." },
              { src: null, alt: "The frame wall, about two hundred frames, price bands marked on the shelf edge", caption: "About 200 frames, and the price band is on the shelf, not hidden inside." },
              { src: null, alt: "The glazing bench at the back, a lens in the edger", caption: "Single vision glazed here, usually same day." },
            ]}
          />
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid items-start gap-14 lg:grid-cols-2">
            {/* THE APPOINTMENT SIDE */}
            <div id="book">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                The appointment
              </p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance">
                Book an eye test
              </h1>
              <p className="mt-4 max-w-lg leading-relaxed text-muted-foreground">
                Thirty minutes with an optometrist, including retinal photographs at no extra
                charge. Every test here is a full one — we do not run a shorter version.
              </p>

              <div className="mt-6 rounded-xl border-2 border-foreground p-5">
                <p className="font-medium">You may not have to pay for it</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  A test is £28. It is free on the NHS if any one of these applies, and most people
                  who qualify do not know they do:
                </p>
                <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                  {FREE.map((f) => (
                    <li key={f} className="flex gap-2">
                      <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-foreground" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-sm text-muted-foreground">
                  We will check when you arrive. Nobody has ever been charged here for a test they
                  were entitled to.
                </p>
              </div>

              <div className="mt-8">
                <p className="text-sm font-medium">Thursday 6 August</p>
                <div className="mt-3">
                  <AvailabilityGrid
                    slots={["09:00", "09:40", "10:20", "11:00", "14:00", "14:40", "15:20", "16:00", "17:20", "18:00"]}
                    taken={["09:40", "11:00", "14:00", "16:00"]}
                    value="10:20"
                  />
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  Thursday is the late night, to 19:00. If your pupils are dilated you will not be
                  able to drive for a few hours afterwards, so an evening slot suits that better.
                </p>
              </div>

              <a className="mt-7 inline-block rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" href="#/eye-test">
                What happens in the thirty minutes
              </a>
            </div>

            {/* THE SHOP SIDE */}
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                The shop
              </p>
              <h2 className="mt-3 text-4xl font-semibold tracking-tight text-balance">
                Frames and lenses
              </h2>
              <p className="mt-4 max-w-lg leading-relaxed text-muted-foreground">
                A separate visit, and there is no obligation to buy here after a test. Your
                prescription is yours by law and we will print it whether or not you spend anything.
              </p>
              <div className="mt-6">
                <PriceList items={FRAMES} />
              </div>
              <p className="mt-4 max-w-lg text-sm leading-relaxed text-muted-foreground">
                Lenses are priced separately as options rather than as a range, so a total can
                actually be worked out before you commit to anything.{" "}
                <a className="underline underline-offset-4" href="#/frames">The lens options are here.</a>
              </p>
              <div className="mt-8">
                <OpeningHours days={HOURS} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="questions">
        <div className="mx-auto max-w-3xl px-6 py-14">
          <SectionHeader title="What people ask at the desk" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "How often should I have a test?",
                  answer:
                    "Every two years for most adults, annually over 70, under 16, or if you have diabetes. If we think you need one sooner we will say so and it is not a sales technique.",
                },
                {
                  question: "Can I take my prescription elsewhere?",
                  answer:
                    "Yes, and we will print it without being asked. It is your property in law. Buying online is genuinely cheaper for a simple single-vision lens and we will tell you so.",
                },
                {
                  question: "Do you do NHS vouchers?",
                  answer:
                    "Yes, and children's frames are genuinely free on one rather than free-if-you-choose-from-this-tray. That practice is why people distrust opticians.",
                },
                {
                  question: "How long do glasses take?",
                  answer:
                    "Single vision in about five working days, varifocals in seven to ten. Anything glazed on site is faster and we will say which yours is when you order.",
                },
              ]}
            />
          </div>
        </div>
      </section>
    </SiteChrome>
  );
}
