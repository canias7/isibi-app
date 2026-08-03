// insurance /cover — one level in full: every limit, the excess by claim type,
// and the summary row a customer would actually hold.
//
// The sub-limits are the content. "£12,000 a year" with "£800 of it for
// dental" and "£1,000 for behaviour" underneath is three facts, and a policy
// page that prints only the first is describing a policy nobody has.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { CoverLevel } from "@/components/ui/cover-level";
import { ExcessNote } from "@/components/ui/excess-note";
import { PolicySummaryRow } from "@/components/ui/policy-summary-row";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/cover")({ component: P });

function P() {
  return (
    <SiteChrome
      name="Rivelin Pet Cover"
      tagline="Complete, in full. Every limit and every sub-limit."
      links={[
        { label: "Compare levels", href: "#/" },
        { label: "Claiming", href: "#/claim" },
      ]}
      action={{ label: "Compare levels", href: "#/" }}
    >
      <div className="mx-auto max-w-4xl px-6 py-14">
        <h1 className="text-4xl font-semibold tracking-tight text-balance">Complete, in full</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          The annual limit is £12,000 and it is per condition rather than shared. What follows is
          every sub-limit inside it, because the headline figure on its own describes a policy that
          does not exist.
        </p>

        <section className="mt-12">
          <SectionHeader eyebrow="Vet fees" title="What the £12,000 covers" />
          <div className="mt-6">
            <CoverLevel
              lines={[
                { id: "cons", what: "Consultations, diagnosis and treatment", covered: true, limit: "£12,000 a year", subLimit: "Per condition, for life" },
                { id: "surg", what: "Surgery and hospitalisation", covered: true, limit: "Within the annual limit" },
                { id: "diag", what: "MRI, CT and specialist referral", covered: true, limit: "Within the annual limit", note: "Referral by your own vet required first" },
                { id: "meds", what: "Prescribed medication", covered: true, limit: "Within the annual limit" },
                { id: "physio", what: "Physiotherapy and hydrotherapy", covered: true, limit: "£1,500 a year", note: "On a vet's referral" },
                { id: "dent", what: "Dental treatment", covered: true, limit: "£800 a year", subLimit: "Requires a check-up in the previous 12 months" },
                { id: "behave", what: "Behavioural treatment", covered: true, limit: "£1,000 a year", note: "By a member of the ABTC register" },
                { id: "alt", what: "Acupuncture and herbal treatment", covered: false, note: "Not covered at any level" },
              ]}
            />
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader eyebrow="Everything else" title="Beyond the vet" />
          <div className="mt-6">
            <CoverLevel
              lines={[
                { id: "death", what: "Death from illness or injury", covered: true, limit: "Purchase price or £2,000, whichever is lower" },
                { id: "theft", what: "Theft or straying", covered: true, limit: "£2,000", note: "Advertising and reward costs included up to £500" },
                { id: "third", what: "Third-party liability", covered: true, limit: "£2m", note: "Dogs only — cats cannot be liable in law" },
                { id: "board", what: "Boarding fees if you are hospitalised", covered: true, limit: "£1,500", note: "After four consecutive nights" },
                { id: "travel", what: "Overseas cover", covered: true, limit: "90 days a year", subLimit: "EU and approved countries; an animal health certificate is required" },
                { id: "cancel", what: "Holiday cancellation for the animal's illness", covered: false },
                { id: "breed", what: "Anything arising from breeding", covered: false },
              ]}
            />
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader
            eyebrow="Excess"
            title="What you pay on a claim"
            description="It is per condition per policy year, not per claim — so a long illness treated across eight visits carries one excess, not eight."
          />
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <ExcessNote
              compulsory={99}
              voluntary={0}
              forThisClaimType={99}
              claimTypeLabel="Vet fees, animal under 9"
              estimatedLoss={1240}
              affectsNoClaims={false}
            />
            <ExcessNote
              compulsory={99}
              voluntary={0}
              forThisClaimType={347}
              claimTypeLabel="Vet fees, animal 9 or over"
              estimatedLoss={1240}
              affectsNoClaims={false}
            />
          </div>
          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            The second figure is the £99 plus a 20% co-payment on the balance. Every pet insurer in
            Britain does this and almost none of them show it before the renewal in which it starts.
          </p>
        </section>

        <section className="mt-14">
          <SectionHeader eyebrow="On paper" title="What your policy summary will look like" />
          <ul className="mt-6">
            <PolicySummaryRow
              product="Complete — lifetime pet cover"
              insures="Nell, border collie, born March 2021"
              number="RPC-4418-2207"
              inForce
              startsOn="2026-03-14"
              renewsOn="2027-03-14"
              premium={347}
              premiumPeriod="a year"
              autoRenews
              documentNote="The full wording, the schedule and the IPID are posted on purchase and are in your account within an hour."
            />
          </ul>
        </section>

        <section className="mt-14">
          <SectionHeader title="Cover questions" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "What does 'per condition' actually mean?",
                  answer:
                    "Each separate illness or injury gets its own £12,000, and it does not reset or run out at renewal. A dog on lifelong arthritis medication is covered for it every year, which is the entire reason to buy lifetime cover.",
                },
                {
                  question: "If I miss a payment, does cover just resume?",
                  answer:
                    "A lapse of more than 30 days ends the policy, and anything treated in that gap becomes pre-existing on the new one. It is the most expensive administrative mistake available here.",
                },
                {
                  question: "Is the dental check-up condition really enforced?",
                  answer:
                    "Yes, and it is the most common reason we decline. Any dated record from any vet satisfies it. Book one.",
                },
              ]}
            />
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            <a className="underline underline-offset-4" href="#/">Compare the two levels</a>
            {" · "}
            <a className="underline underline-offset-4" href="#/claim">How claiming works</a>
          </p>
        </section>
      </div>
    </SiteChrome>
  );
}
