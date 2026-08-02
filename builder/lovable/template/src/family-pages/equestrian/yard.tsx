// equestrian /yard — the arena, the fields, the facilities including what is
// broken, and the eleven rules. A yard's rules living in somebody's head is the
// single most common complaint about small yards.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { AmenityList } from "@/components/ui/amenity-list";
import { Faq } from "@/components/ui/faq";
import { Gallery } from "@/components/ui/gallery";
import { HouseRules } from "@/components/ui/house-rules";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { SpecList, SpecRow } from "@/components/ui/spec-row";
export const Route = createFileRoute("/yard")({ component: P });
function P() {
  return (
    <SiteChrome name="Hollin Busk Livery" tagline="Twenty-two stables, forty acres, and an arena that drains. Above Deepcar."
      links={[{ label: "Home", href: "#/" }, { label: "Lessons", href: "#/lessons" }]}
      action={{ label: "Is there a space?", href: "#/#livery" }}>

      <div className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="The yard" title="The arena, the fields, and the eleven rules"
          description="Written down rather than living in somebody's head, which is the single most common complaint about small yards and the easiest one to fix." />

        <section className="mt-10 grid gap-12 lg:grid-cols-[1fr_1fr]">
          <div>
            <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">The arena</h2>
            <div className="mt-3">
              <SafeImage src={null} alt="The arena in November" ratio="4/3" />
            </div>
            <SpecList className="mt-6">
              <SpecRow label="Size" value="40m × 20m" note="Full dressage arena, marked" />
              <SpecRow label="Surface" value="Silica sand and fibre" note="Laid 2022, harrowed daily, topped up every spring" highlight />
              <SpecRow label="Drainage" value="Free-draining, on limestone" note="It has not been unusable in eleven years, including the 2023 winter" highlight />
              <SpecRow label="Floodlights" value="Yes, until 21:00" note="Four columns. Planning conditions stop them going later and that is not negotiable" />
              <SpecRow label="Jumps" value="Twelve fences, poles and blocks" note="Yours to use. Put them back and nobody minds anything else" />
              <SpecRow label="Booking" value="Not needed" note="Twenty-two horses and it is empty most of the time. Lessons are booked and shown on the board" />
              <SpecRow label="Horse walker" value="Five horse, covered" note="Free, and rota'd on the board when it is busy" />
              <SpecRow label="Wash box" value="One, with hot water" note="The hot water is the thing people notice in October" />
            </SpecList>
          </div>
          <div>
            <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">What else is here</h2>
            <AmenityList className="mt-3" amenities={[
              { id: "barn", what: "Hay and bedding barn", note: "Your own bay, dry, and big enough for a pallet of shavings" },
              { id: "tack", what: "Tack room, alarmed and locked", note: "Own locker each. Insurance-approved and we have the certificate for your insurer" },
              { id: "rug", what: "Heated rug room", note: "The most-used building on the yard between November and March" },
              { id: "solar", what: "Solarium", outOfOrder: true, backOn: "Late August", note: "Element failed in June, part on order from Germany and it has been on order a while" },
              { id: "walker", what: "Horse walker, five horse", note: "Covered. Free to use, rota on the board" },
              { id: "trailer", what: "Trailer and box parking", note: "Hard standing for eight, free, floodlit" },
              { id: "muck", what: "Muck heap, emptied fortnightly", note: "Included in every tier. Some yards charge for this separately" },
              { id: "toilet", what: "Toilet and a kettle", note: "In the barn. Sounds trivial until it is January" },
              { id: "iso", what: "Isolation box", bookable: true, note: "One, at the far end, for anything coming in from a sale or coming home from a hospital" },
            ]} />
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              The solarium is on this list because it is broken, not because it works. A facilities
              list that quietly drops something is how somebody moves a horse expecting it.
            </p>

            <h2 className="mt-8 text-sm font-medium uppercase tracking-widest text-muted-foreground">The fields</h2>
            <SpecList className="mt-3">
              <SpecRow label="Total grazing" value="40 acres" note="Nine paddocks, rotated" />
              <SpecRow label="Horses per acre" value="Under 1" note="Twenty-two horses. Ask every yard this number and most will not know it" highlight />
              <SpecRow label="Fencing" value="Post and rail, electric top" note="No barbed wire anywhere on the holding" />
              <SpecRow label="Water" value="Troughs, mains fed" note="Checked twice daily and heated in the two winter paddocks" />
              <SpecRow label="Shelters" value="In six of the nine" note="Field shelters, three sided" />
              <SpecRow label="Hacking" value="Straight onto the moor" note="About 11 miles of bridleway with no road work after the first 100 yards" highlight />
            </SpecList>
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="The rules" title="Eleven, and two of them are enforced"
            description="Marked as such. A yard that prints every preference as an absolute gets all of them treated as preferences, which is how a rule that actually matters gets ignored." />
          <div className="mt-8 max-w-3xl">
            <HouseRules heading="On the yard"
              arrive="07:00 – 21:00" leave="Gate locked at 21:30"
              lateNote="A late vet, a colic or a show that overran — ring and the gate stays open. The lock is about the trailer park rather than about you, and nobody has ever been shut out."
              rules={[
                { what: "Hat and boots in the arena, always", firm: true, detail: "Including lunging, including in-hand, including 'just for a minute'. It is our insurance and it is the one thing that will get somebody asked to leave." },
                { what: "Nobody rides alone without telling somebody", firm: true, detail: "A note on the board or a text. Eleven miles of moor and no phone signal for most of it — this rule exists because of one afternoon in 2019." },
                { what: "Put the jumps back", firm: false, detail: "Where you found them, roughly. Nobody has ever fallen out over this and it would be a shame to start." },
                { what: "Muck out by ten", firm: false, detail: "So the yard is done before the lessons start. DIY only — the other tiers are done by us before eight." },
                { what: "Dogs on leads, and not in the arena", firm: false, detail: "Plenty of dogs here and they are welcome. Loose ones near the fields are the problem, not the dogs themselves." },
                { what: "Worm counts four times a year", firm: true, detail: "Results to the yard. This is how twenty-two horses share nine paddocks without a wormer resistance problem, and it is not optional." },
                { what: "Tell us before anything new arrives", firm: false, detail: "So it can go in the isolation box for a fortnight if it has come from a sale or a hospital." },
                { what: "Turn the arena lights off", firm: false, detail: "They cost about £4 an hour and nobody minds you using them. They are on a timer as a backstop and it is set to 21:00." },
                { what: "Children under 12 with an adult", firm: false, detail: "Not a supervision requirement, a common-sense one. Older than that, use your judgement." },
                { what: "Own farrier and vet, always", firm: false, detail: "Never been a rule here and never will be. Some yards insist and it is worth asking every one." },
                { what: "One month's notice, either way", firm: false, detail: "In writing or by text, and no deposit is held against it. If you are unhappy we would rather know at the time." },
              ]} />
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="The place" title="Forty acres of a Yorkshire hillside" />
          <Gallery className="mt-8" columns={4} items={[
            { src: null, alt: "The yard from the gate" },
            { src: null, alt: "A stable, 12ft by 12ft" },
            { src: null, alt: "The arena under lights" },
            { src: null, alt: "The horse walker" },
            { src: null, alt: "Turnout in the top paddocks" },
            { src: null, alt: "The hay barn" },
            { src: null, alt: "The rug room in January" },
            { src: null, alt: "The bridleway onto the moor" },
          ]} />
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="max-w-3xl">
            <SectionHeader eyebrow="Asked often" title="About the yard" />
            <Faq className="mt-6" items={[
              { question: "Does the arena flood?", answer: "No, and that is the reason to come here rather than the pretty photographs. It is on limestone with a proper base and it has not been unusable in eleven years, including the 2023 winter when three yards nearby lost theirs for a month." },
              { question: "Can I have my own paddock?", answer: "Individual turnout in two of the nine paddocks, at no extra charge, for anything that needs it. A whole paddock to one horse is not something we can do at this size and we would rather say so than string somebody along." },
              { question: "Is there anywhere to keep a lorry?", answer: "Eight hard-standing spaces, free, floodlit, and the lane takes a 7.5t as far as the gate. Nothing has ever been interfered with, which is partly the lights and mostly the fact it is up a dead-end lane." },
              { question: "What happens if my horse is on box rest?", answer: "Full livery covers holding, poulticing and basic nursing. Anything intensive is £30 a day on top, which sounds a lot until you have done four weeks of it — it genuinely is a full-time job." },
              { question: "Is it a competition yard or a happy hacker yard?", answer: "Both, and that has never caused a problem. About six people compete regularly, most hack, and two have never left the arena. Nobody here is sniffy about any of it." },
              { question: "When will the solarium be fixed?", answer: "Late August, we hope. The element failed in June and the part is coming from Germany. It has been on this page as broken since the day it broke and it will come off the day it works." },
            ]} />
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
