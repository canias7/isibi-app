// insurance — COVER-LEVELS-FIRST: three levels as parallel cards, and the
// exclusions given equal weight to the inclusions.
//
// THE EXCLUSIONS DECIDE IT. Every insurance page in existence is a list of
// what is covered, and every complaint is about something that was not. The
// list of refusals is the more useful document and it belongs on the first
// screen, not behind "policy wording (PDF, 84 pages)".
//
// CARD-GRID structure, because three levels compared is a browsing job, not a
// reading one — and the differing lines have to sit at the same height.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { CoverLevel } from "@/components/ui/cover-level";
import { ExclusionList } from "@/components/ui/exclusion-list";
import { ExcessNote } from "@/components/ui/excess-note";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/")({ component: P });

const ESSENTIAL = [
  { id: "vet", what: "Vet fees", covered: true, limit: "£3,000 a year", subLimit: "Resets each renewal, not per condition" },
  { id: "death", what: "Death from illness or injury", covered: true, limit: "Purchase price" },
  { id: "third", what: "Third-party liability (dogs)", covered: true, limit: "£1m" },
  { id: "dental", what: "Dental treatment", covered: false, note: "Accidental damage only, and only on Complete" },
  { id: "behave", what: "Behavioural treatment", covered: false },
  { id: "travel", what: "Overseas cover", covered: false },
];

const COMPLETE = [
  { id: "vet", what: "Vet fees", covered: true, limit: "£12,000 a year", subLimit: "Per condition, for life" },
  { id: "death", what: "Death from illness or injury", covered: true, limit: "Purchase price or £2,000" },
  { id: "third", what: "Third-party liability (dogs)", covered: true, limit: "£2m" },
  { id: "dental", what: "Dental treatment", covered: true, limit: "£800 a year", note: "Annual check-up required, and this is the condition people miss" },
  { id: "behave", what: "Behavioural treatment", covered: true, limit: "£1,000 a year" },
  { id: "travel", what: "Overseas cover", covered: true, limit: "90 days a year, EU and approved countries" },
];

