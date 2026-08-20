// pet-boarding — DATES-AND-REQUIREMENTS-FIRST: the calendar, the nightly rate
// by size, and the vaccination deadline, all in the first screen. A kennel
// cough jab needed fourteen days ahead is useless found the night before, so
// the requirements lead rather than trail.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { AvailabilityCalendar } from "@/components/ui/availability-calendar";
import { EntryRequirements } from "@/components/ui/entry-requirements";
import { Faq } from "@/components/ui/faq";
import { LocationCard } from "@/components/ui/location-card";
import { OpeningHours } from "@/components/ui/opening-hours";
import { RateCard } from "@/components/ui/rate-card";
import { SectionHeader } from "@/components/ui/section-header";
export const Route = createFileRoute("/")({ component: P });
export const NIGHTS = [
  { date: "2026-08-01", rate: 26 }, { date: "2026-08-02", rate: 26 },
  { date: "2026-08-03", rate: 24 }, { date: "2026-08-04", rate: 24 },
  { date: "2026-08-05", rate: 24 }, { date: "2026-08-06", rate: 24 },
  { date: "2026-08-07", rate: 26 }, { date: "2026-08-08", taken: true },
  { date: "2026-08-09", taken: true }, { date: "2026-08-10", taken: true },
  { date: "2026-08-11", taken: true }, { date: "2026-08-12", taken: true },
  { date: "2026-08-13", taken: true }, { date: "2026-08-14", taken: true },
  { date: "2026-08-15", taken: true }, { date: "2026-08-16", taken: true },
  { date: "2026-08-17", rate: 24 }, { date: "2026-08-18", rate: 24 },
  { date: "2026-08-19", rate: 24 }, { date: "2026-08-20", rate: 24 },
  { date: "2026-08-21", rate: 26, minNights: 2 }, { date: "2026-08-22", rate: 26, minNights: 2 },
  { date: "2026-08-23", rate: 26 }, { date: "2026-08-24", rate: 24 },
  { date: "2026-08-25", rate: 24 }, { date: "2026-08-26", rate: 24 },
  { date: "2026-08-27", rate: 24 }, { date: "2026-08-28", rate: 30, minNights: 3 },
  { date: "2026-08-29", rate: 30, minNights: 3 }, { date: "2026-08-30", rate: 30 },
  { date: "2026-08-31", rate: 30 },
];
export const RULES = [
  {
    what: "Kennel cough vaccination",
    by: "At least 14 days before arrival",
    legal: true,
    detail: "It is the intranasal one and it takes a fortnight to be any use. This is the single most common reason a dog gets turned away at the gate, and it is the one nobody plans for.",
  },
  {
    what: "DHP booster up to date",
    by: "More than 14 days and less than 12 months old",
    legal: true,
    detail: "Distemper, hepatitis, parvovirus. Bring the card or ask your vet to email us — a photograph of the card is fine.",
  },
  {
    what: "Flea and worm treatment",
    by: "Within 30 days of arrival",
    legal: false,
    detail: "Any of the usual ones. We will ask which and when, not for a receipt.",
  },
  {
    what: "Neutering, over 8 months",
    by: "Before the first stay",
    legal: false,
    detail: "House rule, not the law. Entire dogs of either sex go in the quiet block and cannot use the group paddock, which is a poorer holiday for them.",
  },
  {
    what: "Emergency contact who is actually in the country",
    by: "At booking",
    legal: false,
    detail: "Somebody who can collect. Your own mobile abroad is not one, and the week we needed it we could not reach anybody for eleven hours.",
  },
  {
    what: "Your vet's name and number",
    by: "At booking",
    legal: true,
    detail: "Licence condition. We also need written consent for our vet to treat in an emergency if yours cannot be reached.",
  },
];
function P() {
  return (
    <SiteChrome name="Ewden Lane Kennels & Cattery" tagline="Licensed boarding for 24 dogs and 18 cats, in the Don valley."
      links={[{ label: "Where they stay", href: "/stay" }, { label: "Book", href: "/book" }, { label: "Find us", href: "#find-us" }]}
      action={{ label: "Check dates", href: "/book" }}>

      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid items-start gap-12 lg:grid-cols-[1fr_1.1fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Licence SHEF/AB/2019/114 · rated 5 stars · 24 dogs, 18 cats</p>
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">
                Book the dates, then check the jabs
              </h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                In that order, and start now rather than the week before. The kennel cough
                vaccination has to be more than a fortnight old on the day you arrive, and it is
                the one thing we cannot make an exception for.
              </p>
              <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-4 text-sm sm:grid-cols-3">
                <div><dt className="text-muted-foreground">From</dt><dd className="mt-1 text-lg font-semibold tabular-nums">£24 a night</dd></div>
                <div><dt className="text-muted-foreground">Second dog</dt><dd className="mt-1 text-lg font-semibold tabular-nums">£16</dd></div>
                <div><dt className="text-muted-foreground">Cats</dt><dd className="mt-1 text-lg font-semibold tabular-nums">£15</dd></div>
              </dl>
              <div className="mt-7 flex flex-wrap gap-3">
                <a className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" href="/book">Check my dates</a>
                <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="/stay">See where they stay</a>
              </div>
            </div>
            {/* THE DEADLINE IN THE FIRST SCREEN. Every kennel puts this behind a
                "policies" link in the footer, which is how a family arrives at
                seven in the morning with a booked holiday and a dog that cannot
                be admitted. */}
            <EntryRequirements requirements={RULES.slice(0, 3)}
              heading="Before they can come"
              intro="Three of these have a lead time. Read them now, not in July." />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="Free nights" title="August, as it stands this morning"
          description="Struck through is full. The August bank holiday and the middle fortnight go by about March, and nothing we can do releases more space." />
        <div className="mt-8 grid gap-10 lg:grid-cols-[1.1fr_1fr]">
          <AvailabilityCalendar nights={NIGHTS} month="2026-08" now={new Date(2026, 7, 2)}
            priceNote="The price on each night is for one medium dog — the table beside this has the rest." />
          <div>
            <h3 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">What a night costs</h3>
            <RateCard className="mt-3" label="Who is staying" unit="night" bands={["Small", "Medium", "Large"]} rates={[
              { period: "One dog", units: 1, price: 24, more: [26, 30] },
              { period: "Two dogs sharing", units: 1, price: 40, more: [44, 50], note: "Same household only, and they must already live together" },
              { period: "Three dogs sharing", units: 1, price: 54, more: [60, 68] },
              { period: "One cat", units: 1, price: 15, more: [15, 15], note: "Cats are one price — the pens are all the same size" },
              { period: "Two cats sharing", units: 1, price: 25, more: [25, 25] },
            ]} note="Small is up to 10kg, medium to 25kg, large above. A night is a night — arriving at eight in the morning and leaving at six is one night, not two." />
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Peak weeks — Christmas, Easter, and the school summer holidays — are £6 a night more
              and have a three-night minimum. That is on the calendar rather than in a footnote, so
              you can see which nights it applies to before you plan around them.
            </p>
          </div>
        </div>
      </section>

      <section id="find-us" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr]">
            <div>
              <SectionHeader eyebrow="Dropping off" title="Not whenever you like, and here is why" />
              <OpeningHours className="mt-6" days={[
                { day: 1, label: "Monday", open: "08:00", close: "10:30" },
                { day: 2, label: "Tuesday", open: "08:00", close: "10:30" },
                { day: 3, label: "Wednesday", open: "08:00", close: "10:30" },
                { day: 4, label: "Thursday", open: "08:00", close: "10:30" },
                { day: 5, label: "Friday", open: "08:00", close: "10:30" },
                { day: 6, label: "Saturday", open: "08:00", close: "11:00" },
                { day: 0, label: "Sunday", open: null, close: null },
              ]} />
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                Also 16:00–18:00 every day except Sunday. The gap in the middle is when the dogs are
                out and settled — a new arrival at one o'clock unsettles twenty of them, so we do
                not do it, and no amount of asking will change it.
              </p>
              <LocationCard className="mt-6" name="Ewden Lane Kennels & Cattery"
                address="Ewden Lane, Bolsterstone, Sheffield, S36 4ZH"
                note="Half a mile past the church, second gate on the left. The lane is single-track with passing places and there is turning space in the yard." />
            </div>
            <div>
              <SectionHeader eyebrow="Asked often" title="The questions we get every week" />
              <Faq className="mt-6" items={[
                { question: "Can we visit before booking?", answer: "Yes, and you should. Any afternoon between two and four, no appointment. Any kennel that will not show you round is telling you something." },
                { question: "What if my dog will not eat?", answer: "Very common in the first day and a half. We weigh on arrival and departure, we feed your own food, and we ring you if a dog has eaten nothing by the second evening." },
                { question: "Do you take unneutered dogs?", answer: "Over eight months, only in the quiet block, and not in the group paddock. It is a poorer holiday for them and we would rather say so than take the booking quietly." },
                { question: "What about medication?", answer: "Yes, at no extra cost, including injections. Bring it in its original box with the label — we will not give anything out of a plastic bag with a note." },
                { question: "Can I ring while I am away?", answer: "Any day after ten in the morning. We will not send daily photographs and we will not pretend we can — twenty-four dogs is a full day's work." },
                { question: "What happens if my flight is delayed?", answer: "We keep them, we do not charge a penalty, and you pay the extra night when you collect. It happens about six times a summer." },
              ]} />
            </div>
          </div>
        </div>
      </section>
    </SiteChrome>
  );
}
