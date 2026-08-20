// golf-club — MEMBERSHIP-AND-TEE-TIMES as a bento, and the VISITOR question
// answered first.
//
// MOST TRAFFIC TO A GOLF CLUB'S SITE IS SOMEBODY ASKING "CAN I PLAY HERE ON
// SATURDAY", not somebody considering joining. Every club builds the site for
// the second person and buries the answer for the first behind "Visitors →
// Green Fees → Policy". That is backwards, and it costs the club the visitor
// green fees that keep it solvent.
//
// THE DRESS CODE IS STATED IN PLAIN TERMS. "Smart casual attire is required at
// all times" tells nobody whether jeans are allowed. Saying "no denim, collared
// shirt, shorts fine with proper socks" costs a sentence and prevents somebody
// being turned away at the first tee.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { BentoGrid } from "@/components/ui/bento-grid";
import { AvailabilityGrid } from "@/components/ui/availability-grid";
import { OpeningHours } from "@/components/ui/opening-hours";
import { MediaGrid } from "@/components/ui/media-grid";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/")({ component: P });

const HOURS = [
  { day: 1, label: "Monday", open: "07:00", close: "20:00" },
  { day: 2, label: "Tuesday", open: "07:00", close: "20:00" },
  { day: 3, label: "Wednesday", open: "07:00", close: "20:00" },
  { day: 4, label: "Thursday", open: "07:00", close: "20:00" },
  { day: 5, label: "Friday", open: "07:00", close: "20:00" },
  { day: 6, label: "Saturday", open: "06:30", close: "20:00" },
  { day: 0, label: "Sunday", open: "06:30", close: "19:00" },
];

function Tile({ title, body, href, cta }: { title: string; body: string; href: string; cta: string }) {
  return (
    <div className="flex h-full flex-col">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
      <a className="mt-4 inline-block text-sm font-medium underline underline-offset-4" href={href}>{cta}</a>
    </div>
  );
}

function P() {
  return (
    <SiteChrome
      name="Wharncliffe Crags Golf Club"
      tagline="A moorland eighteen above Deepcar. Founded 1897, members' owned."
      links={[
        { label: "Membership", href: "/membership" },
        { label: "Visitors", href: "/visitors" },
        { label: "Questions", href: "#questions" },
      ]}
      action={{ label: "Book a tee time", href: "#tee" }}
    >
      {/* THE COURSE IS THE PRODUCT AND EVERY GOLF CLUB SITE FORGETS IT. Nine
          paragraphs about green fees answer a question the pictures answer
          faster: is this a flat municipal, or is it moorland with a view.
          Each caption is the hole and the yardage rather than a mood, so
          somebody who plays can read the course off four frames. */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 pt-10">
          <MediaGrid
            columns={4}
            ratio="4/3"
            items={[
              { src: null, alt: "The 7th from the tee, dropping into the valley with the crags behind", caption: "7th · 412 yards · stroke index 2" },
              { src: null, alt: "The 12th green in low autumn sun, bunkers front left and right", caption: "12th · the green that decides most medals" },
              { src: null, alt: "Heather and gorse either side of the 3rd fairway", caption: "Moorland. It drains, and it plays all year." },
              { src: null, alt: "The clubhouse veranda at six, half a dozen people, bags against the rail", caption: "The veranda. Nobody is moved on." },
            ]}
          />
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance">
            Yes, visitors can play. Here is everything else.
          </h1>
          <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
            That is what most people arrive wanting to know, so it goes first rather than three
            clicks into a members' section. Green fees, when, what to wear, and how to book — all
            below.
          </p>

          <div className="mt-10">
            <BentoGrid
              items={[
                {
                  span: 2,
                  content: (
                    <Tile
                      title="Visitors — £34 weekday, £42 weekend"
                      body="Any day. Weekends after 11:00 because the members' competitions run in the morning. No handicap certificate needed and no member has to sign you in — that requirement was dropped in 2019 and we have never regretted it."
                      href="/visitors"
                      cta="Green fees and how to book"
                    />
                  ),
                },
                {
                  content: (
                    <Tile
                      title="What to wear"
                      body="No denim anywhere. Collared shirt or a golf polo. Shorts are fine with any socks you like. Trainers on the course are fine; spikes are not allowed in the lounge."
                      href="/visitors"
                      cta="The whole dress code"
                    />
                  ),
                },
                {
                  content: (
                    <Tile
                      title="Joining"
                      body="Seven categories from £190 for a student to £940 full. Two have a waiting list and five do not — the page says which, with the current wait in months."
                      href="/membership"
                      cta="Every category"
                    />
                  ),
                },
                {
                  span: 2,
                  content: (
                    <div className="flex h-full flex-col">
                      <h3 className="text-lg font-semibold">The course today</h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        Greens on summer cut, no temporaries, buggies permitted. The 7th and 12th
                        are winter tees from November — it is moorland, it drains well, and it plays
                        all year.
                      </p>
                      <div className="mt-4">
                        <OpeningHours days={HOURS} />
                      </div>
                    </div>
                  ),
                },
              ]}
            />
          </div>
        </div>
      </section>

      <section className="border-b border-border" id="tee">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <SectionHeader
            eyebrow="Tee times"
            title="Saturday 8 August"
            description="Members from 06:30, visitors from 11:00. Book online or ring the pro shop on 0114 288 4471 — both go to the same sheet."
          />
          <div className="mt-8 max-w-3xl">
            <AvailabilityGrid
              slots={["11:00", "11:08", "11:16", "11:24", "11:32", "11:40", "11:48", "11:56", "12:04", "12:12", "12:20", "12:28"]}
              taken={["11:08", "11:16", "11:32", "11:48", "12:04", "12:12"]}
              value="11:24"
            />
          </div>
          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Eight-minute intervals, up to four in a group. A single or a pair may be joined to make
            a three — say when booking if you would rather not be, and nobody will mind.
          </p>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <SectionHeader
            eyebrow="The course"
            title="Moorland, 6,214 yards, par 71"
            description="Four hundred feet up, which means wind. It is the defence of the course and it is also why it drains and plays through the winter when the parkland clubs are on mats."
          />
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">The front nine</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Out along the edge, mostly into the prevailing wind. The 4th is 178 yards over a
                gully and plays anything from a 7-iron to a wood.
              </p>
            </div>
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">The back nine</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Tighter, more heather, and downwind. Where a card is either saved or ruined; the
                14th has taken more balls than the rest put together.
              </p>
            </div>
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">Practice</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                A short-game area and six nets. No driving range, and there never will be — there is
                nowhere flat enough for one.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="questions">
        <div className="mx-auto max-w-3xl px-6 py-14">
          <SectionHeader title="What people ring to ask" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "Do I need a handicap?",
                  answer:
                    "Not to play as a visitor. You do to enter competitions, and joining is how you get one — the club runs six qualifying rounds a month for exactly that.",
                },
                {
                  question: "Can beginners play here?",
                  answer:
                    "Yes, and midweek afternoons are the time to do it — quiet, and nobody behind you. It is a moorland course and it is honest rather than punishing; the trouble is all visible.",
                },
                {
                  question: "Is there a bar and food?",
                  answer:
                    "The clubhouse is open to anybody, member or not, from eight until eight. Bacon sandwiches from opening, proper food from noon, and the beer is from the brewery in Stocksbridge.",
                },
                {
                  question: "Are women and juniors welcome?",
                  answer:
                    "Fully, and on the same terms — one competition calendar, one set of rules, one bar. The club voted the separate categories away in 2018 and nobody has asked for them back.",
                },
              ]}
            />
          </div>
        </div>
      </section>
    </SiteChrome>
  );
}
