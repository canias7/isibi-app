// garden-centre /visit — the practical facts, including the ones that stop
// somebody coming: the lane, the parking, and whether it is manageable with a
// wheelchair.
//
// A NURSERY UP A SINGLE-TRACK LANE HAS TO SAY SO. It is the difference between
// a nice afternoon and a stressful twenty minutes reversing for a tractor, and
// every rural business leaves it out because it sounds like a drawback. Saying
// it is what makes the drawback survivable.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { OpeningHours } from "@/components/ui/opening-hours";
import { LocationCard } from "@/components/ui/location-card";
import { PriceList } from "@/components/ui/price-list";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/visit")({ component: P });

const HOURS = [
  { day: 1, label: "Monday", open: null, close: null },
  { day: 2, label: "Tuesday", open: "09:00", close: "17:00" },
  { day: 3, label: "Wednesday", open: "09:00", close: "17:00" },
  { day: 4, label: "Thursday", open: "09:00", close: "17:00" },
  { day: 5, label: "Friday", open: "09:00", close: "17:00" },
  { day: 6, label: "Saturday", open: "09:00", close: "17:00" },
  { day: 0, label: "Sunday", open: "10:00", close: "16:00" },
];

const CAFE = [
  { name: "Coffee, tea, proper pot", description: "Beans from Neepsend, a mile and a half away", price: 2.8 },
  { name: "Cake, whatever Denise made", description: "Usually four, always one gluten-free, sometimes a vegan one", price: 3.5 },
  { name: "Soup and bread", description: "October to March only. Whatever the tunnels produced", price: 6.5 },
  { name: "Sandwich", description: "Three fillings, on bread from Stannington", price: 5.5 },
  { name: "Ice cream", description: "Our Cow Molly, from Dungworth. Four flavours", price: 3 },
];

function P() {
  return (
    <SiteChrome
      name="Hollin Busk Nursery"
      tagline="Where we are, what the lane is like, and the cake situation."
      links={[
        { label: "This month", href: "#/" },
        { label: "What is in", href: "#/plants" },
      ]}
      action={{ label: "What is in", href: "#/plants" }}
    >
      <div className="mx-auto max-w-5xl px-6 py-16">
        <h1 className="text-5xl font-semibold tracking-tight text-balance">Visiting</h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Closed Mondays, which catches people out. The lane is single-track for the last half mile
          and there are passing places — worth knowing before you set off rather than in the middle
          of it.
        </p>

        <section className="mt-14">
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr]">
            <div>
              <SectionHeader eyebrow="When" title="Six days, and Monday is not one of them" />
              <div className="mt-6">
                <OpeningHours days={HOURS} />
              </div>
              <p className="mt-5 max-w-lg text-sm leading-relaxed text-muted-foreground">
                Closed Christmas Day to 2 January, and on any day the lane is genuinely impassable —
                which happens two or three times most winters. We put it on the front page rather
                than letting people find out at the top of the hill.
              </p>
            </div>
            <div>
              <SectionHeader eyebrow="Where" title="Up the lane past the reservoir" />
              <div className="mt-6">
                <LocationCard
                  name="Hollin Busk Nursery"
                  address="Hollin Busk Lane, Stocksbridge, Sheffield S36 2FR"
                  note="Single track for the last half mile with four passing places. Do not follow a satnav that sends you via Coal Pit Lane — it is a farm track and it will not end well."
                />
              </div>
              <p className="mt-5 max-w-lg text-sm leading-relaxed text-muted-foreground">
                The 57 bus stops at Stocksbridge bottom and it is a twenty-minute walk uphill. It is
                a pleasant walk and a hard one carrying a tray of plants — we will run you back down
                if you ask, and people do.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-16">
          <SectionHeader
            eyebrow="Getting round it"
            title="What the ground is actually like"
            description="Honest rather than reassuring, because a wasted journey for somebody with limited mobility is a much worse thing than a lost sale."
          />
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">The main yard and the cafe</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Level, tarmac, step-free throughout, with an accessible toilet. A wheelchair or a
                pushchair is entirely fine here.
              </p>
            </div>
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">The tunnels</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Gravel, with a slight slope and a lip at each doorway. Manageable with a helper,
                hard alone in a manual chair. Say so and we will bring the benches to you.
              </p>
            </div>
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">The top field</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Grass, and steep. Not accessible and we are not going to pretend otherwise. It is
                trees and hedging and we will fetch anything from it.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-16">
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr]">
            <div>
              <SectionHeader
                eyebrow="The cafe"
                title="Twenty covers, and Denise does the cake"
                description="It is not why anybody comes and it is why a fair few stay. Everything is from within about three miles."
              />
              <p className="mt-5 max-w-lg text-sm leading-relaxed text-muted-foreground">
                Dogs everywhere including inside, on a lead. Water bowls at both gates. Nobody has
                ever been asked to leave for a muddy dog and it would be a strange place to start.
              </p>
            </div>
            <PriceList items={CAFE} />
          </div>
        </section>

        <section className="mt-16">
          <SectionHeader title="Visiting questions" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "Is there parking?",
                  answer:
                    "About thirty spaces, free, and full on a Saturday in May between eleven and two. Any other time you will get one. There is an overflow field in spring and it is signed when it is open.",
                },
                {
                  question: "Can I bring a trailer?",
                  answer:
                    "Yes, and there is room to turn one by the top gate. Anything larger than a transit is a genuine problem on the lane — ring first and we will meet you at the bottom.",
                },
                {
                  question: "Do you deliver?",
                  answer:
                    "Within about eight miles, £12, Wednesdays and Saturdays. Anything over £150 is free. We will not post plants — they arrive badly and it is not worth anybody's disappointment.",
                },
                {
                  question: "Is it worth coming in winter?",
                  answer:
                    "January and February are the quietest and the best time to talk to somebody properly. It is also bare-root season, which is when the genuinely good buying happens.",
                },
              ]}
            />
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            <a className="underline underline-offset-4" href="#/">This month</a>
            {" · "}
            <a className="underline underline-offset-4" href="#/plants">Everything in stock</a>
          </p>
        </section>
      </div>
    </SiteChrome>
  );
}
