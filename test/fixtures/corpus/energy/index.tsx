// energy — TARIFF-FIRST: the tariff table IS the page, because a bill is the
// only thing anybody is really comparing.
//
// THE STANDING CHARGE IS SHOWN SEPARATELY, never folded into an annual
// estimate. A low unit rate with a high daily charge is the standard trick,
// and it hurts precisely the households that use least — a flat that leaves
// the heating off all winter still pays the standing charge every day. An
// "estimated £1,240 a year" headline hides which of the two numbers is doing
// the damage.
//
// And every estimate states the usage it assumes. Without that it is not an
// estimate, it is a number wearing the costume of one.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { AnnouncementBar } from "@/components/ui/announcement-bar";
import { TariffRow } from "@/components/ui/tariff-row";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/")({ component: P });

function P() {
  return (
    <SiteChrome
      name="Loxley Community Energy"
      tagline="A supply co-op for the Loxley and Rivelin valleys. No shareholders."
      links={[
        { label: "All tariffs", href: "/tariffs" },
        { label: "Send a reading", href: "/meter" },
        { label: "Questions", href: "#questions" },
      ]}
      action={{ label: "Send a reading", href: "/meter" }}
    >
      <AnnouncementBar>
        Price cap change on 1 October. Everyone on Valley Variable moves with it — we will write
        with your new figures a fortnight before, and fixed tariffs are unaffected.
      </AnnouncementBar>

      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid items-start gap-12 lg:grid-cols-[1fr_1.25fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Electricity · Gas · 4,100 members
              </p>
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">
                The standing charge, separately
              </h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                Every tariff here shows the daily charge apart from the unit rate, because folding
                them together hides which one is costing you. A low unit rate with a high daily
                charge is a worse deal for a small household and a better one for a large one, and
                you cannot tell from a single annual figure.
              </p>
              <p className="mt-4 max-w-lg leading-relaxed text-muted-foreground">
                The annual estimates below assume 2,700&nbsp;kWh of electricity — the Ofgem medium
                figure. Yours is on your last bill; use that instead if you have it.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <a className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" href="/tariffs">
                  Compare every tariff
                </a>
                <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="/meter">
                  Send a meter reading
                </a>
              </div>
            </div>

            <ul className="grid gap-4">
              <TariffRow
                name="Valley Fixed 24"
                unitRates={[{ id: "e", label: "Electricity", pencePerUnit: 24.1 }]}
                standingChargePence={41.2}
                estimateAt={2700}
                estimateAnnual={761}
                endsOn="2028-09-30"
                exitFee={30}
              />
              <TariffRow
                name="Valley Variable"
                unitRates={[{ id: "e", label: "Electricity", pencePerUnit: 25.8 }]}
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
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <SectionHeader
            eyebrow="Which one"
            title="Three sentences, and then it is obvious"
            description="We would rather you were on the right one than the expensive one, because you are a member and not a customer."
          />
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">Take the fixed one</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                if a predictable bill matters more to you than the chance of a small saving. It is
                currently a little cheaper than variable, which is not always true.
              </p>
            </div>
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">Take the variable one</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                if you expect to move within the year, or you would rather follow the cap down when
                it falls. There is no exit fee, ever.
              </p>
            </div>
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">Take the off-peak one</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                only if you have storage heaters or charge a car overnight. Without one of those the
                day rate makes it the worst of the three by some distance.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="questions">
        <div className="mx-auto max-w-3xl px-6 py-14">
          <SectionHeader title="What members ask" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "Why is the standing charge there at all?",
                  answer:
                    "It pays for the wires and the meter whether or not you use anything. We cannot remove it — it is set by the network operator and passed through at cost. What we can do is show it to you.",
                },
                {
                  question: "What happens when my fixed tariff ends?",
                  answer:
                    "You move to Valley Variable and we write six weeks beforehand. Nobody is rolled onto a worse fixed deal automatically; that practice is the reason this co-op exists.",
                },
                {
                  question: "Do you actually generate anything?",
                  answer:
                    "Two hydro schemes on the Loxley and a roof array on the leisure centre — about 11% of what members use. The rest is bought on the wholesale market like everyone else, and we say so.",
                },
                {
                  question: "I am struggling to pay. What now?",
                  answer:
                    "Ring 0114 288 7010 and ask for the hardship team. There is a fund, it is real money, and using it does not affect your supply or go on any record.",
                },
              ]}
            />
          </div>
        </div>
      </section>
    </SiteChrome>
  );
}
