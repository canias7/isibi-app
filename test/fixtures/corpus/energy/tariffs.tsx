// energy /tariffs — every tariff including the closed ones, and the end dates
// and exit fees stated in the row rather than in a table of terms nobody opens.
//
// A closed tariff still has households on it. Removing the row is how somebody
// on a legacy rate discovers they cannot find out what they are paying.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { TariffRow } from "@/components/ui/tariff-row";
import { ContractEnd } from "@/components/ui/contract-end";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/tariffs")({ component: P });

function P() {
  return (
    <SiteChrome
      name="Loxley Community Energy"
      tagline="Every tariff, open and closed, with the exit fee in the row."
      links={[
        { label: "Home", href: "/" },
        { label: "Send a reading", href: "/meter" },
      ]}
      action={{ label: "Send a reading", href: "/meter" }}
    >
      <section className="border-b border-border">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <SectionHeader
            eyebrow="Open to new members"
            title="Electricity"
            description="Estimates assume 2,700 kWh a year, the Ofgem medium household. Your own figure is on the last page of your bill."
          />
          <ul className="mt-8 grid gap-4">
            <TariffRow
              name="Valley Fixed 24 — two years"
              unitRates={[{ id: "e", pencePerUnit: 24.1 }]}
              standingChargePence={41.2}
              estimateAt={2700}
              estimateAnnual={761}
              endsOn="2028-09-30"
              exitFee={30}
            />
            <TariffRow
              name="Valley Fixed 12 — one year"
              unitRates={[{ id: "e", pencePerUnit: 24.9 }]}
              standingChargePence={41.2}
              estimateAt={2700}
              estimateAnnual={783}
              endsOn="2027-09-30"
              exitFee={15}
            />
            <TariffRow
              name="Valley Variable"
              unitRates={[{ id: "e", pencePerUnit: 25.8 }]}
              standingChargePence={39.9}
              estimateAt={2700}
              estimateAnnual={843}
            />
            <TariffRow
              name="Ewden Off-Peak"
              unitRates={[
                { id: "d", label: "Day", pencePerUnit: 29.4 },
                { id: "n", label: "Night, 00:30–06:30", pencePerUnit: 11.2 },
              ]}
              standingChargePence={44.8}
              estimateAt={2700}
              estimateAnnual={798}
            />
          </ul>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <SectionHeader eyebrow="Open to new members" title="Gas" />
          <ul className="mt-8 grid gap-4">
            <TariffRow
              name="Valley Fixed Gas"
              unitRates={[{ id: "g", pencePerUnit: 6.1 }]}
              standingChargePence={31.4}
              estimateAt={11500}
              estimateAnnual={816}
              endsOn="2027-09-30"
              exitFee={15}
              unit="kWh"
            />
            <TariffRow
              name="Valley Variable Gas"
              unitRates={[{ id: "g", pencePerUnit: 6.4 }]}
              standingChargePence={30.8}
              estimateAt={11500}
              estimateAnnual={848}
              unit="kWh"
            />
          </ul>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <div className="grid items-start gap-10 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <SectionHeader
                eyebrow="Coming to an end"
                title="What the letter will say"
                description="Six weeks before a fixed tariff ends we write with exactly this. Nobody is moved onto a new fixed deal without asking."
              />
              <p className="mt-5 max-w-lg text-sm leading-relaxed text-muted-foreground">
                The default is the variable tariff, which has no exit fee — so if you do nothing you
                keep every option. That is deliberately the opposite of the industry norm, where
                doing nothing lands you on the most expensive thing available.
              </p>
            </div>
            <ContractEnd
              endsOn="2026-09-30"
              daysLeft={58}
              currentPrice={63}
              rollingPrice={70}
              exitFee={0}
            />
          </div>
        </div>
      </section>

      {/* CLOSED TARIFFS STAY. Households are still on these. */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <SectionHeader
            eyebrow="Closed to new members"
            title="Still here for the people on them"
            description="If you are on one of these, nothing changes unless you ask. Moving to a current tariff is free and there is no exit fee on any closed rate."
          />
          <ul className="mt-8 grid gap-4">
            <TariffRow
              name="Founder Fixed (closed 2024)"
              unitRates={[{ id: "e", pencePerUnit: 21.4 }]}
              standingChargePence={38.1}
              estimateAt={2700}
              estimateAnnual={717}
            />
            <TariffRow
              name="Hydro Direct (closed 2023)"
              unitRates={[{ id: "e", pencePerUnit: 22.9 }]}
              standingChargePence={42.6}
              estimateAt={2700}
              estimateAnnual={774}
            />
          </ul>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-3xl px-6 py-14">
          <SectionHeader title="About switching tariff" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "Can I change tariff without changing supplier?",
                  answer:
                    "Yes, and it takes effect from the next meter reading. Ring or send a reading with a note. There is no charge and no new credit check.",
                },
                {
                  question: "Is the exit fee per fuel or per account?",
                  answer:
                    "Per fuel. Leaving a dual-fuel fixed account early is two exit fees, which is the bit that surprises people, so it is written here rather than in the terms.",
                },
                {
                  question: "Why is the off-peak standing charge higher?",
                  answer:
                    "It needs a different meter and the network charges more for it. Below about 4,000 kWh a year the extra daily cost eats the cheap night rate entirely.",
                },
              ]}
            />
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            <a className="underline underline-offset-4" href="/">Back to the comparison</a>
            {" · "}
            <a className="underline underline-offset-4" href="/meter">Send a meter reading</a>
          </p>
        </div>
      </section>
    </SiteChrome>
  );
}
