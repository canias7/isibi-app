// antiques /selling — the OTHER audience, and mostly people who have just lost
// somebody.
//
// MOST HOUSE CONTENTS ARE WORTH VERY LITTLE AND SOMEBODY HAS TO SAY SO. Brown
// furniture collapsed in value twenty years ago and has not come back; a dining
// suite that cost £3,000 in 1985 is worth £150 and its owner's family does not
// know. A dealer who lets them find out slowly, item by item, is exploiting the
// gap. Saying it in the first paragraph is the kinder and the more honest thing.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { PriceList } from "@/components/ui/price-list";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/selling")({ component: P });

const WAYS = [
  { name: "We buy it outright", description: "An offer on the day, cash or transfer within 48 hours. Best for anything under about £1,500 and for anybody who wants it finished", price: null, meta: "no fee" },
  { name: "We sell it for you", description: "It sits in the shop, we agree a reserve, you get paid when it goes", price: 25, meta: "% commission" },
  { name: "We send it to auction", description: "To one of three salerooms we trust, chosen for the piece. We handle the entry and the transport", price: 5, meta: "% on top of theirs" },
  { name: "Probate valuation", description: "A written valuation for HMRC. Independent, and it carries no obligation to sell us anything", price: 180, meta: "flat, up to 3 hours" },
  { name: "Insurance valuation", description: "Replacement value rather than sale value — a different and usually higher number", price: 180, meta: "flat" },
  { name: "House clearance", description: "The whole contents. We take what has value, arrange the charity collection and the tip run for the rest", price: null, meta: "quoted" },
];

const WORTH = [
  { what: "Brown furniture — dining suites, sideboards, display cabinets", now: "£50 – £250", why: "The market went in about 2005 and has not returned. A suite that cost £3,000 in 1985 is genuinely worth £150 and it is nobody's fault." },
  { what: "Mahogany and walnut before 1830", now: "Holding, sometimes rising", why: "Georgian and Regency pieces of real quality are a different market entirely from Victorian and Edwardian. Age is not the variable; quality is." },
  { what: "Old Sheffield Plate and early silver", now: "Steady, good demand", why: "Local interest here is strong and a marked piece with a maker is always sellable." },
  { what: "Studio pottery and mid-century", now: "Strong and still rising", why: "The pieces that were in a back bedroom because nobody liked them. Ercol, G Plan, Troika, Lucie Rie — all worth checking before a skip." },
  { what: "Books", now: "Almost nothing", why: "Unless there is a first edition with a jacket. A wall of leather-bound Victorian sets is worth less than the shelf." },
  { what: "China dinner services and figurines", now: "£10 – £40 for most", why: "Royal Doulton, Wedgwood, the lot. This is the hardest thing to tell a family and it is nearly always true." },
];

function P() {
  return (
    <SiteChrome
      name="Vane & Marrow"
      tagline="Selling something — including when the answer is that it is worth very little."
      links={[
        { label: "All stock", href: "#/" },
        { label: "A piece in full", href: "#/piece" },
      ]}
      action={{ label: "Ring 0114 255 1180", href: "tel:01142551180" }}
    >
      <div className="mx-auto max-w-5xl px-6 py-16">
        <h1 className="text-5xl font-semibold tracking-tight text-balance">Selling something</h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Most of the people who ring us have just lost somebody, and most house contents are worth
          very much less than the family expects. That sentence belongs at the top rather than
          arriving item by item across an afternoon.
        </p>

        <section className="mt-14">
          <div className="grid gap-14 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <SectionHeader
                eyebrow="What things are actually worth"
                title="The market, honestly"
                description="Written down so nobody has to hear it for the first time standing in their mother's front room."
              />
              <ul className="mt-8 divide-y divide-border border-y border-border">
                {WORTH.map((w) => (
                  <li key={w.what} className="py-4">
                    <div className="flex flex-wrap items-baseline gap-x-3">
                      <p className="font-medium">{w.what}</p>
                      <p className="text-sm tabular-nums text-muted-foreground">{w.now}</p>
                    </div>
                    <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">{w.why}</p>
                  </li>
                ))}
              </ul>
            </div>
            <div className="lg:pt-20">
              <SafeImage
                src={null}
                alt="A Victorian sideboard in a cleared front room"
                ratio="4/5"
                fallbackSeed="sideboard"
              />
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                This sideboard cost about £900 in 1978 and is worth £120 today. Telling somebody
                that is the job, and doing it kindly and immediately is the only decent way to do it.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-16">
          <div className="grid gap-14 lg:grid-cols-[1fr_1.15fr]">
            <div className="lg:pt-6">
              <SectionHeader
                eyebrow="Six ways"
                title="And which one suits what"
                description="An outright offer is worth less than a good auction result and it is finished on the day. Which matters more is entirely yours to decide and we will not push either."
              />
              <p className="mt-5 max-w-lg text-sm leading-relaxed text-muted-foreground">
                A probate valuation carries no obligation to sell us anything and never will. If we
                valued it we will tell you what we would pay, and you are free to take that figure
                to somebody else — several people do and we would rather that than a suspicion.
              </p>
            </div>
            <PriceList items={WAYS} />
          </div>
        </section>

        <section className="mt-16">
          <SectionHeader
            eyebrow="Before you clear a house"
            title="Four things people throw away"
            description="Every dealer has watched a skip go past with something worth four figures in it."
          />
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">Anything in the loft in a box</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Costume jewellery, medals, cameras, tools, fountain pens. The things that got put
                away are far more often valuable than the things on display.
              </p>
            </div>
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">Paperwork</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Receipts, letters and photographs of a piece in a room. Provenance can add a fifth
                to the value and it lives in the drawer that gets emptied first.
              </p>
            </div>
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">Ugly mid-century furniture</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                The teak sideboard nobody liked is now worth more than the Victorian one everybody
                admired. This reversal is thirty years old and still surprises people.
              </p>
            </div>
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">Tools and workshop contents</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Old planes, chisels, engineering tools and anything Sheffield-marked. There is a
                strong market and it is invisible to anybody outside it.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-16">
          <SectionHeader title="Selling questions" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "Will you come out?",
                  answer:
                    "Anywhere within about thirty miles, free, no obligation. Send photographs first if you can — we can often say on the phone whether a visit is worth anybody's afternoon.",
                },
                {
                  question: "How do I know your offer is fair?",
                  answer:
                    "Get two others. We will not be offended and it is what we would do. A dealer who discourages a second opinion is telling you something.",
                },
                {
                  question: "What happens to the things worth nothing?",
                  answer:
                    "We will arrange the charity collection and the tip run as part of a clearance, and we will not charge to take away things we are also selling. Nobody should be left with a full house and a dealer who took only the good bits.",
                },
                {
                  question: "Can you value for probate quickly?",
                  answer:
                    "Usually within a week, written, HMRC-format, £180 for up to three hours. It is a different exercise from what we would pay and the letter says which figure is which.",
                },
              ]}
            />
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            <a className="underline underline-offset-4" href="#/">The current stock</a>
            {" · "}
            <a className="underline underline-offset-4" href="#/piece">How we describe a piece</a>
          </p>
        </section>
      </div>
    </SiteChrome>
  );
}
