// activity-centre — CONDITIONS-AND-TICKETS-FIRST. What is running today, above
// any photograph of somebody abseiling.
//
// "SUBJECT TO CONDITIONS" IS NOT INFORMATION. It is a phrase that transfers the
// risk of a wasted journey onto the customer, and outdoor centres use it
// constantly. A closed activity says which, why, and when it reopens — a family
// driving forty minutes deserves to know before they set off, not on arrival.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { FacilityStatus } from "@/components/ui/facility-status";
import { AdmissionPrices } from "@/components/ui/admission-prices";
import { OpeningHours } from "@/components/ui/opening-hours";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/")({ component: P });

const HOURS = [
  { day: 1, label: "Monday", open: null, close: null },
  { day: 2, label: "Tuesday", open: "09:00", close: "17:00" },
  { day: 3, label: "Wednesday", open: "09:00", close: "17:00" },
  { day: 4, label: "Thursday", open: "09:00", close: "17:00" },
  { day: 5, label: "Friday", open: "09:00", close: "17:00" },
  { day: 6, label: "Saturday", open: "08:30", close: "18:00" },
  { day: 0, label: "Sunday", open: "08:30", close: "17:00" },
];

function P() {
  return (
    <SiteChrome
      name="Damflask Outdoor"
      tagline="Water and rock at the reservoir, above Bradfield. AALA licensed."
      links={[
        { label: "Activities", href: "#/activities" },
        { label: "Visiting", href: "#/visit" },
        { label: "Questions", href: "#questions" },
      ]}
      action={{ label: "Today's conditions", href: "#today" }}
    >
      {/* CONDITIONS FIRST, FULL WIDTH. Before any photograph. */}
      <section className="border-b border-border bg-muted/30" id="today">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Thursday 6 August · Updated 08:40
          </p>
          <h1 className="mt-4 max-w-3xl text-5xl font-semibold leading-[1.04] tracking-tight text-balance">
            Four of six running today
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            The wind is 22mph gusting 31 from the west, which closes the high ropes and makes
            paddleboarding hard work. Everything else is fine and the water is 18°C, which is warm
            for here.
          </p>

          <div className="mt-10">
            <FacilityStatus
              heading="Right now"
              updated="08:40 today"
              activities={[
                { name: "Kayaking and canoeing", state: "free", detail: "Sheltered end of the reservoir. Ideal conditions.", nextFree: "10:00" },
                { name: "Open-water swimming", state: "free", detail: "18°C, buoyed course, lifeguarded. Wetsuit optional today.", nextFree: "Any time to 16:00" },
                { name: "Climbing and abseiling", state: "busy", detail: "Two school groups until 14:00.", nextFree: "14:15" },
                { name: "Bushcraft and forest school", state: "free", detail: "In the plantation, sheltered whatever the wind does.", nextFree: "13:00" },
                { name: "High ropes", state: "closed", reason: "Wind above 25mph at the platform. It reopens when the gusts drop below that, which the forecast says is about 16:00 today." },
                { name: "Paddleboarding", state: "closed", reason: "Wind. Technically possible and genuinely not enjoyable — we would rather close it than sell you a miserable hour." },
              ]}
            />
          </div>

          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Updated by a person at 08:40 and again at midday. If something closes after you have
            booked we ring you, and if you are already on the way we refund in full without being
            asked.
          </p>
        </div>
      </section>

      {/* THE PHOTOGRAPH SITS BELOW THE CONDITIONS, AND THAT ORDER IS THE WHOLE
          FAMILY. Every outdoor centre opens with a picture of somebody
          abseiling in sunshine, which is a photograph of a different day. Put
          underneath, with a time on it, the same picture stops being a mood and
          starts being evidence: this is what the water looked like at 08:40,
          taken by the person who wrote the sentence above it. */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="grid gap-px bg-border sm:grid-cols-3">
            <SafeImage src={null} alt="The buoyed swim course from the hut, 08:40 today — flat at the sheltered end" ratio="4/3" className="rounded-none" />
            <SafeImage src={null} alt="White caps across the open water, taken from the high ropes platform" ratio="4/3" className="rounded-none" />
            <SafeImage src={null} alt="The plantation, sheltered whatever the wind does — bushcraft runs in this" ratio="4/3" className="rounded-none" />
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Taken this morning by whoever opened up, and replaced every day. A photograph of a
            sunny Tuesday in June tells you nothing about whether to set off today.
          </p>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <div className="grid items-start gap-10 lg:grid-cols-[1.15fr_1fr]">
            <div>
              <SectionHeader
                eyebrow="What it costs"
                title="Per session, with everything included"
                description="Wetsuit, buoyancy aid, helmet and an instructor. There is no equipment hire line and there never has been — arriving to find the kit is extra is a mean way to run a centre."
              />
              <div className="mt-8">
                <AdmissionPrices
                  caption="A session is two hours with a qualified instructor. Groups are eight to one on the water and six to one on rock."
                  note="Under-8s cannot do the high ropes or open-water swimming — those are National Governing Body limits rather than ours and they are on the activities page for every activity."
                  tickets={[
                    { name: "Adult session", price: 38, advance: 34 },
                    { name: "Under 16", price: 28, advance: 25 },
                    { name: "Under 8", price: 20, advance: 18, note: "Bushcraft and kayaking only" },
                    { name: "Second session, same day", price: 24, note: "Any activity, any age" },
                    { name: "Open-water swim, no instructor", price: 9, advance: 8, note: "Lifeguarded, buoyed course, own kit" },
                  ]}
                  family={{
                    name: "Family of four",
                    price: 112,
                    advance: 100,
                    covers: [{ name: "Adult session", count: 2 }, { name: "Under 16", count: 2 }],
                  }}
                />
              </div>
            </div>
            <div>
              <SectionHeader eyebrow="When" title="Closed Mondays" />
              <div className="mt-6">
                <OpeningHours days={HOURS} />
              </div>
              <p className="mt-5 max-w-lg text-sm leading-relaxed text-muted-foreground">
                Closed from mid-December to the end of February. The water is about 4°C and the
                wind at that reservoir in January is not something anybody should pay for.
              </p>
              <a className="mt-6 inline-block rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" href="#/activities">
                Every activity and its limits
              </a>
            </div>
          </div>
        </div>
      </section>

      <section id="questions">
        <div className="mx-auto max-w-3xl px-6 py-14">
          <SectionHeader title="Before you drive up" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "What if the weather turns after we book?",
                  answer:
                    "We ring you the evening before or by 08:00 on the day. If you are already travelling, a full refund or a free rebooking, your choice, and we do not make anybody ask.",
                },
                {
                  question: "Do we need to be able to swim?",
                  answer:
                    "For open-water swimming, obviously. For kayaking and paddleboarding, no — everyone wears a buoyancy aid and being able to swim 25 metres is helpful rather than required. Tell us if somebody cannot.",
                },
                {
                  question: "Is it clean enough to swim in?",
                  answer:
                    "Tested fortnightly and results are posted at the hut. Yorkshire Water manage the reservoir and it has been consistently good. We close swimming after very heavy rain for 48 hours as a precaution.",
                },
                {
                  question: "Can somebody watch rather than take part?",
                  answer: "Free, always, and there is a cafe and a lot of bench. Nobody has ever been charged to sit and watch their family get wet.",
                },
              ]}
            />
          </div>
        </div>
      </section>
    </SiteChrome>
  );
}
