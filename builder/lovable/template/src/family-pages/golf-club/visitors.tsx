// golf-club /visitors — green fees, when, and the dress code in words somebody
// can act on.
//
// "SMART CASUAL AT ALL TIMES" TELLS NOBODY WHETHER JEANS ARE ALLOWED. The dress
// code is the single most common reason a visitor is embarrassed at a golf club
// and it is entirely preventable with six specific sentences. Vagueness here is
// not politeness; it is a trap with a blazer on.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { HouseRules } from "@/components/ui/house-rules";
import { AvailabilityGrid } from "@/components/ui/availability-grid";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/visitors")({ component: P });

const FEES = [
  { what: "Weekday, 18 holes", price: "£34", when: "Any time, Monday to Friday" },
  { what: "Weekend and bank holidays, 18 holes", price: "£42", when: "From 11:00 — the mornings are members' competitions" },
  { what: "Twilight, after 16:00", price: "£20", when: "Any day, April to September" },
  { what: "Winter, November to February", price: "£24", when: "Any day. Greens are on summer cut all year — it is moorland" },
  { what: "Nine holes", price: "£20", when: "Any day. Play 1 to 9 or 10 to 18, both loop past the clubhouse" },
  { what: "Society, 12 or more", price: "£30 each", when: "Weekdays. Includes a bacon roll on arrival and a two-course meal after" },
  { what: "Buggy", price: "£25", when: "Four available. Book with the tee time — they go first on a wet Saturday" },
  { what: "Trolley", price: "£4 electric, £2 pull", when: "Always available" },
];

function P() {
  return (
    <SiteChrome
      name="Wharncliffe Crags Golf Club"
      tagline="Green fees, when you can play, and exactly what to wear."
      links={[
        { label: "Home", href: "#/" },
        { label: "Membership", href: "#/membership" },
      ]}
      action={{ label: "Book a tee time", href: "#book" }}
    >
      <div className="mx-auto max-w-5xl px-6 py-14">
        <h1 className="text-4xl font-semibold tracking-tight text-balance">Visitors</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          You do not need a handicap, you do not need a member to sign you in, and you do not need
          to ring first — though the tee sheet is online and Saturday afternoon fills. Both those
          requirements went in 2019.
        </p>

        <section className="mt-12">
          <SectionHeader eyebrow="Green fees" title="Eight lines, and that is all of them" />
          <ul className="mt-6 divide-y divide-border border-y border-border">
            {FEES.map((f) => (
              <li key={f.what} className="grid gap-1 py-4 md:grid-cols-[minmax(0,17rem)_minmax(0,7rem)_1fr] md:gap-6">
                <p className="font-medium">{f.what}</p>
                <p className="tabular-nums">{f.price}</p>
                <p className="text-sm text-muted-foreground">{f.when}</p>
              </li>
            ))}
          </ul>
          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Pay in the pro shop before you go out. Card or cash, no booking fee, and no charge for
            cancelling however late — the weather here changes in twenty minutes and penalising
            somebody for it would be absurd.
          </p>
        </section>

        <section className="mt-14">
          <SectionHeader
            eyebrow="What to wear"
            title="Specifically, so nobody is turned away at the first tee"
            description="Every club writes 'smart casual' and nobody knows what it means. Here is what it means here."
          />
          <div className="mt-8 max-w-3xl">
            <HouseRules
              heading="On the course and in the clubhouse"
              arrive="Fifteen minutes before your tee time, at the pro shop"
              leave="The bar takes last orders at 19:30"
              lateNote="More than ten minutes late and the group behind will be sent out first. Come anyway — we will fit you in at the next gap rather than take your money and shrug."
              rules={[
                { what: "No denim anywhere on the property", detail: "Including the bar and including black jeans. It is the one rule people fall foul of and the one we cannot bend." },
                { what: "A collared shirt, or a golf polo", detail: "A round-neck sports top is fine on the course in summer. Not in the lounge." },
                { what: "Shorts are fine, with any socks", detail: "Tailored or golf shorts. Not gym shorts, and the old ankle-sock rule went years ago." },
                { what: "Golf shoes or trainers on the course", detail: "Metal spikes have not been allowed since 2011. Soft spikes or a decent trainer sole." },
                { what: "No spikes and no golf shoes in the lounge", detail: "There is a changing room and a spike bar by the back door. Muddy shoes off, that is all." },
                { what: "Mobiles on silent", detail: "Use one for a scorecard app, a rangefinder or a photograph. Taking a call on a green is the only thing anybody will actually say something about." },
              ]}
            />
          </div>
        </section>

        <section className="mt-14" id="book">
          <SectionHeader
            eyebrow="Book"
            title="Saturday 8 August, from 11:00"
            description="Or ring the pro shop on 0114 288 4471. Same sheet, same availability, and somebody answers."
          />
          <div className="mt-6 max-w-3xl">
            <AvailabilityGrid
              slots={["11:00", "11:08", "11:16", "11:24", "11:32", "11:40", "11:48", "11:56", "12:04", "12:12", "12:20", "12:28"]}
              taken={["11:08", "11:16", "11:32", "11:48", "12:04", "12:12"]}
              value="11:24"
            />
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader
            eyebrow="Societies"
            title="Twelve or more, weekdays"
            description="£30 a head including food, which is less than the ordinary green fee. Societies fill the course on days it would otherwise be quiet and we would rather have them."
          />
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">What is included</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                A bacon roll and coffee on arrival, eighteen holes, and a two-course meal
                afterwards. Prizes and a scoreboard if you want them, at no extra charge.
              </p>
            </div>
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">What we need</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Numbers a fortnight before and final names a week before. A £100 deposit, which
                comes off the bill rather than being an extra.
              </p>
            </div>
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">Mixed ability is fine</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Most societies here are. We will set a format that works when half the group has
                never held a club, and the professional will say hello to the beginners.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader title="Visitor questions" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "Is the course hard?",
                  answer:
                    "Honest rather than punishing. All the trouble is visible from the tee and there is no water. What there is is wind — four hundred feet up, and it adds two clubs on the way out.",
                },
                {
                  question: "Can I hire clubs?",
                  answer: "Two sets in the pro shop, £15, right-handed only. Ring ahead if you need left-handed and we will borrow a set from a member — somebody always says yes.",
                },
                {
                  question: "Can non-golfers come with us?",
                  answer:
                    "Into the clubhouse, absolutely, and it is open to anybody. On the course only if they are walking with a group and not playing, which nobody minds.",
                },
                {
                  question: "What happens if the weather turns?",
                  answer:
                    "Come in. If you have played fewer than nine holes we will give you a voucher for another day — not a refund, but no argument and no form.",
                },
              ]}
            />
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            <a className="underline underline-offset-4" href="#/">Tee times and the course</a>
            {" · "}
            <a className="underline underline-offset-4" href="#/membership">Joining</a>
          </p>
        </section>
      </div>
    </SiteChrome>
  );
}
