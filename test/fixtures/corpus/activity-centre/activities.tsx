// activity-centre /activities — each activity with its REAL age, weight and
// ability limits.
//
// A WEIGHT LIMIT DISCOVERED AT THE HARNESS IS A HUMILIATION. Every high-ropes
// course has one — it is a rating on the equipment, not a judgement — and
// almost no centre publishes it, so somebody finds out in front of their
// family. Printing it is the single kindest thing on a page like this.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { SessionTable } from "@/components/ui/session-table";
import { HouseRules } from "@/components/ui/house-rules";
import { MediaGrid } from "@/components/ui/media-grid";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/activities")({ component: P });

const LIMITS = [
  { what: "Kayaking and canoeing", age: "8 and over", weight: "No limit", ability: "None. A buoyancy aid does the work and the sheltered end is waist-deep.", note: "The best first activity here and what most families end up doing twice." },
  { what: "Open-water swimming", age: "16 and over, or 12 with an adult in the water", weight: "No limit", ability: "Must be able to swim 100m unaided in open water. We will ask and we do check.", note: "Buoyed 400m course, lifeguarded, 18°C in August and 9°C in April." },
  { what: "Climbing and abseiling", age: "8 and over", weight: "35kg to 120kg", ability: "None. Every route has an easy line and nobody is made to go higher than they want.", note: "The weight range is the harness rating. It is equipment, not a judgement, and it is printed so nobody finds out at the crag." },
  { what: "High ropes", age: "10 and over, and 1.4m tall", weight: "35kg to 120kg", ability: "None, but it is genuinely high and about one person in ten stops part-way. That is fine and there is a route down.", note: "Closed above 25mph wind, which is roughly forty days a year." },
  { what: "Paddleboarding", age: "10 and over", weight: "Up to 110kg per board", ability: "Comfortable falling in. Everybody does, repeatedly, and that is most of the fun.", note: "Closed above about 18mph — it stops being enjoyable well before it stops being safe." },
  { what: "Bushcraft and forest school", age: "4 and over", weight: "No limit", ability: "None at all. Fully accessible and it runs in any weather.", note: "In the plantation, sheltered, and the only thing here that never closes for wind." },
];

