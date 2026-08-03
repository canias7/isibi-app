// solar — SAVINGS-CALCULATOR-FIRST, and the estimate is a BAND rather than a
// figure.
//
// A SINGLE NUMBER IMPLIES A PRECISION NO SURVEY HAS. "You will save £847 a
// year" is the standard and it is fiction — the real answer depends on the
// roof pitch, the shading, how much of the day the house is occupied and where
// electricity prices go. A band with its assumptions printed is both more
// honest and more persuasive, because somebody can see we are not hiding the
// range.
import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { CalculatorCard } from "@/components/ui/calculator-card";
import { EstimateBand } from "@/components/ui/estimate-band";
import { MediaGrid } from "@/components/ui/media-grid";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/")({ component: P });

function P() {
  const [v, setV] = React.useState<Record<string, number>>({ roof: 24, bill: 145, home: 40 });
  // Deliberately crude, and the footnote says so. A calculator implying more
  // precision than the inputs support is the thing this page exists to avoid.
  const kwp = Math.round((v.roof / 6) * 10) / 10;
  const annual = Math.round(kwp * 850 * (0.28 + (v.home / 100) * 0.35));
  return (
    <SiteChrome
      name="Rivelin Renewables"
      tagline="Solar, batteries and heat pumps across South Yorkshire. MCS certified."
      links={[
        { label: "How it works", href: "#/how-it-works" },
        { label: "Book a survey", href: "#/survey" },
        { label: "Questions", href: "#questions" },
      ]}
      action={{ label: "Book a survey", href: "#/survey" }}
    >
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid items-start gap-14 lg:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                MCS 0087214 · RECC member · Installing since 2011
              </p>
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">
                A range, not a number
              </h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                Anybody quoting you a precise annual saving before standing on your roof is making
                it up. What it actually depends on is pitch, shading, and how much of the day
                somebody is in — and the last of those is the one that moves it most.
              </p>
              <p className="mt-4 max-w-lg leading-relaxed text-muted-foreground">
                So this gives a band, with the assumptions printed underneath. A survey narrows it;
                nothing makes it a single figure.
              </p>
            </div>

            <div className="space-y-6">
              <CalculatorCard
                title="A rough idea"
                fields={[
                  { key: "roof", label: "Usable south-ish roof", min: 6, max: 60, step: 2, unit: "m²" },
                  { key: "bill", label: "Current electricity bill", min: 40, max: 400, step: 5, unit: "£ a month" },
                  { key: "home", label: "Daytime occupancy", min: 0, max: 100, step: 10, unit: "% of weekdays" },
                ]}
                values={v}
                onChange={(k, n) => setV((s) => ({ ...s, [k]: n }))}
                result={{
                  label: "Rough annual saving",
                  value: `about £${annual}`,
                  note: `Roughly a ${kwp} kWp system. The band below is the honest version of this number.`,
                }}
                footnote="Assumes 850 kWh per kWp a year for this latitude, 28p a unit, and that you use a share of what you generate rather than exporting it all. Every one of those will be wrong for you by some amount."
              />
              <EstimateBand
                low={Math.round(annual * 0.65)}
                high={Math.round(annual * 1.3)}
                value={annual}
                min={0}
                max={Math.round(annual * 1.8)}
                label="Where it realistically lands"
                unit="£"
                suffix="a year"
              />
            </div>
          </div>
        </div>
      </section>

      {/* A REAL ROOF IN THIS CITY, NOT A RENDER OF A VILLA. Almost every
          solar site uses stock photography of a detached house in California,
          and the customer's actual question is whether it will look wrong on a
          Victorian terrace in Walkley. Naming the STREET is what makes it
          checkable — somebody can go and look at it, and several people have. */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <MediaGrid
            columns={4}
            ratio="4/3"
            items={[
              { src: null, alt: "A Walkley terrace roof with ten all-black panels, viewed from the street", caption: "Walkley, 4.0 kWp. Taken from the pavement, not from a drone." },
              { src: null, alt: "The same roof from the back garden, panels flush to the slate", caption: "In-roof on the rear slope. Flush, because the slate came off anyway." },
              { src: null, alt: "An inverter and battery mounted in a garage, cables trunked and labelled", caption: "The inverter and a 5kWh battery. This is where it all ends up." },
              { src: null, alt: "A shaded roof with a chimney and a dormer, panels avoiding both", caption: "The awkward one. A chimney is why a survey beats a satellite photo." },
            ]}
          />
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <SectionHeader
            eyebrow="Payback"
            title="Seven to twelve years, and we will not narrow it further"
            description="On a typical £7,400 install. The spread is real and it is mostly about whether anybody is in during the day — a household out from eight until six is at the slow end of it."
          />
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">Faster, 7 to 9 years</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Somebody home in the day, an unshaded south roof, an electric car charged at home,
                or a heat pump already fitted.
              </p>
            </div>
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">Typical, 9 to 11 years</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                An east-west roof, a household out on weekdays, no battery. This is where most of
                the installs we do actually land.
              </p>
            </div>
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">Slower, 11 to 14 years</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Heavy shading, a north-facing element, or a small roof. Still worth doing on a
                25-year panel warranty — but we will say which one you are.
              </p>
            </div>
          </div>
          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            A battery adds about £4,000 and typically two years to the payback. It is bought for
            resilience and for cheap overnight rates rather than for the arithmetic, and we would
            rather say so than sell one on a spreadsheet.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" href="#/survey">
              Book a free survey
            </a>
            <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="#/how-it-works">
              What the install involves
            </a>
          </div>
        </div>
      </section>

      <section id="questions">
        <div className="mx-auto max-w-3xl px-6 py-14">
          <SectionHeader title="Before you get a quote from anybody" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "Is it worth it at all in Sheffield?",
                  answer:
                    "Yes. This latitude gets about 850 kWh per kWp a year against roughly 950 on the south coast — around 11% less, not the half that people assume. Diffuse light works; panels do not need direct sun.",
                },
                {
                  question: "Do I need scaffolding, and is it in the price?",
                  answer:
                    "Yes and yes. Anybody quoting without scaffolding has either not looked at your house or is adding £900 later. It is in every figure we give you.",
                },
                {
                  question: "Will you turn a job down?",
                  answer:
                    "Regularly. A roof needing re-tiling within five years, heavy permanent shading, or a listed building where consent is unlikely. There is a list on the how-it-works page.",
                },
                {
                  question: "What about the 0% VAT?",
                  answer:
                    "It runs to March 2027 on solar, batteries and heat pumps, and it is already in our prices rather than presented as a discount. After that it returns to 5%.",
                },
              ]}
            />
          </div>
        </div>
      </section>
    </SiteChrome>
  );
}
