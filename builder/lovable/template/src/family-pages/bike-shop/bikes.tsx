// bike-shop /bikes — the stock with SIZING, because a bike is a garment.
//
// EVERY BIKE SHOP SITE LISTS FRAME SIZES AND NONE OF THEM SAYS WHO THEY FIT.
// "54cm" means nothing to somebody buying their first proper bike, and the
// height ranges are approximately known to every mechanic and published by
// almost nobody. A spec list with a rider height next to it is the difference
// between a website and a shop.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { ProductCard } from "@/components/ui/product-card";
import { SpecRow, SpecList } from "@/components/ui/spec-row";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/bikes")({ component: P });

const STOCK = [
  { name: "Genesis Croix de Fer 20 — S, M", price: 1349, note: "Steel gravel/tourer. Mudguard and rack mounts." },
  { name: "Kona Sutra — M, L, XL", price: 1599, note: "Full touring. Racks front and rear included." },
  { name: "Ridgeback Speed — S, M, L", price: 599, note: "Flat-bar commuter. The sensible one." },
  { name: "Ridgeback Advance — M, L", price: 799, note: "The same idea with hydraulic discs and a belt option." },
  { name: "Frog 62 — one size", price: 380, note: "Children's, 8 to 10 years roughly." },
  { name: "Frog 47 — one size", price: 340, note: "Children's, 5 to 7 years roughly." },
  { name: "Islabikes Beinn 24", price: 479, was: 549, note: "Second-hand, serviced, three months' warranty." },
  { name: "Brompton C Line — black", price: 1450, note: "Sold Tuesday. Next one is a fortnight away.", soldOut: true },
];

function P() {
  return (
    <SiteChrome
      name="Neepsend Cycles"
      tagline="What is in, in which size, and who each size fits."
      links={[
        { label: "Home", href: "#/" },
        { label: "The workshop", href: "#/workshop" },
      ]}
      action={{ label: "Book a service", href: "#/workshop" }}
    >
      <div className="mx-auto max-w-6xl px-6 py-14">
        <h1 className="text-4xl font-semibold tracking-tight text-balance">Bikes in stock</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Eight on the floor today. A bike is a garment and the frame size matters far more than
          the components, so the rider heights are below rather than left as numbers in centimetres.
        </p>

        <section className="mt-12">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STOCK.map((b) => (
              <ProductCard key={b.name} product={b} />
            ))}
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader
            eyebrow="Sizing"
            title="Who each frame size actually fits"
            description="Approximate, and a bike fit beats any table. But a table is better than nothing, which is what most shops publish."
          />
          <div className="mt-8 max-w-2xl">
            <SpecList>
              <SpecRow label="XS" value="152 – 160 cm" unit="5'0&quot; – 5'3&quot;" note="Rare in adult drop-bar frames. A 26in-wheel or a small women's frame is often the better answer." />
              <SpecRow label="S" value="160 – 170 cm" unit="5'3&quot; – 5'7&quot;" />
              <SpecRow label="M" value="170 – 178 cm" unit="5'7&quot; – 5'10&quot;" highlight note="The size we sell most of, and the one we hold in nearly everything." />
              <SpecRow label="L" value="178 – 186 cm" unit="5'10&quot; – 6'1&quot;" />
              <SpecRow label="XL" value="186 – 194 cm" unit="6'1&quot; – 6'4&quot;" note="Order-in on most models. About ten days." />
              <SpecRow label="Children's, 47" value="105 – 120 cm" unit="roughly 5 to 7" note="Measure the inside leg rather than guessing from age. Children vary enormously." />
              <SpecRow label="Children's, 62" value="122 – 140 cm" unit="roughly 8 to 10" />
            </SpecList>
          </div>
          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Between two sizes? Come in. Reach matters more than height and it is not something a
            table can know — it is ten minutes on a turbo trainer and it is free.
          </p>
        </section>

        <section className="mt-14">
          <SectionHeader
            eyebrow="What is included"
            title="On every bike we sell, whatever it cost"
            description="Not a package, not an upsell. It is what selling somebody a bike properly involves."
          />
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">Set up to fit you</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Saddle height, bar position, brake reach, and the tyres at the pressure for your
                weight rather than the number on the sidewall.
              </p>
            </div>
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">A six-week check</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Free. Cables stretch and spokes settle in the first month on every new bike, and it
                is when a bike either stays good or starts feeling worn out.
              </p>
            </div>
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">A year of adjustments</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Gear indexing, brake tweaks, anything that has drifted. Bring it in, no appointment,
                no charge.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader title="Buying questions" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "Should I buy a cheaper bike and upgrade it?",
                  answer:
                    "Almost never. The frame and the wheels are what you cannot upgrade cheaply, and they are what the price is. Buy the frame you want with whatever gears it comes with.",
                },
                {
                  question: "Are the children's bikes worth it?",
                  answer:
                    "A Frog is £380 against £150 in a supermarket and weighs about half. A child on a bike that weighs as much as they do learns slower and enjoys it less. We also buy them back.",
                },
                {
                  question: "Can you order something you do not stock?",
                  answer:
                    "Most things, about ten days, no deposit under £2,000. We will also tell you when a shop three miles away has it on the floor today, because that is more use to you.",
                },
                {
                  question: "What about electric bikes?",
                  answer:
                    "We do not sell them and we do service them. Selling e-bikes properly needs a diagnostic investment we have not made, and being mediocre at it would be worse than not doing it.",
                },
              ]}
            />
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            <a className="underline underline-offset-4" href="#/">Stock and the workshop wait</a>
            {" · "}
            <a className="underline underline-offset-4" href="#/workshop">Book a service</a>
          </p>
        </section>
      </div>
    </SiteChrome>
  );
}
