// holiday-let — AVAILABILITY-FIRST: one property, one calendar, book direct.
// The whole argument of the family is the saving against the platforms, so the
// calendar carries the real per-night rate rather than a "from" figure.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { AvailabilityCalendar, type Night } from "@/components/ui/availability-calendar";
import { CtaBand } from "@/components/ui/cta-band";
import { Faq } from "@/components/ui/faq";
import { Gallery } from "@/components/ui/gallery";
import { LocationCard } from "@/components/ui/location-card";
import { PriceList } from "@/components/ui/price-list";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { Testimonial } from "@/components/ui/testimonial";
export const Route = createFileRoute("/")({ component: P });
// A real site reads this from its own table. Every night of the month, so an
// absent square means "not listed" rather than "free" — which is the thing the
// component refuses to guess at.
const AUGUST: Night[] = Array.from({ length: 31 }, (_, i) => {
  const day = i + 1;
  const date = `2026-08-${String(day).padStart(2, "0")}`;
  const dow = new Date(2026, 7, day).getDay();
  const weekend = dow === 5 || dow === 6;
  return {
    date,
    taken: [7, 8, 9, 14, 15, 16, 17, 22, 23, 24].includes(day),
    rate: weekend ? 165 : 135,
    minNights: weekend ? 3 : 2,
  };
});
function P() {
  return (
    <SiteChrome name="Wren Cottage" tagline="A two-bedroom stone cottage above Hathersage, in the Peak District."
      links={[{ label: "The rooms", href: "#/rooms" }, { label: "Round about", href: "#/area" }, { label: "Book", href: "#calendar" }]}
      action={{ label: "Check availability", href: "#calendar" }}>

      <section className="relative">
        <SafeImage src={null} alt="The view down the valley from the front door" ratio="21/9" />
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid items-start gap-12 lg:grid-cols-[1fr_1.1fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Sleeps 4 · two bedrooms · dog friendly · wood burner</p>
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">Wren Cottage</h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                A stone cottage a mile above Hathersage with the whole valley out of the front
                window. Stanage is a forty-minute walk uphill and the pub is fifteen minutes down.
                We live in the village and we let it ourselves.
              </p>
              <div className="mt-7 rounded-xl border border-border bg-muted/50 p-5">
                <p className="text-base font-semibold">Book direct and it is about £180 cheaper a week</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  The big platforms add 14–18% to the guest at checkout and take 3% from us. Booking
                  here removes both. Same cottage, same keys, same us — we just keep the difference
                  rather than a website in California.
                </p>
              </div>
              <div className="mt-7 flex flex-wrap gap-3">
                <a className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" href="#calendar">See the calendar</a>
                <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="#/rooms">Look round it</a>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <SafeImage src={null} alt="The sitting room and the burner" ratio="3/4" />
              <SafeImage src={null} alt="The kitchen, looking out" ratio="3/4" className="mt-10" />
            </div>
          </div>
        </div>
      </section>

      <section id="calendar" className="mx-auto max-w-4xl px-6 py-14">
        <SectionHeader eyebrow="Availability" title="Every night, with what it costs"
          description="Struck through means booked. The price on each square is what that night actually costs — no 'from', no surprise at the last step." />
        <AvailabilityCalendar className="mt-8" nights={AUGUST} month="2026-08" now={new Date(2026, 7, 2)} />
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr]">
            <div>
              <SectionHeader eyebrow="What you pay" title="The whole cost, before you ask"
                description="There is one extra charge and it is the dog. Everything else on this list is included and always has been." />
              <PriceList className="mt-6" items={[
                { name: "Midweek night", price: 135, meta: "Sun–Thu", description: "Two-night minimum out of season, three in July and August." },
                { name: "Weekend night", price: 165, meta: "Fri & Sat", description: "Three-night minimum in season. Changeover is 4pm in, 10am out." },
                { name: "Christmas and New Year", price: 210, meta: "Per night", description: "Seven nights minimum, and it goes about a year ahead." },
                { name: "Dog", price: 25, meta: "Per stay, not per night", description: "One dog, any size. Bring a towel — there is a hose at the back door for the muddy end of a walk." },
                { name: "Cleaning", price: 0, meta: "Included", description: "Not a separate fee. Karen has done it for nine years and she is paid properly out of the nightly rate." },
                { name: "Logs, coal and kindling", price: 0, meta: "Included", description: "A full basket on arrival and more in the shed. Nobody should arrive in February and be sold firewood." },
                { name: "Travel cot and high chair", price: 0, meta: "Included", description: "Say when you book so they are out and made up." },
              ]} />
            </div>
            <div className="space-y-4 self-start">
              <Testimonial item={{ quote: "The calendar had the actual prices on it, which meant we could work out the week ourselves at eleven at night instead of waiting for someone to email.", name: "Priya", role: "Stayed in October" }} />
              <Testimonial item={{ quote: "Booked it direct after finding it on one of the big sites. Saved a hundred and eighty quid and got a text from a person rather than a confirmation number.", name: "Gareth", role: "Stayed twice" }} />
              <Testimonial item={{ quote: "Dog, two kids, one wet week. The drying room and the log basket were the two things that made it fine.", name: "Elin", role: "Stayed in February" }} />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="The cottage" title="What it actually looks like"
          description="Photographed on a normal Tuesday with a phone. Nothing is wide-angled to look bigger than it is." />
        <Gallery className="mt-8" columns={4} items={[
          { src: null, alt: "The front, from the lane" },
          { src: null, alt: "Sitting room and burner" },
          { src: null, alt: "The kitchen" },
          { src: null, alt: "Main bedroom, double" },
          { src: null, alt: "Second bedroom, twin" },
          { src: null, alt: "Bathroom with the roll-top" },
          { src: null, alt: "The garden and the wall" },
          { src: null, alt: "The view at six in the morning" },
        ]} />
      </section>

      <section className="border-t border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <SectionHeader eyebrow="Asked often" title="The practical questions" />
              <Faq className="mt-6" items={[
                { question: "How do we get the keys?", answer: "A key safe by the door, code texted on the morning you arrive. We usually pop up at some point but you will never have to wait in for us." },
                { question: "Is there parking?", answer: "One space directly outside, and the lane takes a second car. The lane is steep and it is not gritted — a normal car is fine except in real snow." },
                { question: "Is there a signal?", answer: "Patchy on EE and Vodafone, nothing on O2. There is proper broadband and the wifi reaches the garden." },
                { question: "Can we bring two dogs?", answer: "Ask. Usually yes, and the charge stays £25 for the stay rather than per dog." },
                { question: "What if we need to cancel?", answer: "Full refund up to four weeks before, half up to two. Inside that we will refund whatever we manage to relet, which most of the time is all of it." },
              ]} />
            </div>
            <div>
              <SectionHeader eyebrow="Find it" title="Above Hathersage" />
              <LocationCard className="mt-6" name="Wren Cottage"
                address="2 Coggers Lane, Hathersage, Hope Valley, S32 1AJ"
                note="Twelve minutes' walk down into the village, forty minutes up to Stanage Edge. Hathersage station is on the Sheffield–Manchester line, so the whole trip works without a car." />
              <SafeImage className="mt-6" src={null} alt="Coggers Lane in the morning" ratio="4/3" />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <CtaBand title="Book it direct"
          description="Reply within the day, from one of us, and no booking fee at either end."
          action={{ label: "See which nights are free", href: "#calendar" }} />
      </section>
    </SiteChrome>
  );
}
