// estate-agent/date-picker /listing — one property, and the change from the
// sales family is that the enquiry is a DATE CHECK rather than a viewing
// request. A house is available on every date there is; a cottage is the
// opposite, and a listing page whose call to action ignores that sends
// somebody to a form to be told no.
import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { AvailabilityCalendar } from "@/components/ui/availability-calendar";
import { Faq } from "@/components/ui/faq";
import { Gallery } from "@/components/ui/gallery";
import { HouseRules } from "@/components/ui/house-rules";
import { LocationCard } from "@/components/ui/location-card";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { SpecList, SpecRow } from "@/components/ui/spec-row";
import { Testimonial } from "@/components/ui/testimonial";
export const Route = createFileRoute("/listing")({ component: P });
const NIGHTS = [
  { date: "2026-08-01", rate: 145 }, { date: "2026-08-02", rate: 132 },
  { date: "2026-08-03", rate: 132 }, { date: "2026-08-04", rate: 132 },
  { date: "2026-08-05", rate: 132 }, { date: "2026-08-06", rate: 132 },
  { date: "2026-08-07", rate: 145, minNights: 3 }, { date: "2026-08-08", rate: 145, minNights: 3 },
  { date: "2026-08-09", taken: true }, { date: "2026-08-10", taken: true },
  { date: "2026-08-11", taken: true }, { date: "2026-08-12", taken: true },
  { date: "2026-08-13", rate: 132 }, { date: "2026-08-14", rate: 145, minNights: 3 },
  { date: "2026-08-15", rate: 145, minNights: 3 }, { date: "2026-08-16", rate: 132 },
  { date: "2026-08-17", rate: 132 }, { date: "2026-08-18", rate: 132 },
  { date: "2026-08-19", rate: 132 }, { date: "2026-08-20", rate: 132 },
  { date: "2026-08-21", taken: true }, { date: "2026-08-22", taken: true },
  { date: "2026-08-23", taken: true }, { date: "2026-08-24", rate: 132 },
  { date: "2026-08-25", rate: 132 }, { date: "2026-08-26", rate: 132 },
  { date: "2026-08-27", rate: 132 }, { date: "2026-08-28", rate: 168, minNights: 3 },
  { date: "2026-08-29", rate: 168, minNights: 3 }, { date: "2026-08-30", rate: 168 },
  { date: "2026-08-31", rate: 168 },
];
function P() {
  const [month, setMonth] = React.useState("2026-08");
  return (
    <SiteChrome name="Dales Lets" tagline="Twenty-two cottages, barns and huts in Upper Wharfedale. Booked direct."
      links={[{ label: "All the places", href: "#/" }, { label: "Owners", href: "#/landlords" }]}
      action={{ label: "Ring 01756 760 210", href: "tel:01756760210" }}>

      <div className="mx-auto max-w-6xl px-6 py-10">
        <a className="text-sm text-muted-foreground underline underline-offset-4" href="#/">← All twenty-two</a>

        <div className="mt-4 grid items-start gap-10 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Kettlewell, Wharfedale · sleeps 4 · dogs welcome</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-balance">Beck Cottage</h1>
            <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">
              A two-up two-down on the lane behind the Blue Bell, with the beck at the bottom of the
              garden and a wood burner that does the whole house. Two minutes to the pub, six to the
              shop, and straight onto the Dales Way from the gate.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-4">
              <SafeImage src={null} alt="Beck Cottage from the lane" ratio="4/3" className="col-span-2" />
              <SafeImage src={null} alt="The sitting room and the burner" ratio="1/1" />
              <SafeImage src={null} alt="The garden and the beck" ratio="1/1" />
            </div>
          </div>

          {/* THE DATE CHECK IS THE CALL TO ACTION. In the sales family this
              slot is a viewing enquiry; here a form that ignores dates sends
              somebody away to be told no. */}
          <div>
            <AvailabilityCalendar nights={NIGHTS} month={month} onMonth={setMonth}
              now={new Date(2026, 7, 3)}
              priceNote="The price on each night is the whole cottage for up to four, cleaning included." />
            <div className="mt-5 rounded-lg border border-border p-5">
              <p className="text-base font-medium">Three nights from Friday 14th — £435</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Whole cottage, up to four people, cleaning and linen in the price. No booking fee,
                no card fee, and £15 for the dog which is what the extra clean actually costs.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <a className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" href="tel:01756760210">Hold these dates</a>
                <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="#/">See what else is free</a>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                Nothing is taken now. We hold on a phone number and take a 25% deposit when you have
                seen the confirmation.
              </p>
            </div>
            <div className="mt-6">
              <Testimonial item={{ quote: "Booked it three times. The burner is the reason and the beck is the other reason, and both of them are exactly as described rather than optimistically described.", name: "Hilary Nutbrown", role: "Three stays" }} />
            </div>
          </div>
        </div>

        <section className="mt-14 border-t border-border pt-10">
          <div className="grid gap-10 lg:grid-cols-[1fr_1fr]">
            <div>
              <SectionHeader eyebrow="The cottage" title="What is actually in it" />
              <SpecList className="mt-6">
                <SpecRow label="Sleeps" value="4" note="One double, one twin. No sofa bed and we do not count one" highlight />
                <SpecRow label="Bathrooms" value="One, upstairs" note="Bath with a shower over. No downstairs loo, which catches people out" highlight />
                <SpecRow label="Heating" value="Wood burner and oil" note="First basket of logs free, £8 a basket after. The burner does the whole house" />
                <SpecRow label="Kitchen" value="Full" note="Oven, hob, dishwasher, washer. No tumble dryer and there is a line in the garden" />
                <SpecRow label="Parking" value="One car, off the lane" note="A second car goes on the road, thirty yards, and is fine except bank holidays" />
                <SpecRow label="Wifi" value="Yes, 40Mb" note="Phone signal is one bar of EE upstairs and nothing downstairs" />
                <SpecRow label="Stairs" value="Steep and turning" note="1750s cottage. Not one for anybody unsteady, and we would rather say so" />
                <SpecRow label="Dogs" value="Two, £15 each" note="Not upstairs. There is a stairgate in the cupboard" />
              </SpecList>
            </div>
            <div>
              <SectionHeader eyebrow="Arriving" title="Four o'clock, and the key is in a safe" />
              <HouseRules className="mt-6"
                arrive="16:00 onwards" leave="10:00"
                lateNote="Arrive whenever you like after four — the code comes by text on the morning. There is nobody to keep waiting and no desk to check in at."
                rules={[
                  { what: "Two dogs, downstairs only", firm: true, detail: "£15 each. The stairgate is in the understairs cupboard and it fits." },
                  { what: "No smoking or vaping inside", firm: true, detail: "The whole cottage. There is a bench by the back door." },
                  { what: "No parties, and no more than four", firm: true, detail: "It sleeps four and the neighbours are forty feet away on both sides. This is the one that gets a booking cancelled." },
                  { what: "Take the recycling with you or use the bins", firm: false, detail: "Collection is Tuesday. The bins are behind the shed and the neighbours will not mind either way." },
                  { what: "Let the burner go out before you leave", firm: false, detail: "Or at least do not load it at nine on the morning you go." },
                ]} />
            </div>
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="The place" title="Kettlewell, and what is within walking distance" />
          <Gallery className="mt-8" columns={4} items={[
            { alt: "The lane behind the Blue Bell", caption: "The lane" },
            { alt: "The sitting room in winter", caption: "The burner does the whole house" },
            { alt: "The double bedroom", caption: "Double, front" },
            { alt: "The twin", caption: "Twin, back, over the beck" },
            { alt: "The kitchen", caption: "Dishwasher, no tumble dryer" },
            { alt: "The garden and the water", caption: "The beck, at the bottom" },
            { alt: "The Blue Bell, two minutes", caption: "Two minutes to the pub" },
            { alt: "The Dales Way from the gate", caption: "Straight onto the Way" },
          ]} />
          <div className="mt-8">
            <LocationCard name="Beck Cottage" address="Back Lane, Kettlewell, Skipton, BD23 5RD"
              note="Forty minutes from Skipton, an hour and ten from Leeds. The last two miles are single-track with passing places and it is fine in anything, but not something to do for the first time in the dark." />
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="max-w-3xl">
            <SectionHeader eyebrow="Asked often" title="About this one" />
            <Faq className="mt-6" items={[
              { question: "Why are some nights struck through?", answer: "Somebody has it. The calendar is the real diary and it updates the moment a booking is confirmed — there is no lag and no held-back inventory." },
              { question: "What is the minimum stay?", answer: "Three nights arriving on a Friday, two on a Sunday, and seven in the school holidays. The calendar marks which nights carry which, so you can see it rather than discover it." },
              { question: "Is it suitable for somebody unsteady on stairs?", answer: "No, honestly. The stairs are 1750s, steep, and they turn. Green End in Grassington has a bedroom and a shower room on the ground floor and sleeps the same four." },
              { question: "Can we bring two dogs?", answer: "Yes, £15 each, downstairs only. There is a stairgate that fits and it is in the understairs cupboard." },
              { question: "Is there anywhere to eat?", answer: "The Blue Bell is two minutes and does food every day; the Racehorses is five and is better on a Sunday. The shop does a good pie and shuts at five." },
              { question: "What if the weather is dreadful?", answer: "Then you have a wood burner, a full log basket and no phone signal, which several people book it for on purpose. Skipton is forty minutes if you need a town." },
            ]} />
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
