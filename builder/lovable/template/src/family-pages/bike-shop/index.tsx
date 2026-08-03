// bike-shop — BUY-AND-SERVICE: two businesses on one page, kept visibly apart.
//
// THE WORKSHOP WAIT IS STATED IN WEEKS. In March every bike shop in Britain is
// six weeks deep and none of them says so; somebody drops a bike off expecting
// Thursday and collects it in April. It is the single most useful number here
// and it costs nothing to publish.
//
// STOCK MEANS STOCK IN A SIZE. A shop listing eleven models and holding a large
// in two of them has not answered "can I ride away on one" — which is the
// question. Sizes are on every card.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { ProductCard } from "@/components/ui/product-card";
import { PriceList } from "@/components/ui/price-list";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/")({ component: P });

const IN_STOCK = [
  { name: "Genesis Croix de Fer 20 — S, M", price: 1349, note: "Steel, disc, room for mudguards. The one we sell most of." },
  { name: "Kona Sutra — M, L, XL", price: 1599, note: "Touring. Racks front and rear as it comes." },
  { name: "Ridgeback Speed — S, M, L", price: 599, note: "Flat bar, the sensible commuter. Half our sales in September." },
  { name: "Islabikes Beinn 24 — one size", price: 479, note: "Second-hand, in for a service, sold with three months' warranty.", was: 549 },
  { name: "Brompton C Line — black", price: 1450, note: "One in stock. They go the week they arrive.", soldOut: true },
  { name: "Frog 62 — one size", price: 380, note: "Children's. Genuinely light, which is the whole argument for one." },
];

const SERVICES = [
  { name: "Safety check", description: "Twenty minutes while you wait. Brakes, gears, wheels, headset, tyres", price: 0, meta: "free, always" },
  { name: "Basic service", description: "Gears and brakes adjusted, drivetrain cleaned, everything checked and tightened", price: 55 },
  { name: "Full service", description: "Basic, plus bearings stripped and repacked, cables replaced, wheels trued", price: 130 },
  { name: "Puncture", description: "While you wait if we are not mid-job", price: 12, meta: "plus tube" },
  { name: "Wheel build", description: "Hand-built and tensioned properly. Two weeks", price: 90, meta: "plus parts" },
  { name: "Bike fit", description: "Ninety minutes with Jo. Worth more than any component you could buy", price: 85 },
];

function P() {
  return (
    <SiteChrome
      name="Neepsend Cycles"
      tagline="A shop and a workshop on Rutland Road. Sixteen years."
      links={[
        { label: "Bikes in stock", href: "#/bikes" },
        { label: "The workshop", href: "#/workshop" },
        { label: "Questions", href: "#questions" },
      ]}
      action={{ label: "Book a service", href: "#/workshop" }}
    >
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="grid items-start gap-10 lg:grid-cols-[1.3fr_1fr]">
            <div>
              <h1 className="text-5xl font-semibold tracking-tight text-balance">
                What is actually in, and in which size
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
                Not a catalogue. Six bikes on the floor today, with the sizes we hold — because a
                shop listing eleven models and holding a large in two of them has not answered the
                question you came with.
              </p>
            </div>
            {/* THE WORKSHOP WAIT, as a number, in the hero. */}
            <div className="rounded-xl border-2 border-foreground p-6">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                The workshop, right now
              </p>
              <p className="mt-2 text-4xl font-semibold tabular-nums">11 days</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                From dropping off to collecting, for a booked service. It is four days in November
                and six weeks in March, and we would rather you knew before carrying a bike down
                here.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                A puncture or a snapped cable is done while you wait, whatever the queue says. That
                has never changed and it never will.
              </p>
            </div>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {IN_STOCK.map((b) => (
              <ProductCard key={b.name} product={b} href="#/bikes" />
            ))}
          </div>
          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Sold-out cards stay up for a fortnight so you know what we stock rather than what we
            happen to have on a Tuesday.{" "}
            <a className="underline underline-offset-4" href="#/bikes">Everything, with sizing.</a>
          </p>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid items-start gap-10 lg:grid-cols-[1fr_1fr]">
            <div>
              <SectionHeader
                eyebrow="The workshop"
                title="Six things, and the first is free"
                description="A safety check costs nothing and takes twenty minutes. About one in five turns up something the rider had not noticed, and roughly half of those need no work at all."
              />
              <p className="mt-5 max-w-lg text-sm leading-relaxed text-muted-foreground">
                We will tell you when a bike is not worth the money. A £130 full service on a
                supermarket bike with a seized bottom bracket is us taking your money, and we would
                rather sell you the £380 one that will last.
              </p>
              <a className="mt-6 inline-block rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="#/workshop">
                Book a slot
              </a>
            </div>
            <PriceList items={SERVICES} />
          </div>
        </div>
      </section>

      <section id="questions">
        <div className="mx-auto max-w-3xl px-6 py-14">
          <SectionHeader title="What people ask in the shop" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "Will you service a bike I did not buy here?",
                  answer: "Of course, and most of what is on the stand was bought elsewhere. There is no loyalty tier and no difference in the price.",
                },
                {
                  question: "Do you take part exchange?",
                  answer:
                    "On anything decent, yes, and we sell them on with three months' warranty. We will give you a straight number rather than an inflated one hidden in the new bike's price.",
                },
                {
                  question: "Cycle to Work?",
                  answer:
                    "All the main schemes. Be aware the shop pays about 12% of the value to the scheme provider, which is why some shops exclude sale bikes — we do not, and we would rather explain the arithmetic than pretend it is free money.",
                },
                {
                  question: "Can I test ride?",
                  answer:
                    "Anything on the floor, up Rutland Road and round the block, with an ID left at the counter. Nobody should spend four figures on something they have sat on for thirty seconds in a shop.",
                },
              ]}
            />
          </div>
        </div>
      </section>
    </SiteChrome>
  );
}
