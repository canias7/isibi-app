// broadband /packages — the full price list, including the two packages that
// are closing. A tariff that is no longer sold still has people on it, and a
// site that deletes it leaves them unable to find out what they are paying for.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { BundleRow } from "@/components/ui/bundle-row";
import { PlanCard } from "@/components/ui/plan-card";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/packages")({ component: P });

function P() {
  return (
    <SiteChrome
      name="Ewden Fibre"
      tagline="Every package, and the price after the offer runs out."
      links={[
        { label: "Check an address", href: "/" },
        { label: "Switching", href: "/switching" },
      ]}
      action={{ label: "Check my address", href: "/" }}
    >
      <section className="border-b border-border">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <SectionHeader
            eyebrow="Residential"
            title="Four packages, no bundles you did not ask for"
            description="No television, no mobile, no insurance attached to the bill. A connection is what we sell."
          />
          <ul className="mt-8 grid gap-4">
            <BundleRow
              name="Full fibre 900"
              parts={[
                { id: "l", what: "900 Mb down and 900 Mb up" },
                { id: "r", what: "Router included, yours to keep" },
                { id: "s", what: "Static IP", optional: true },
              ]}
              monthlyPrice={44}
              offerMonths={6}
              priceAfterOffer={54}
              contractMonths={18}
            />
            <BundleRow
              name="Full fibre 500"
              parts={[{ id: "l", what: "500 Mb down and up" }, { id: "r", what: "Router included" }]}
              monthlyPrice={32}
              offerMonths={6}
              priceAfterOffer={38}
              contractMonths={18}
            />
            <BundleRow
              name="Full fibre 150"
              parts={[{ id: "l", what: "150 Mb down and up" }, { id: "r", what: "Router included" }]}
              monthlyPrice={25}
              contractMonths={12}
            />
            <BundleRow
              name="Copper 67"
              parts={[{ id: "l", what: "Up to 67 Mb down, 18 Mb up" }, { id: "p", what: "Keeps the existing analogue line" }]}
              monthlyPrice={26}
              contractMonths={12}
            />
          </ul>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <SectionHeader
            eyebrow="Business"
            title="Priced per address, because they genuinely differ"
            description="A leased line is a dig and a contract, not a package. These are the two shapes; the number comes after a survey."
          />
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <PlanCard
              name="Business fibre"
              price="From £79"
              period="month"
              action={{ label: "Ask for a survey", href: "/switching" }}
            />
            <PlanCard
              name="Leased line, 1 Gb symmetric"
              price="From £340"
              period="month"
              action={{ label: "Ask for a survey", href: "/switching" }}
            />
          </div>
          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Both come with a six-hour fix commitment and a named engineer rather than a call
            centre. The leased line is a dedicated fibre — nothing else on it, ever, which is what
            the price is for.
          </p>
        </div>
      </section>

      {/* CLOSED PACKAGES STAY ON THE PAGE. People are still on them and still
          paying; deleting the row is how somebody ends up unable to find out
          what their own tariff is. */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <SectionHeader
            eyebrow="No longer sold"
            title="Two packages we closed, kept here for the people on them"
            description="If you are on one of these you can stay. Nothing changes unless you ask, and moving to a current package is free."
          />
          <ul className="mt-8 grid gap-4">
            <BundleRow
              name="Fibre 300 (closed March 2025)"
              parts={[{ id: "l", what: "300 Mb down, 50 Mb up" }]}
              monthlyPrice={30}
              contractMonths={0}
            />
            <BundleRow
              name="Valley Starter (closed 2023)"
              parts={[{ id: "l", what: "40 Mb down, 10 Mb up" }]}
              monthlyPrice={22}
              contractMonths={0}
            />
          </ul>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-3xl px-6 py-14">
          <SectionHeader title="About the prices" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "Do prices rise with inflation each April?",
                  answer:
                    "No. There is no mid-contract increase clause of any kind. The only change is the step from the offer price to the standard price, on the date printed on your package.",
                },
                {
                  question: "Is there a discount for paying annually?",
                  answer: "One month free on a twelve-month prepayment. It is the only discount we do and it is available on every package.",
                },
                {
                  question: "What if the speed does not turn up?",
                  answer:
                    "We measure at the router for the first fortnight. If it is under 80% of the package for a week and we cannot fix it, you drop to the package below at that price, backdated.",
                },
              ]}
            />
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            <a className="underline underline-offset-4" href="/">Check what your address can have</a>
            {" · "}
            <a className="underline underline-offset-4" href="/switching">Switching from another provider</a>
          </p>
        </div>
      </section>
    </SiteChrome>
  );
}
