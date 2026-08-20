// campsite — WILL-IT-FIT-FIRST: the pitch types with their size and what they
// take, before anything about the valley. A family in a 7.5m motorhome is
// asking one question and every campsite site answers "we are in a lovely
// valley".
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { AmenityList } from "@/components/ui/amenity-list";
import { Faq } from "@/components/ui/faq";
import { HouseRules } from "@/components/ui/house-rules";
import { LocationCard } from "@/components/ui/location-card";
import { PitchTypes } from "@/components/ui/pitch-types";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
export const Route = createFileRoute("/")({ component: P });
export const PITCHES = [
  {
    name: "Hardstanding, electric", price: 32, size: "12m × 9m", maxLength: 9, count: 14,
    takes: ["caravan", "motorhome", "campervan"], electric: true, hardstanding: true,
    note: "Gravel, level to within 2°, and the only pitches worth having in February. Awning space to the side, not the front.",
  },
  {
    name: "Grass, electric", price: 27, size: "11m × 8m", maxLength: 8, count: 22,
    takes: ["tent", "caravan", "motorhome", "campervan"], electric: true, hardstanding: false,
    note: "The main field. Drains well but it is still grass — after a wet week we will tell you rather than let you get stuck.",
  },
  {
    name: "Grass, no electric", price: 21, size: "11m × 8m", maxLength: 8, count: 18,
    takes: ["tent", "campervan"], electric: false, hardstanding: false,
    note: "Bottom field, nearest the river and furthest from the shower block — about 90 seconds' walk.",
  },
  {
    name: "Small tent pitch", price: 15, size: "6m × 6m", maxLength: null, count: 12,
    takes: ["tent"], electric: false, hardstanding: false,
    note: "Backpacker and cyclist pitches along the hedge. No vehicle on the pitch; park by the barn.",
  },
  {
    name: "Serviced hardstanding", price: 41, size: "14m × 9m", maxLength: 11, count: 4,
    takes: ["caravan", "motorhome"], electric: true, hardstanding: true,
    note: "Own water tap and grey waste drain on the pitch. These take an 11m unit and they are the only four that do.",
  },
];
export const RULES = [
  { what: "Quiet, and it is properly quiet", at: "22:30 – 07:30", firm: true, detail: "No generators, no music outside, no arriving. Two warnings and we ask people to leave, which happens about twice a year." },
  { what: "Dogs on a lead everywhere", firm: true, detail: "Two per pitch, £3 a night each. Not in the shower block or the play area. There are four acres of river meadow to walk them on." },
  { what: "One unit and one car per pitch", firm: true, detail: "A second car is £5 a night in the overflow. It is a licence condition on the spacing, not us being difficult." },
  { what: "Fires in a raised pit only, never on the grass", firm: true, detail: "Pits are £8 for the stay and the wood is £6 a net. Nothing directly on the grass — it takes two summers to recover." },
  { what: "Ball games in the top field", firm: false, detail: "Not between the pitches, where somebody's awning always comes off worst." },
  { what: "Let us know if you are bringing a gazebo", firm: false, detail: "It has to sit inside your own pitch and on a busy weekend that is tighter than people expect." },
];
function P() {
  return (
    <SiteChrome name="Ewden Beck Camping" tagline="Forty-eight pitches on the river, four miles above Stocksbridge."
      links={[{ label: "Book a pitch", href: "/book" }, { label: "The site", href: "/site" }, { label: "Find us", href: "#find-us" }]}
      action={{ label: "Book a pitch", href: "/book" }}>

      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid items-start gap-12 lg:grid-cols-[1fr_1.15fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Open March–October · 48 pitches · dogs welcome</p>
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">
                Will it fit?
              </h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                That is the question, so it is answered first — in metres, per pitch type, with
                whether there is electric and whether the ground is grass. The valley is lovely and
                it will still be lovely after you have worked out where the van goes.
              </p>
              <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-4 text-sm sm:grid-cols-3">
                <div><dt className="text-muted-foreground">From</dt><dd className="mt-1 text-lg font-semibold tabular-nums">£15 a night</dd></div>
                <div><dt className="text-muted-foreground">Longest unit</dt><dd className="mt-1 text-lg font-semibold tabular-nums">11m</dd></div>
                <div><dt className="text-muted-foreground">Gate locked</dt><dd className="mt-1 text-lg font-semibold tabular-nums">22:00</dd></div>
              </dl>
              <div className="mt-7 flex flex-wrap gap-3">
                <a className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" href="/book">Check free nights</a>
                <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="/site">See the facilities</a>
              </div>
            </div>
            {/* THE MEASUREMENTS, above everything. Nobody has ever booked a
                campsite because of a photograph of a sunset. */}
            <PitchTypes pitches={PITCHES}
              note="Prices are per pitch per night for two adults. Extra adult £6, child £4, under-5s free. A pitch is yours from 13:00 and until 11:00." />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <SectionHeader eyebrow="The gate" title="Locked at ten, and we mean it"
              description="It is the single thing that catches people out, so it is here rather than in a terms page nobody opens." />
            <HouseRules className="mt-8" rules={RULES}
              arrive="13:00 – 20:00" leave="11:00"
              lateNote="If you are going to be later than eight, ring before you set off and we will leave the barrier code on the answerphone. Arriving after ten with no code means a night in a lay-by, and we would much rather give you the number." />
          </div>
          <div>
            <SafeImage src={null} alt="The main field from the top gate" ratio="4/3" />
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              The top field is the hardstandings, the middle field is grass with electric, and the
              bottom field runs down to the beck. It is a working hillside — nothing here is flat
              because somebody rolled it, and the pitches that are level are the fourteen that say so.
            </p>
          </div>
        </div>
      </section>

      <section id="find-us" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr]">
            <div>
              <SectionHeader eyebrow="What is here" title="Enough, and no more than that" />
              <AmenityList className="mt-6" amenities={[
                { id: "showers", what: "Shower block — 6 showers, 4 basins", note: "Free, hot, and cleaned twice a day" },
                { id: "sinks", what: "Washing-up sinks, covered" },
                { id: "chem", what: "Chemical disposal point" },
                { id: "water", what: "Drinking water taps ×4" },
                { id: "laundry", what: "Laundry — washer and dryer", outOfOrder: true, backOn: "Thursday", note: "Dryer element failed 28 July, part on order" },
                { id: "shop", what: "Small shop — milk, bread, gas, wood", note: "08:00–10:00 and 17:00–19:00" },
                { id: "wifi", what: "Wifi at the barn", note: "Nowhere else on site. The signal in the valley is one bar of EE and nothing else" },
                { id: "play", what: "Play area" },
                { id: "firepit", what: "Fire pits to hire", bookable: true, note: "£8 for the stay, wood £6 a net" },
              ]} />
            </div>
            <div>
              <LocationCard name="Ewden Beck Camping"
                address="Ewden Village, Stocksbridge, Sheffield, S36 4ZG"
                note="Off the A616 at Midhopestones, then two miles down. The lane is single-track with passing places for the last half mile and it is fine for a 10m outfit taken slowly — but not at night." />
              <Faq className="mt-8" items={[
                { question: "Will my 8m motorhome fit?", answer: "On the grass electric pitches and the hardstandings, yes. On the serviced four, comfortably — those take 11m. The small tent pitches take nothing on wheels." },
                { question: "Is the site level?", answer: "The hardstandings are, to within about two degrees. The grass fields have a fall of maybe one in twenty; most people need a couple of ramps and everybody who has been before brings them." },
                { question: "Do you take one night?", answer: "Yes, except bank holidays and the last two weekends of August, which are two nights minimum. There is no premium for a single night." },
                { question: "Can we have a fire?", answer: "In a raised pit, which we hire for £8. Not on the grass — it takes two summers to recover and you can still see where somebody did it in 2024." },
                { question: "Is there phone signal?", answer: "One bar of EE at the top field and nothing anywhere else. There is wifi at the barn and a payphone that still works, which we keep for exactly this reason." },
                { question: "What about arriving on a Sunday evening?", answer: "Fine until eight. After that ring first — the barrier is locked at ten every night of the year and there is no way in without the code." },
              ]} />
            </div>
          </div>
        </div>
      </section>
    </SiteChrome>
  );
}
