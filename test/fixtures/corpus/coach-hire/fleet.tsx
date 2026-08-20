// coach-hire /fleet — every vehicle by seats, with the two facts nobody
// publishes: what it CANNOT reach, and how much luggage a full one takes.
//
// A 13.9m double-decker at 4.38m high cannot get to half the venues in the
// Peak District, and a company that discovers that on the morning has ruined
// somebody's wedding. Putting the constraint next to the vehicle is the whole
// value of this page.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { VehicleCard } from "@/components/ui/vehicle-card";
import { CapacityTable } from "@/components/ui/capacity-table";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/fleet")({ component: P });

function P() {
  return (
    <SiteChrome
      name="Hallam Coaches"
      tagline="Six vehicles, by seats — and what each one cannot get to."
      links={[
        { label: "Home", href: "/" },
        { label: "Get a quote", href: "/quote" },
      ]}
      action={{ label: "Get a quote", href: "/quote" }}
    >
      <div className="mx-auto max-w-6xl px-6 py-14">
        <h1 className="text-4xl font-semibold tracking-tight text-balance">The fleet</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Ordered by seats. Each one says where it cannot go, which is the fact that decides a
          booking more often than the upholstery does.
        </p>

        <section className="mt-12">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <VehicleCard
              title="Mercedes Sprinter"
              price="from £310 a day"
              badge="16 seats"
              specs={[
                { label: "Length", value: "7.4m" },
                { label: "Height", value: "2.7m" },
                { label: "Luggage", value: "Rear shelf only" },
                { label: "Access", value: "Tail lift, 1 wheelchair" },
                { label: "Cannot reach", value: "Nothing, realistically" },
              ]}
            />
            <VehicleCard
              title="Iveco Daily"
              price="from £340 a day"
              badge="19 seats"
              specs={[
                { label: "Length", value: "8.1m" },
                { label: "Height", value: "2.8m" },
                { label: "Luggage", value: "Small trailer available" },
                { label: "Access", value: "Step entry, no lift" },
                { label: "Cannot reach", value: "Nothing, realistically" },
              ]}
            />
            <VehicleCard
              title="Yutong midi"
              price="from £520 a day"
              badge="33 seats"
              specs={[
                { label: "Length", value: "9.9m" },
                { label: "Height", value: "3.3m" },
                { label: "Luggage", value: "Underfloor lockers" },
                { label: "Access", value: "Tail lift, 1 wheelchair" },
                { label: "Cannot reach", value: "Ringinglow, Whirlow Brook lane" },
              ]}
            />
            <VehicleCard
              title="Volvo B8R"
              price="from £640 a day"
              badge="45 seats"
              specs={[
                { label: "Length", value: "12.0m" },
                { label: "Height", value: "3.5m" },
                { label: "Luggage", value: "Underfloor, 45 cases" },
                { label: "Access", value: "Step entry, no lift" },
                { label: "Cannot reach", value: "Most Peak District lanes" },
              ]}
            />
            <VehicleCard
              title="Volvo B11R"
              price="from £720 a day"
              badge="49 seats"
              specs={[
                { label: "Length", value: "12.6m" },
                { label: "Height", value: "3.6m" },
                { label: "Luggage", value: "Underfloor, 44 cases" },
                { label: "Access", value: "Step entry, toilet on board" },
                { label: "Cannot reach", value: "Ringinglow, Bradfield, most of Hathersage" },
              ]}
            />
            <VehicleCard
              title="Van Hool double-decker"
              price="from £880 a day"
              badge="53 seats"
              specs={[
                { label: "Length", value: "13.9m" },
                { label: "Height", value: "4.38m" },
                { label: "Luggage", value: "Underfloor, 46 cases" },
                { label: "Access", value: "Step entry, two decks" },
                { label: "Cannot reach", value: "Anything with a bridge under 4.5m" },
              ]}
            />
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader
            eyebrow="Seats, honestly"
            title="A 49-seater takes 44 to an airport"
            description="Every seat is a seat, but a full coach with a case each does not fit in the lockers. The airport column is the number that matters on a holiday job."
          />
          <div className="mt-8">
            <CapacityTable
              caption="A blank means the vehicle does not do that configuration at all."
              rooms={[
                { name: "Sprinter", capacities: { Seated: 16, "Airport, with cases": 14, "With a wheelchair space": 12 }, size: "7.4m" },
                { name: "Iveco Daily", capacities: { Seated: 19, "Airport, with cases": 15 }, size: "8.1m", note: "No lift, so no wheelchair configuration." },
                { name: "Yutong midi", capacities: { Seated: 33, "Airport, with cases": 28, "With a wheelchair space": 29 }, size: "9.9m" },
                { name: "Volvo B8R", capacities: { Seated: 45, "Airport, with cases": 41 }, size: "12.0m" },
                { name: "Volvo B11R", capacities: { Seated: 49, "Airport, with cases": 44 }, size: "12.6m" },
                { name: "Van Hool", capacities: { Seated: 53, "Airport, with cases": 46 }, size: "13.9m" },
              ]}
            />
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader
            eyebrow="Height and width"
            title="The two measurements that stop a job"
            description="Length almost never matters. Height and the tightest turn on the approach almost always do."
          />
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">Send us the postcode, not the town</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                We check it against a PSV route map before quoting. It takes two minutes and it is
                why we have never turned up to a venue we could not enter.
              </p>
            </div>
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">Country venues are the usual problem</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Barn weddings especially. Two Sprinters running a shuttle is often better than one
                coach that cannot get up the lane, and it usually costs less.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader title="Fleet questions" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "How old are the vehicles?",
                  answer: "Between 2018 and 2024. All Euro VI, all with seat belts, all on a six-weekly inspection cycle. We hold DVSA earned recognition, which means the records are audited rather than claimed.",
                },
                {
                  question: "Is there wifi and USB charging?",
                  answer: "On the B11R and the Van Hool. Not on the midis or the minibuses, and we would rather list it honestly than describe it as 'available on selected vehicles'.",
                },
                {
                  question: "Can we choose a specific coach?",
                  answer:
                    "You can request one and we will honour it unless it breaks down. If a substitution is needed it will be the same size or larger at no extra cost, and we telephone rather than let you find out in the car park.",
                },
              ]}
            />
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            <a className="underline underline-offset-4" href="/">Back to prices</a>
            {" · "}
            <a className="underline underline-offset-4" href="/quote">Get a quote</a>
          </p>
        </section>
      </div>
    </SiteChrome>
  );
}
