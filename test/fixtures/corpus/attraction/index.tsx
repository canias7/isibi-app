// attraction — PLAN-YOUR-DAY-FIRST: what it costs, when it opens, what happens
// at what time, and how long to allow. A family deciding on Saturday morning
// needs all four inside the first screen, and gets a hero video instead.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { AdmissionPrices } from "@/components/ui/admission-prices";
import { Faq } from "@/components/ui/faq";
import { Gallery } from "@/components/ui/gallery";
import { LocationCard } from "@/components/ui/location-card";
import { OpeningHours } from "@/components/ui/opening-hours";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { ServiceTimes } from "@/components/ui/service-times";
export const Route = createFileRoute("/")({ component: P });
export const TICKETS = [
  { name: "Adult", price: 16.5, advance: 14.5 },
  { name: "Child 3–15", price: 12, advance: 10.5 },
  { name: "Under 3", price: 0, advance: 0, note: "Free, and no ticket needed" },
  { name: "Concession", price: 13.5, advance: 12, note: "Over 65, student, or anyone on Universal Credit. Carers go free with the person they support" },
];
export const FAMILY = {
  name: "Family, 2 adults + 2 children",
  price: 52,
  advance: 46,
  covers: [{ name: "Adult", count: 2 }, { name: "Child 3–15", count: 2 }],
};
export const TIMETABLE = [
  { day: "Every day", time: "10:30", what: "Otters fed", where: "Lower pond" },
  { day: "Every day", time: "11:15", what: "Steam train departs", where: "Halt platform", note: "Runs every 45 minutes until 16:00" },
  { day: "Every day", time: "12:00", what: "Meet the barn owls", where: "Raptor lawn" },
  { day: "Every day", time: "13:30", what: "Goat and alpaca feeding", where: "Paddock", note: "Bring 50p for the feed cups" },
  { day: "Every day", time: "14:00", what: "Keeper talk — the beavers", where: "Wetland hide" },
  { day: "Every day", time: "15:00", what: "Falconry display", where: "Raptor lawn", note: "Does not fly in high wind — a keeper talk instead" },
  { day: "Every day", time: "16:00", what: "Last train", where: "Halt platform" },
];
function P() {
  return (
    <SiteChrome name="Wharncliffe Farm & Wildlife Park" tagline="Ninety acres, a steam railway and forty species, north of Sheffield."
      links={[{ label: "Plan your visit", href: "/visit" }, { label: "What's on", href: "/whats-on" }, { label: "Prices", href: "#prices" }]}
      action={{ label: "Book tickets", href: "#prices" }}>

      <section>
        <SafeImage src={null} alt="The park from the top field" ratio="21/9" />
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid items-start gap-12 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Wharncliffe Side · 90 acres · allow 4–5 hours</p>
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">
                Wharncliffe Farm &amp; Wildlife Park
              </h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                Forty species, a working farm, a mile of narrow-gauge railway and a wood you can
                get lost in. Open every day but Christmas Day, and there is enough here for most of
                a day rather than most of an afternoon.
              </p>
              <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-4 text-sm sm:grid-cols-4">
                <div><dt className="text-muted-foreground">Adults from</dt><dd className="mt-1 text-lg font-semibold tabular-nums">£14.50</dd></div>
                <div><dt className="text-muted-foreground">Open today</dt><dd className="mt-1 text-lg font-semibold">10–17</dd></div>
                <div><dt className="text-muted-foreground">Allow</dt><dd className="mt-1 text-lg font-semibold">4–5 hrs</dd></div>
                <div><dt className="text-muted-foreground">Parking</dt><dd className="mt-1 text-lg font-semibold">Free</dd></div>
              </dl>
              <div className="mt-7 flex flex-wrap gap-3">
                <a className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" href="#prices">Book and save £2 a head</a>
                <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="/visit">Plan the day</a>
              </div>
            </div>
            {/* WHAT HAPPENS WHEN, in the first screen. A visitor plans around
                the fixed-time events and nothing else on an attraction's site
                ever tells them what those are until they arrive. */}
            <ServiceTimes meetings={TIMETABLE} heading="Today, and every day" />
          </div>
        </div>
      </section>

      <section id="prices" className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="Prices" title="And what a family ticket actually saves"
          description="Computed against buying the same tickets separately, so it cannot flatter itself. Booking ahead is £2 a head cheaper and there is no booking fee." />
        <div className="mt-8 max-w-3xl">
          <AdmissionPrices tickets={TICKETS} family={FAMILY} caption="Day admission"
            note="A ticket is valid all day and you can come and go. Annual passes are on the visit page and pay for themselves in three visits." />
        </div>
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <SectionHeader eyebrow="How long to allow" title="Four to five hours, honestly"
            description="Two hours is not enough and people who allow it leave annoyed. Here is roughly where the time goes." />
          <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["The farm and the paddocks", "About an hour. Goats, alpacas, pigs and the shire horses, all of which can be fed."],
              ["The wildlife side", "Ninety minutes if you catch two talks. Otters, beavers, lynx, and the raptor lawn."],
              ["The railway", "Twenty minutes for the round trip, plus whatever the wait is. It runs every 45 minutes."],
              ["The wood and the play area", "As long as you let it. Most families lose an hour here and it is the bit children remember."],
            ].map(([k, v]) => (
              <div key={k} className="border-t border-border pt-4">
                <p className="font-medium">{k}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{v}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Arriving after two is a shortened day and we will tell you so at the gate rather than
            take the full price — a half-day ticket after 14:30 is £9 for anybody.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="The place" title="Ninety acres of it" />
        <Gallery className="mt-8" columns={4} items={[
          { src: null, alt: "The shire horses" },
          { src: null, alt: "Otters at feeding time" },
          { src: null, alt: "The steam locomotive at the halt" },
          { src: null, alt: "The raptor lawn" },
          { src: null, alt: "The paddocks in spring" },
          { src: null, alt: "The wood and the boardwalk" },
          { src: null, alt: "The play barn" },
          { src: null, alt: "The tea room" },
        ]} />
      </section>

      <section className="border-t border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr]">
            <div>
              <SectionHeader eyebrow="When" title="Open every day but one" />
              <OpeningHours className="mt-6" days={[
                { day: 1, label: "Monday", open: "10:00", close: "17:00" },
                { day: 2, label: "Tuesday", open: "10:00", close: "17:00" },
                { day: 3, label: "Wednesday", open: "10:00", close: "17:00" },
                { day: 4, label: "Thursday", open: "10:00", close: "17:00" },
                { day: 5, label: "Friday", open: "10:00", close: "17:00" },
                { day: 6, label: "Saturday", open: "10:00", close: "17:30" },
                { day: 0, label: "Sunday", open: "10:00", close: "17:30" },
              ]} />
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                Last admission is 90 minutes before closing, and closing means the gate — the
                animals go in about half an hour before that. November to February we shut at 16:00
                and the railway does not run.
              </p>
              <LocationCard className="mt-6" name="Wharncliffe Farm & Wildlife Park"
                address="Woodhead Road, Wharncliffe Side, Sheffield, S35 0DP"
                note="Free parking for 400 cars. The 57 stops at the end of the lane, a ten-minute walk. Level or ramped throughout except the wood boardwalk." />
            </div>
            <div>
              <SectionHeader eyebrow="Asked often" title="Before you set off" />
              <Faq className="mt-6" items={[
                { question: "Is the family ticket always cheaper?", answer: "For two adults and two children, yes, by £5. For two adults and ONE child it is not — buy those separately and you save £4.50. The table above works it out rather than claiming it." },
                { question: "Can we bring a picnic?", answer: "Yes, and there are tables in three places. The tea room does not mind and never has." },
                { question: "Dogs?", answer: "On a lead, in the wood, the car park and the tea room garden — not in the farm or the wildlife areas, which is a licence condition rather than a preference. Assistance dogs everywhere." },
                { question: "What if it rains?", answer: "The play barn, the reptile house and the tea room are all indoors, which is about ninety minutes' worth. We will not pretend a wet day here is as good as a dry one." },
                { question: "Is it pushchair-friendly?", answer: "Everywhere except the wood boardwalk, which has steps at the far end. There is a flat route round it, signed." },
                { question: "Do the displays always happen?", answer: "The falconry does not fly in high wind or heavy rain — that is the bird's welfare and it is not negotiable. Everything else runs whatever the weather." },
              ]} />
            </div>
          </div>
        </div>
      </section>
    </SiteChrome>
  );
}