function P() {
  return (
    <SiteChrome
      name="Damflask Outdoor"
      tagline="Six activities, with the age, weight and ability limits printed."
      links={[
        { label: "Today", href: "/" },
        { label: "Visiting", href: "/visit" },
      ]}
      action={{ label: "Today's conditions", href: "/" }}
    >
      <div className="mx-auto max-w-5xl px-6 py-14">
        <h1 className="text-4xl font-semibold tracking-tight text-balance">Activities</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Every limit is printed, including the weight ones. They are ratings on the harness rather
          than judgements about anybody, and finding one out at the crag in front of your family is
          a rotten way to spend a morning.
        </p>

        <section className="mt-12">
          <SectionHeader eyebrow="The six" title="And who each one is genuinely for" />
          {/* The caption carries the LIMIT, not a mood. A picture of the crag
              beside "35-120kg, harness rating" is the same fact in two
              registers, and the second is the one somebody remembers on the
              drive up. */}
          <div className="mt-8">
            <MediaGrid
              columns={3}
              ratio="4/3"
              items={[
                { src: null, alt: "Two boats at the sheltered end, an instructor waist-deep beside them", caption: "Kayaking · 8+, no weight limit" },
                { src: null, alt: "The buoyed course at first light, one swimmer, marker buoy in the foreground", caption: "Open water · 16+, or 12 with an adult in" },
                { src: null, alt: "The crag from below — the easy line on the left, chalked", caption: "Climbing · 8+, 35-120kg harness rating" },
                { src: null, alt: "The high ropes platform in the trees, ladder start visible", caption: "High ropes · 10+ and 1.4m, shut above 25mph" },
                { src: null, alt: "Three boards on flat water, nobody upright", caption: "Paddleboarding · 10+, 110kg a board" },
                { src: null, alt: "A fire lit in the plantation, kettle over it, tarps behind", caption: "Bushcraft · 4+, fully accessible" },
              ]}
            />
          </div>
          <ul className="mt-8 divide-y divide-border border-y border-border">
            {LIMITS.map((l) => (
              <li key={l.what} className="py-5">
                <p className="font-medium">{l.what}</p>
                <dl className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div>
                    <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Age</dt>
                    <dd className="mt-0.5 text-sm">{l.age}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Weight</dt>
                    <dd className="mt-0.5 text-sm">{l.weight}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Ability</dt>
                    <dd className="mt-0.5 text-sm">{l.ability}</dd>
                  </div>
                </dl>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">{l.note}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-14">
          <SectionHeader
            eyebrow="The week"
            title="What runs when, and where the spaces are"
            description="Sessions are two hours. Weekday mornings are school groups in term time and are almost empty in the holidays."
          />
          <div className="mt-8">
            <SessionTable
              fundedLabel="Included in the session price"
              days={[
                {
                  day: "Tuesday to Friday",
                  sessions: [
                    { name: "Kayaking", from: "10:00", to: "12:00", placesLeft: 6, funded: true },
                    { name: "Climbing and abseiling", from: "10:00", to: "12:00", placesLeft: 0, funded: true, note: "School groups in term time. Free from 14:00." },
                    { name: "Bushcraft", from: "13:00", to: "15:00", placesLeft: 8, funded: true },
                    { name: "High ropes", from: "14:00", to: "16:00", placesLeft: 4, funded: true, note: "Wind dependent — check the front page before travelling." },
                  ],
                },
                {
                  day: "Saturday",
                  sessions: [
                    { name: "Open-water swim, unguided course", from: "08:30", to: "10:00", placesLeft: null, funded: true, note: "No booking. Turn up, sign in, swim." },
                    { name: "Kayaking", from: "10:00", to: "12:00", placesLeft: 2, funded: true },
                    { name: "Paddleboarding", from: "12:30", to: "14:30", placesLeft: 5, funded: true },
                    { name: "Climbing and abseiling", from: "15:00", to: "17:00", placesLeft: 3, funded: true },
                  ],
                },
                {
                  day: "Sunday",
                  sessions: [
                    { name: "Family kayaking, ages 8+", from: "10:00", to: "12:00", placesLeft: 4, funded: true },
                    { name: "Bushcraft, ages 4+", from: "10:00", to: "12:00", placesLeft: 6, funded: true },
                    { name: "High ropes", from: "13:30", to: "15:30", placesLeft: 0, funded: true, note: "Full. There is usually a cancellation — ring on the morning." },
                  ],
                },
              ]}
            />
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader
            eyebrow="What to bring"
            title="Less than people think"
            description="Wetsuit, buoyancy aid, helmet and harness are all included and always have been. Arriving to find the kit is extra is a mean way to run a centre."
          />
          <div className="mt-8 max-w-3xl">
            <HouseRules
              heading="On the day"
              arrive="Twenty minutes before your session, at the hut by the top car park"
              leave="Showers are open until half an hour after the last session"
              lateNote="More than fifteen minutes late and the session has usually gone out. We will put you on the next one free rather than keeping your money."
              rules={[
                { what: "Old trainers you do not mind soaking", detail: "The one thing people forget. Bare feet are not allowed on the water and flip-flops come off within a minute." },
                { what: "A towel and a full change of clothes", detail: "Including underwear. Everybody who thinks they will stay dry does not." },
                { what: "A drink and something to eat", detail: "There is a cafe, and it is small and shuts at four. Do not rely on it in the holidays." },
                { what: "Sun cream, even in cloud", detail: "Water reflects and this is an exposed reservoir. It is where people get caught out." },
                { what: "Nothing else at all", detail: "Wetsuits to a 5XL, buoyancy aids, helmets and harnesses are all provided and included in the price." },
                { what: "Tell us about anything medical", detail: "Asthma, epilepsy, a heart condition, anxiety about water or heights. It changes how we run the session and it never stops anybody taking part." },
              ]}
            />
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader title="Activity questions" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "My child is nine and desperate to do the high ropes.",
                  answer:
                    "Ten and 1.4m, and it is the harness rating rather than a rule we invented. Climbing and abseiling takes them from eight and is genuinely more fun for that age anyway.",
                },
                {
                  question: "Are the instructors qualified?",
                  answer:
                    "British Canoeing, Mountain Training and RLSS as relevant, and the centre holds an AALA licence — which is a real inspection rather than a badge. Certificates are on the wall in the hut.",
                },
                {
                  question: "Can a wheelchair user take part?",
                  answer:
                    "Bushcraft fully. Kayaking with a transfer and a supported seat, which we do regularly and which needs a phone call first. Climbing and high ropes, honestly, no — and we would rather say it than have somebody arrive hopeful.",
                },
                {
                  question: "Is it cold?",
                  answer:
                    "The water is 18°C in August, 13°C in May and 9°C in April. Wetsuits are included and are 5mm. Nobody has ever been too cold in August and plenty of people have been in April.",
                },
              ]}
            />
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            <a className="underline underline-offset-4" href="/">Today's conditions</a>
            {" · "}
            <a className="underline underline-offset-4" href="/visit">Getting here</a>
          </p>
        </section>
      </div>
    </SiteChrome>
  );
}
