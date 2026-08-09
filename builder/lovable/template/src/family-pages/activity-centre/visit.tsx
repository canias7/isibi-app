// activity-centre /visit — prices, parking, and THE ACCESSIBILITY ANSWER,
// given honestly rather than reassuringly.
//
// An outdoor centre on a hillside cannot be fully accessible and saying "we
// welcome everybody" is not an answer. Naming which activities work, which need
// a phone call and which genuinely do not, means somebody can decide before
// driving up rather than being disappointed in a car park.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { AdmissionPrices } from "@/components/ui/admission-prices";
import { OpeningHours } from "@/components/ui/opening-hours";
import { HouseRules } from "@/components/ui/house-rules";
import { Figure } from "@/components/ui/figure";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/visit")({ component: P });

const HOURS = [
  { day: 1, label: "Monday", open: null, close: null },
  { day: 2, label: "Tuesday", open: "09:00", close: "17:00" },
  { day: 3, label: "Wednesday", open: "09:00", close: "17:00" },
  { day: 4, label: "Thursday", open: "09:00", close: "17:00" },
  { day: 5, label: "Friday", open: "09:00", close: "17:00" },
  { day: 6, label: "Saturday", open: "08:30", close: "18:00" },
  { day: 0, label: "Sunday", open: "08:30", close: "17:00" },
];

const ACCESS = [
  { what: "The hut, cafe, toilets and changing", state: "Fully step-free", detail: "Accessible toilet with a hoist point, a Changing Places-standard bench, and a level path from the disabled bays." },
  { what: "Bushcraft and forest school", state: "Fully accessible", detail: "Compacted surfaced path all the way into the plantation. A wheelchair does it unassisted and several regulars do." },
  { what: "Kayaking and canoeing", state: "With a phone call first", detail: "A transfer at the pontoon and a supported seat. We do this most weeks and it works well; it needs two staff, so we need notice." },
  { what: "Open-water swimming", state: "With a phone call first", detail: "Steps and a handrail into the water, plus a hoist we can rig. Tell us and it is arranged." },
  { what: "Climbing and abseiling", state: "Honestly, no", detail: "The crag is up a rough path with a scramble at the top. There is no version of this that works and we are not going to imply otherwise." },
  { what: "High ropes", state: "No", detail: "A ladder start with no alternative. It is the one activity here we cannot adapt at all." },
];

