// hire /book — the dates, the extras, and the money that is NOT the hire rate.
// The deposit and the excess get their own section above the form, because
// finding them at the counter with a van booked is the complaint this whole
// family exists to remove.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { AvailabilityCalendar, type Night } from "@/components/ui/availability-calendar";
import { ContactForm } from "@/components/ui/contact-form";
import { Faq } from "@/components/ui/faq";
import { PriceList } from "@/components/ui/price-list";
import { RateCard } from "@/components/ui/rate-card";
import { SectionHeader } from "@/components/ui/section-header";
import { Steps } from "@/components/ui/steps";
export const Route = createFileRoute("/book")({ component: P });
const AUGUST: Night[] = Array.from({ length: 31 }, (_, i) => {
  const day = i + 1;
  const dow = new Date(2026, 7, day).getDay();
  return {
    date: `2026-08-${String(day).padStart(2, "0")}`,
    taken: [6, 7, 8, 14, 15, 21, 22, 28, 29].includes(day),
    rate: dow === 5 || dow === 6 ? 64 : 58,
  };
});
function P() {
  return (
    <SiteChrome name="Rivelin Vehicle Hire" tagline="Vans, Lutons and trailers, hired by the day in Sheffield."
      links={[{ label: "Home", href: "/" }, { label: "One van in full", href: "/item" }]}
      action={{ label: "Ring 0114 272 8810", href: "tel:01142728810" }}>

      <div className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="Reserve" title="Free to hold, nothing to pay now"
          description="We take the vehicle off the board for you and take payment when you collect it. No card details to reserve and no cancellation fee." />

        {/* THE MONEY THAT IS NOT THE RATE, above the form. Everybody in this
            trade puts it in the terms and everybody's customer finds it at the
            counter with a job booked for the morning. */}
        <section className="mt-10 rounded-xl border border-border bg-muted/50 p-6 sm:p-8">
          <h2 className="text-2xl font-semibold tracking-tight">Before the rate, the two numbers that catch people</h2>
          <div className="mt-6 grid gap-8 sm:grid-cols-2">
            <div>
              <p className="text-3xl font-semibold tabular-nums">£150</p>
              <p className="mt-1 font-medium">Deposit</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Held on a card, not taken. Released within three working days of the vehicle coming
                back. It is not a fee and you do not lose any of it for ordinary use.
              </p>
            </div>
            <div>
              <p className="text-3xl font-semibold tabular-nums">£750</p>
              <p className="mt-1 font-medium">Insurance excess</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                What you would pay towards damage, whoever caused it. £12 a day brings it to £150 —
                worth it on anything longer than a weekend, and not worth it on a two-hour tip run.
              </p>
            </div>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            A driver under 25 pays £15 a day more and the excess stays at £750. Under 23 we cannot
            insure at all, which is the insurer's rule and not ours.
          </p>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="grid gap-12 lg:grid-cols-[1.15fr_1fr]">
            <div>
              <SectionHeader eyebrow="Which days" title="What is free this month"
                description="Updated as bookings land. Ring for anything showing as taken — a cancellation the same morning is not unusual." />
              <AvailabilityCalendar className="mt-6" nights={AUGUST} month="2026-08" now={new Date(2026, 7, 2)} />
            </div>
            <div>
              <SectionHeader eyebrow="Rates" title="What it comes to"
                description="Long wheelbase van. Every vehicle is priced the same way." />
              <RateCard className="mt-6" unit="day" rates={[
                { period: "A day", units: 1, price: 58 },
                { period: "A weekend, Fri–Mon", units: 3, price: 132 },
                { period: "Three days", units: 3, price: 145 },
                { period: "A week", units: 7, price: 245 },
                { period: "A month", units: 28, price: 720 },
              ]} />
            </div>
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="Extras" title="Everything else there is to pay"
            description="This is the complete list. If a charge is not on it, it does not exist." />
          <div className="mt-6 grid gap-x-12 gap-y-8 lg:grid-cols-2">
            <PriceList items={[
              { name: "Excess reduction", price: 12, meta: "Per day", description: "£750 down to £150. Most people take it for anything over a weekend." },
              { name: "Additional driver", price: 8, meta: "Per day", description: "Same licence checks. Both of you present at collection." },
              { name: "Driver under 25", price: 15, meta: "Per day", description: "The insurer's loading, passed on at cost. Under 23 we cannot cover at all." },
              { name: "Out-of-hours collection", price: 25, description: "Before 7:30 or after closing, by arrangement. Return is free at any hour — there is a key box." },
            ]} />
            <PriceList items={[
              { name: "Trolley, straps and blankets", price: 0, meta: "Free", description: "Sack barrow, four ratchet straps and six blankets, with every hire. Ask when you book so they are in it." },
              { name: "Breakdown cover", price: 0, meta: "Included", description: "Recovery to your destination, not to the nearest garage." },
              { name: "Mileage", price: 0, meta: "Unlimited in the UK", description: "Abroad needs a green card and £45 for the paperwork, arranged a week ahead." },
              { name: "Cancellation", price: 0, meta: "Free, any notice", description: "Including on the morning. We would rather know than hold a van for nobody." },
            ]} />
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr]">
            <div>
              <SectionHeader eyebrow="Reserve one" title="Tell us the vehicle and the dates"
                description="Somebody in the yard reads these and replies within the hour during opening times. No card details and nothing to pay until you collect." />
              <ContactForm className="mt-6" askPhone onSubmit={() => {}} />
            </div>
            <div>
              <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Bring on the day</h2>
              <ul className="mt-3 divide-y divide-border border-y border-border text-base">
                <li className="py-3">Your driving licence — the plastic card, not a photo of it</li>
                <li className="py-3">A DVLA check code, generated within 21 days at gov.uk</li>
                <li className="py-3">A utility bill or bank statement dated within three months</li>
                <li className="py-3">The card the deposit goes on, in the driver's own name</li>
              </ul>
              <Steps className="mt-8" items={[
                { title: "Fifteen minutes at the counter", description: "Licence check, walk round the vehicle, photographs of anything already marked." },
                { title: "Take it away full", description: "Fuel gauge and mileage written on the sheet you both sign." },
                { title: "Bring it back", description: "Any hour — there is a key box. We check it the next working morning and release the deposit." },
              ]} />
              <Faq className="mt-8" items={[
                { question: "Can I extend once I have it?", answer: "Ring us. If nobody is waiting for it the answer is yes and it is charged at the daily rate, or dropped to the weekly rate if that works out cheaper — we do that automatically." },
                { question: "What if I damage it?", answer: "Tell us. The excess is what you pay and nothing beyond it. We have never charged anybody for a scratch that was on the sheet at collection, which is why we photograph it." },
                { question: "Do you deliver?", answer: "Within ten miles, £35 each way, and somebody with a licence has to be there to sign." },
              ]} />
            </div>
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