function P() {
  return (
    <SiteChrome
      name="Rivelin Pet Cover"
      tagline="Lifetime pet insurance from Sheffield. The exclusions are on the front page."
      links={[
        { label: "Cover in full", href: "/cover" },
        { label: "Claiming", href: "/claim" },
        { label: "Questions", href: "#questions" },
      ]}
      action={{ label: "Get a quote", href: "/cover" }}
    >
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Authorised and regulated by the FCA · Firm reference 704122
          </p>
          <h1 className="mt-3 max-w-3xl text-5xl font-semibold tracking-tight text-balance">
            What it does not cover, on the first page
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Two levels, side by side, with the lines that differ marked rather than left for you to
            spot. Then the exclusions — in situations, not clause numbers — because that is the
            list every complaint about pet insurance is really about.
          </p>

          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-border p-6">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-lg font-semibold">Essential</p>
                <p className="text-sm tabular-nums text-muted-foreground">from £11.40/month</p>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">Annual limit, resets at renewal.</p>
              <div className="mt-5">
                <CoverLevel lines={ESSENTIAL} />
              </div>
            </div>
            <div className="rounded-xl border-2 border-foreground p-6">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-lg font-semibold">Complete</p>
                <p className="text-sm tabular-nums text-muted-foreground">from £28.90/month</p>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">Per condition, for the animal's life.</p>
              <div className="mt-5">
                <CoverLevel lines={COMPLETE} />
              </div>
            </div>
          </div>

          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            "Per condition, for life" is the difference worth understanding: on Essential a chronic
            illness diagnosed this year stops being covered at the next renewal. On Complete it does
            not, for as long as the policy runs unbroken.
          </p>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-4xl px-6 py-14">
          <SectionHeader
            eyebrow="Refusals"
            title="What we will not pay for, in plain words"
            description="Written as situations rather than as clauses, because nobody has ever recognised their own circumstances in the phrase 'consequential loss'."
          />
          <div className="mt-8">
            <ExclusionList
              exclusions={[
                {
                  id: "pre", plain: "Anything the animal had before the policy started, or in the first 14 days", clause: "4.1 Pre-existing conditions", common: true,
                  liftedBy: "Two years clear of symptoms and treatment for that condition, on Complete only.",
                },
                {
                  id: "preg", plain: "Pregnancy, birth and anything arising from breeding", clause: "4.6 Breeding", common: true,
                },
                {
                  id: "prev", plain: "Routine care — vaccinations, worming, neutering, nail clipping", clause: "4.2 Preventative",
                  liftedBy: "Nothing. This is what the monthly cost would otherwise be, and we would rather keep the premium down.",
                },
                {
                  id: "dent", plain: "Dental work where there was no check-up in the previous 12 months", clause: "4.9 Dental", common: true,
                  liftedBy: "A dated check-up record from any vet.",
                },
                {
                  id: "work", plain: "Animals used for guarding, racing or any commercial purpose", clause: "4.11 Working animals",
                },
                {
                  id: "ban", plain: "Breeds listed under the Dangerous Dogs Act", clause: "4.12 Prohibited breeds",
                },
              ]}
              wordingNote="The full wording is eleven pages and we will post it before you buy if you ask. Nothing in it contradicts this list — that is what these clause numbers are for."
            />
          </div>
        </div>
      </section>

      {/* THE CLAIMS RECORD, WHICH IS THE ONLY QUESTION THAT MATTERS AND THE
          ONE NOBODY ANSWERS. An insurer is a promise to pay later, so the only
          evidence worth anything is how it paid last year: how many claims,
          how fast, how many refused, and — the number that never appears
          anywhere — what the refusals were FOR. This is what belongs where
          most insurers put a photograph of a family in a kitchen. */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-4xl px-6 py-14">
          <SectionHeader
            eyebrow="Last year, audited"
            title="What we actually paid, and what we did not"
            description="Twelve months to 31 March 2026. These are the FCA figures we file anyway, printed here rather than left in a return nobody reads."
          />
          <div className="mt-8 grid gap-6 sm:grid-cols-4">
            <div className="border-t border-foreground pt-4">
              <p className="text-3xl font-semibold tabular-nums">4,118</p>
              <p className="mt-1 text-sm text-muted-foreground">claims received</p>
            </div>
            <div className="border-t border-foreground pt-4">
              <p className="text-3xl font-semibold tabular-nums">93.4%</p>
              <p className="mt-1 text-sm text-muted-foreground">paid in full</p>
            </div>
            <div className="border-t border-foreground pt-4">
              <p className="text-3xl font-semibold tabular-nums">6 days</p>
              <p className="mt-1 text-sm text-muted-foreground">median, claim to payment</p>
            </div>
            <div className="border-t border-foreground pt-4">
              <p className="text-3xl font-semibold tabular-nums">£1,240</p>
              <p className="mt-1 text-sm text-muted-foreground">median amount paid</p>
            </div>
          </div>

          <p className="mt-10 text-sm font-medium">The 272 we refused, by reason</p>
          <ul className="mt-3 divide-y divide-border border-y border-border">
            {[
              { n: 164, why: "Pre-existing condition", note: "Symptoms recorded by a vet before the policy started or inside the 14-day wait. This is 60% of every refusal and it is why the vet history question matters." },
              { n: 48, why: "No dental check-up in the previous year", note: "Clause 4.9. Avoidable, and a dated check-up from any vet lifts it — we now write to remind people at ten months." },
              { n: 31, why: "Routine or preventative treatment", note: "Vaccination, worming, neutering. Never covered on any policy we sell and it is on the first page of the summary." },
              { n: 19, why: "Claim made after the 90-day window", note: "The one we most often overturn on appeal. If you are late, ring us — nine of these nineteen were paid in the end." },
              { n: 10, why: "Policy not in force on the date of treatment", note: "A lapsed direct debit, almost always. We write three times before a policy lapses." },
            ].map((r) => (
              <li key={r.why} className="grid gap-1 py-4 md:grid-cols-[4rem_minmax(0,16rem)_1fr] md:gap-6">
                <p className="text-lg font-semibold tabular-nums">{r.n}</p>
                <p className="text-sm font-medium">{r.why}</p>
                <p className="text-sm leading-relaxed text-muted-foreground">{r.note}</p>
              </li>
            ))}
          </ul>
          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Fourteen went to the Financial Ombudsman. Nine were decided in our favour, four against,
            one is open. We publish the four we lost because an insurer that has never lost a case
            is either perfect or is not counting.
          </p>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-4xl px-6 py-14">
          <SectionHeader
            eyebrow="The excess"
            title="Beside the cover it applies to"
            description="A single figure in a footer is how a claim becomes a complaint. Here is what a typical vet-fee claim actually looks like."
          />
          <div className="mt-8">
            <ExcessNote
              compulsory={99}
              voluntary={0}
              forThisClaimType={99}
              claimTypeLabel="Vet fees"
              estimatedLoss={1240}
              affectsNoClaims={false}
            />
          </div>
          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Over the age of nine a co-payment of 20% applies on top, on both levels. It is the
            single most common surprise in this market and it is the reason it is written here
            rather than at renewal.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" href="/cover">
              Cover in full
            </a>
            <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="/claim">
              How claiming works
            </a>
          </div>
        </div>
      </section>

      <section id="questions">
        <div className="mx-auto max-w-3xl px-6 py-14">
          <SectionHeader title="Before you buy" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "What counts as pre-existing?",
                  answer:
                    "Anything a vet has seen, treated or noted before cover began — including a symptom recorded without a diagnosis. If it is in the clinical history, assume it is excluded and ring us to check rather than find out at a claim.",
                },
                {
                  question: "Does the premium go up as the animal ages?",
                  answer:
                    "Yes, and steeply after eight. We publish the age bands rather than reveal them at renewal, because a lifetime policy you cannot afford in year nine is not lifetime cover.",
                },
                {
                  question: "Can I switch to you with an ongoing condition?",
                  answer:
                    "You can switch, but that condition will not be covered by us. That is true of every insurer and switching an animal mid-treatment is almost always the wrong move.",
                },
                {
                  question: "Do you pay the vet directly?",
                  answer:
                    "At around 200 practices in South Yorkshire, yes. Elsewhere you pay and we reimburse, usually within five working days of the invoice.",
                },
              ]}
            />
          </div>
        </div>
      </section>
    </SiteChrome>
  );
}
