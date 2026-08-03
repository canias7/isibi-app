// waste /book — access, the permit, and the collection window.
//
// THE PERMIT IS THE WHOLE PAGE. It is a council decision taking five working
// days, it cannot be hurried by us or by you, and somebody booking on Thursday
// for Saturday on the road simply cannot have one. Every skip company treats it
// as a footnote and every skip company has this argument weekly.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { PermitRow } from "@/components/ui/permit-row";
import { CollectionDay } from "@/components/ui/collection-day";
import { PriceList } from "@/components/ui/price-list";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/book")({ component: P });

const ACCESS = [
  { what: "6 metres of clear approach", detail: "The lorry reverses in. A parked car opposite a narrow drive is the commonest reason a delivery fails, and it fails at your cost if we have travelled." },
  { what: "Nothing overhead", detail: "The arms go about 4.5m up. Low branches, telephone lines and a carport all stop it. Look up before you book — everybody looks down." },
  { what: "Firm, level ground", detail: "Tarmac, concrete or well-compacted hardcore. A skip on a soft lawn sinks and takes the turf with it when it leaves." },
  { what: "Someone need not be in", detail: "If the space is clear and we know where it goes. Send a photograph with an arrow on it — genuinely the most useful thing you can do." },
];

const EXTRAS = [
  { name: "Delivery, collection, 14 days and tipping", description: "In every quoted price, always", price: 0, meta: "included" },
  { name: "Road permit", description: "At cost. Sheffield City Council sets it; five working days", price: 42 },
  { name: "Extra week", description: "Any size", price: 25 },
  { name: "Swap for a larger size", description: "Plus the price difference", price: 25 },
  { name: "Failed delivery", description: "Only where the space was not clear and we had travelled", price: 45 },
  { name: "Overloaded skip, emptied down by hand", description: "Avoidable entirely — ring us and we will swap it", price: 60 },
  { name: "Mattress, fridge, television or tyres found in the load", description: "Per item, and the tip photographs every load", price: 95, meta: "from" },
];

function P() {
  return (
    <SiteChrome
      name="Loxley Skips"
      tagline="Access, the permit, and when it arrives."
      links={[
        { label: "Home", href: "#/" },
        { label: "Sizes", href: "#/sizes" },
      ]}
      action={{ label: "Ring 0114 288 5510", href: "tel:01142885510" }}
    >
      <div className="mx-auto max-w-5xl px-6 py-14">
        <h1 className="text-4xl font-semibold tracking-tight text-balance">Booking</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Ring, or send a photograph of where it is going. Most skips are delivered next working
          day — unless it goes on the road, in which case the council needs five days and there is
          nothing anybody can do about that.
        </p>

        {/* THE PERMIT, FIRST, BECAUSE IT IS THE THING THAT CANNOT BE HURRIED. */}
        <section className="mt-12">
          <SectionHeader
            eyebrow="On the road or the pavement"
            title="Five working days, and we cannot speed it up"
            description="A permit is a council decision. We apply, we pay the £42 and pass it on at cost, and the timescale is theirs entirely."
          />
          <ul className="mt-8 max-w-3xl">
            <PermitRow
              kind="Skip permit — highway"
              reference="SCC-SKP-2026-11482"
              from="2026-08-10"
              to="2026-08-24"
              issuedBy="Sheffield City Council, Highways"
              people={["Loxley Skips Ltd, as licensed carrier"]}
              conditions={[
                "Lamps at each corner from dusk to dawn — we fit them and they are included",
                "Reflective markings on the road-facing end",
                "No closer than 15m to a junction",
                "Suspended parking bay if it is in one — a further £30 and another five days",
                "Extension needs a new application. It is not automatic.",
              ]}
            />
          </ul>
          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            On your own drive none of this applies and there is no permit, no lamps and no wait. If
            you can fit it on the drive, do.
          </p>
        </section>

        <section className="mt-14">
          <SectionHeader
            eyebrow="Access"
            title="Four things, and one of them is overhead"
            description="Everybody measures the ground and nobody looks up. Telephone lines and a carport stop a delivery just as completely as a wall does."
          />
          <ul className="mt-8 divide-y divide-border border-y border-border">
            {ACCESS.map((a) => (
              <li key={a.what} className="grid gap-1 py-5 md:grid-cols-[minmax(0,15rem)_1fr] md:gap-8">
                <p className="font-medium">{a.what}</p>
                <p className="text-sm leading-relaxed text-muted-foreground">{a.detail}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-14">
          <div className="grid items-start gap-10 lg:grid-cols-[1fr_1fr]">
            <div>
              <SectionHeader eyebrow="When" title="Delivery and collection" />
              <div className="mt-6">
                <CollectionDay
                  nextOn="2026-08-06"
                  dayName="Thursday"
                  bins={["2-yard", "4-yard", "6-yard", "8-yard"]}
                  putOutBy="07:00 on the collection day, and it must be level with the top"
                />
              </div>
              <p className="mt-5 max-w-lg text-sm leading-relaxed text-muted-foreground">
                Delivered between seven and one, with a phone call twenty minutes ahead. Collection
                is the working day after you ring, and if the fourteen days runs out and you have
                not rung, nothing happens — we wait.
              </p>
            </div>
            <div>
              <SectionHeader eyebrow="Everything chargeable" title="Seven lines, and four are avoidable" />
              <div className="mt-6">
                <PriceList items={EXTRAS} />
              </div>
            </div>
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader title="Booking questions" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "How quickly can I get one?",
                  answer:
                    "Next working day on a drive, most weeks. Same day if you ring before nine and we have one on the lorry. On the road, five working days minimum for the permit and that is the council's clock.",
                },
                {
                  question: "Can I cancel?",
                  answer:
                    "Any time before it leaves the yard, free, no questions. After that it is a £45 failed delivery, which we waive if you ring us as we arrive rather than after we have gone.",
                },
                {
                  question: "Do I get a waste transfer note?",
                  answer:
                    "Emailed within 48 hours of collection, always, whether or not you ask. You are legally entitled to it and for a business it is the document that proves your waste was handled properly.",
                },
                {
                  question: "What if the skip damages my drive?",
                  answer:
                    "We put boards under it as standard and we are insured. Tell us before it goes on a block-paved or resin drive and we will use extra protection — it costs nothing and it is much easier than the alternative.",
                },
              ]}
            />
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            <a className="underline underline-offset-4" href="#/">Prohibited items</a>
            {" · "}
            <a className="underline underline-offset-4" href="#/sizes">Sizes and prices</a>
          </p>
        </section>
      </div>
    </SiteChrome>
  );
}
