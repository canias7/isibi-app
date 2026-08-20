// charity /impact — where last year's money went, including the part that did
// not work. A page that only reports successes is not evidence, it is a leaflet.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { ImpactStats } from "@/components/ui/impact-stat";
import { SafeImage } from "@/components/ui/safe-image";
import { SectionHeader } from "@/components/ui/section-header";
import { Testimonial } from "@/components/ui/testimonial";
export const Route = createFileRoute("/impact")({ component: P });
function P() {
  return (
    <SiteChrome name="The Loxley Larder" tagline="A food bank and community kitchen in Walkley."
      links={[{ label: "Home", href: "/" }, { label: "Give", href: "/donate" }]}
      action={{ label: "Donate", href: "/donate" }}>
      <div className="mx-auto max-w-5xl px-6 py-14">
        <SectionHeader eyebrow="2025" title="Where the money went"
          description="Audited and filed. The full accounts are on the Charity Commission's register under 1194732." />
        <ImpactStats className="mt-10" items={[
          { value: "14,200", meaning: "Hot meals served in the community kitchen.", period: "2025", source: "Kitchen log" },
          { value: "3,180", meaning: "Food parcels, to 620 different households.", period: "2025", source: "Referral records" },
          { value: "£1.9m", meaning: "Of surplus food redistributed rather than binned.", period: "2025", source: "FareShare returns" },
        ]} />
        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="The money" title="Where each pound went" />
          <ul className="mt-6 divide-y divide-border border-y border-border">
            {[
              ["Food bought to fill gaps", "£64,200", "52p"],
              ["The building — rent, gas, electric", "£28,900", "23p"],
              ["The van, fuel and insurance", "£17,400", "14p"],
              ["Equipment and repairs", "£7,100", "6p"],
              ["Insurance, audit and admin", "£6,300", "5p"],
            ].map(([what, amount, share]) => (
              <li key={what} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3.5">
                <span className="min-w-0 flex-1 text-sm font-medium">{what}</span>
                <span className="w-24 shrink-0 text-end text-sm tabular-nums">{amount}</span>
                <span className="w-16 shrink-0 text-end text-sm tabular-nums text-muted-foreground">{share}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-muted-foreground">
            Total expenditure £123,900. Income £131,400, of which £46,000 was regular giving — the part we
            can plan around.
          </p>
        </section>
        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="Honestly" title="What did not work" />
          <div className="mt-6 space-y-4 text-base leading-relaxed text-muted-foreground">
            <p>
              The Saturday session closed in June. We could not staff it reliably and a food bank that is
              sometimes open is worse than one that is predictably shut — people made journeys for nothing.
            </p>
            <p>
              The cookery classes reached eleven people across two terms against a target of sixty. We
              overestimated how much spare evening a household in crisis has, which in hindsight was obvious.
            </p>
            <p>
              We also spent £3,100 on a walk-in fridge that failed inside the warranty period and took four
              months to replace. The money came back; the four months did not.
            </p>
          </div>
        </section>
        <div className="mt-14 grid gap-8 border-t border-border pt-10 md:grid-cols-2">
          <SafeImage src={null} alt="The Tuesday session, about half eleven" ratio="4/3" />
          <Testimonial className="self-center" item={{ quote: "Nobody asked me for a letter, or a reason, or a form. That is the bit I tell people about.", name: "Anonymous", role: "Tuesday visitor, quoted with permission" }} />
        </div>
      </div>
    </SiteChrome>
  );
}