function P() {
  return (
    <SiteChrome
      name="Damflask Outdoor"
      tagline="Getting here, what it costs, and the honest accessibility answer."
      links={[
        { label: "Today", href: "/" },
        { label: "Activities", href: "/activities" },
      ]}
      action={{ label: "Today's conditions", href: "/" }}
    >
      <div className="mx-auto max-w-5xl px-6 py-14">
        <h1 className="text-4xl font-semibold tracking-tight text-balance">Visiting</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Closed Mondays and from mid-December to the end of February. The lane up from Low
          Bradfield is single track with passing places — worth knowing before you set off with a
          car full of children.
        </p>

        <section className="mt-12">
          <div className="grid items-start gap-10 lg:grid-cols-[1.15fr_1fr]">
            <div>
              <SectionHeader
                eyebrow="Prices"
                title="Everything included, and cheaper in advance"
                description="Wetsuit, buoyancy aid, helmet, harness and instructor. There is no equipment line at any point."
              />
              <div className="mt-6">
                <AdmissionPrices
                  caption="A session is two hours. The advance price is for anything booked more than 24 hours ahead."
                  note="Spectators are free, always. There is a cafe, a lot of bench, and nobody has ever been charged to watch their family fall in a reservoir."
                  tickets={[
                    { name: "Adult session", price: 38, advance: 34 },
                    { name: "Under 16", price: 28, advance: 25 },
                    { name: "Under 8", price: 20, advance: 18, note: "Bushcraft and kayaking only" },
                    { name: "Second session, same day", price: 24 },
                    { name: "Open-water swim, unguided", price: 9, advance: 8 },
                    { name: "Spectator", price: 0, note: "Including the cafe and the toilets" },
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
              <SectionHeader eyebrow="When" title="Six days, and shut for winter" />
              <div className="mt-6">
                <OpeningHours days={HOURS} />
              </div>
              <p className="mt-5 max-w-lg text-sm leading-relaxed text-muted-foreground">
                Mid-December to the end of February the water is about 4°C and the wind at this
                reservoir is genuinely unpleasant. We would rather close than sell somebody an hour
                they will not enjoy.
              </p>
            </div>
          </div>
        </section>

        {/* THE ACCESSIBILITY ANSWER, ACTIVITY BY ACTIVITY. */}
        <section className="mt-14">
          <SectionHeader
            eyebrow="Accessibility"
            title="Six answers, and two of them are no"
            description="A centre on a hillside cannot be fully accessible, and 'we welcome everybody' is not an answer somebody can plan a day around."
          />
          <ul className="mt-8 divide-y divide-border border-y border-border">
            {ACCESS.map((a) => (
              <li key={a.what} className="grid gap-1 py-4 md:grid-cols-[minmax(0,17rem)_minmax(0,11rem)_1fr] md:gap-6">
                <p className="font-medium">{a.what}</p>
                <p className="text-sm font-medium">{a.state}</p>
                <p className="text-sm leading-relaxed text-muted-foreground">{a.detail}</p>
              </li>
            ))}
          </ul>
          {/* A PICTURE OF THE ACTUAL PATH, which is the one thing an access
              statement cannot do. "Step-free" is a claim; a photograph of the
              surface, the width and the gradient is something a wheelchair
              user can judge for themselves — and judging for themselves is the
              entire point of publishing this at all. */}
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <Figure
              src={null}
              ratio="16/9"
              alt="The compacted path into the plantation, taken at chair height"
              caption="The bushcraft path. 1.4m wide, compacted stone, no gradient over 1:20 — measured, not estimated."
            />
            <Figure
              src={null}
              ratio="16/9"
              alt="The pontoon transfer bench beside a kayak, hoist point above"
              caption="The kayak transfer. Two staff, a supported seat and a bench at boat height. We do this most weeks."
            />
          </div>
          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Ring 0114 285 3310 and ask for Ruth. She will tell you honestly what will work rather
            than what sounds welcoming, and she would far rather have that conversation than watch
            somebody arrive and be disappointed.
          </p>
        </section>

        <section className="mt-14">
          <SectionHeader
            eyebrow="Getting here and being here"
            title="The lane, the parking, and the dog rule"
            description="Single track for the last mile with four passing places. A satnav will try to send you via Mortimer Road — do not, it is a farm track."
          />
          <div className="mt-8 max-w-3xl">
            <HouseRules
              heading="Practical things"
              arrive="Twenty minutes before your session, at the hut by the top car park"
              leave="Showers open until half an hour after the last session"
              lateNote="More than fifteen minutes and the session has gone out. We put you on the next one free — we do not keep the money and send you home."
              rules={[
                { what: "Parking, forty spaces, free", detail: "Full on a hot Saturday between eleven and two. Two disabled bays by the hut and an overflow field that is signed when open." },
                { what: "No public transport", detail: "The 61 stops in Low Bradfield, a 45-minute uphill walk. It is a lovely walk and it is not one to do carrying a towel and a picnic." },
                { what: "Dogs on the site, not in the water", detail: "Anywhere on land on a lead, including the cafe. Not in the reservoir — it is a drinking water supply and that is Yorkshire Water's rule." },
                { what: "No swimming outside session times", detail: "It is a working reservoir with cold deep water and no lifeguard outside the buoyed course. People have died in it and we are not being fussy." },
                { what: "Cafe until four", detail: "Small, good, and it runs out of cake by two in the holidays. Bring something if you are here all day." },
                { what: "Phone signal is poor", detail: "Almost none in the plantation and patchy at the water. Arrange where to meet before you split up." },
              ]}
            />
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader title="Visiting questions" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "Can we just turn up?",
                  answer:
                    "For the unguided swim, yes. For anything instructed, book — sessions are capped at eight and Saturdays fill. Midweek in term time there is nearly always room.",
                },
                {
                  question: "What is the refund policy?",
                  answer:
                    "If we close an activity, full refund or a free rebooking, your choice, and we ring you. If you cancel, 48 hours for a full refund and inside that we will move it rather than keep it.",
                },
                {
                  question: "Is there anywhere to stay?",
                  answer:
                    "Not here. The campsite at Low Bradfield is ten minutes down the lane and there are two pubs with rooms in the village. We are not going to pretend we do accommodation.",
                },
                {
                  question: "Do you do birthday parties?",
                  answer:
                    "Two hours plus the room for another hour, from eight children, £24 a head. Bring your own food. It is the best value thing we sell and we do about forty a year.",
                },
              ]}
            />
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            <a className="underline underline-offset-4" href="/">Today's conditions</a>
            {" · "}
            <a className="underline underline-offset-4" href="/activities">Every activity and its limits</a>
          </p>
        </section>
      </div>
    </SiteChrome>
  );
}
