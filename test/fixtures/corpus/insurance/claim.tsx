// insurance /claim — how a claim runs, stage by stage, with a real one shown
// including the week it sat waiting on us.
//
// THE WORKED EXAMPLE INCLUDES THE DELAY. A claim timeline with four tidy steps
// a day apart is marketing; the version with "waiting for clinical history —
// 9 days" is the one that sets an expectation somebody can plan around, and it
// is also the one that tells them which document to chase.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { ClaimTimeline } from "@/components/ui/claim-timeline";
import { ExcessNote } from "@/components/ui/excess-note";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/claim")({ component: P });

const STEPS = [
  {
    n: "1", what: "Treat the animal first",
    detail: "Do not wait for us. There is no pre-authorisation requirement on any policy we sell, and delaying treatment to check cover is never the right call.",
  },
  {
    n: "2", what: "Ask the practice whether they claim direct",
    detail: "About 200 practices in South Yorkshire do. If yours is one, you pay the excess and nothing else and the rest never touches your bank account.",
  },
  {
    n: "3", what: "Send the invoice and the clinical history together",
    detail: "The history is the part that holds claims up. Ask the practice to email it at the same time as the invoice — one request rather than two.",
  },
  {
    n: "4", what: "We assess it, and ring if anything is missing",
    detail: "Five working days when a claim is complete. We telephone rather than write, because a letter asking for a document costs a fortnight.",
  },
];

function P() {
  return (
    <SiteChrome
      name="Rivelin Pet Cover"
      tagline="Claiming — including the part where it waits on paperwork."
      links={[
        { label: "Compare levels", href: "/" },
        { label: "Cover in full", href: "/cover" },
      ]}
      action={{ label: "Start a claim", href: "#start" }}
    >
      <div className="mx-auto max-w-4xl px-6 py-14">
        <h1 className="text-4xl font-semibold tracking-tight text-balance">Claiming</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Treat the animal, then deal with us. There is no pre-authorisation on any policy we sell,
          so nothing here should ever come between a sick animal and a vet.
        </p>

        <section className="mt-12" id="start">
          <SectionHeader eyebrow="Four steps" title="In this order" />
          <ol className="mt-6 divide-y divide-border border-y border-border">
            {STEPS.map((s) => (
              <li key={s.n} className="flex gap-5 py-5">
                <span className="w-6 shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">{s.n}</span>
                <div className="min-w-0">
                  <p className="font-medium">{s.what}</p>
                  <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">{s.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-14">
          <SectionHeader
            eyebrow="A real one"
            title="Nell's cruciate surgery, start to finish"
            description="Nineteen days, nine of which were waiting on a clinical history. That is the honest shape of a claim and pretending otherwise helps nobody."
          />
          <div className="mt-8">
            <ClaimTimeline
              events={[
                { id: "1", on: "14 July", what: "Nell seen at Rivelin Valley Vets, referred for surgery", by: "you" },
                { id: "2", on: "16 July", what: "Claim started online, invoice attached", by: "you", gapDays: 2 },
                { id: "3", on: "17 July", what: "We asked the practice for the clinical history", by: "us", gapDays: 1 },
                { id: "4", on: "26 July", what: "History received", by: "third-party", gapDays: 9 },
                { id: "5", on: "29 July", what: "Assessed and approved — £2,140 less the £99 excess", by: "us", gapDays: 3 },
                { id: "6", on: "2 August", what: "£2,041 paid to the practice", by: "us", gapDays: 4 },
              ]}
            />
          </div>
          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            The nine-day gap is the only part of this you can shorten, and you can shorten it a lot
            by asking the practice to send the history with the invoice on day one.
          </p>
        </section>

        <section className="mt-14">
          <SectionHeader eyebrow="Still running" title="What an open claim looks like" />
          <div className="mt-8">
            <ClaimTimeline
              events={[
                { id: "1", on: "28 July", what: "Claim started — dental extraction, £610", by: "you" },
                { id: "2", on: "29 July", what: "We asked for the last dental check-up date", by: "us", gapDays: 1 },
              ]}
              openItem="Waiting on a dated dental check-up record from any vet"
              openSince="29 July"
            />
          </div>
          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            This is the most common hold-up we see. The check-up condition is on the policy page and
            it is still the thing that catches most people out.
          </p>
        </section>

        <section className="mt-14">
          <SectionHeader eyebrow="What you pay" title="On a typical claim" />
          <div className="mt-6">
            <ExcessNote
              compulsory={99}
              voluntary={0}
              forThisClaimType={99}
              claimTypeLabel="Vet fees, animal under 9"
              estimatedLoss={2140}
              affectsNoClaims={false}
            />
          </div>
          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Claiming does not affect a no-claims position because there is not one on pet cover.
            The premium rises with age regardless of whether you have ever claimed, and we would
            rather that were plain than implied.
          </p>
        </section>

        <section className="mt-14">
          <SectionHeader title="Claim questions" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "What if you turn the claim down?",
                  answer:
                    "You get the reason in writing with the clause it rests on, and you can ask a second assessor to look at it at no cost. After that the Financial Ombudsman Service is free and we abide by its decisions.",
                },
                {
                  question: "How long do I have to claim?",
                  answer: "Twelve months from the date of treatment. Sooner is better simply because clinical histories are easier to obtain.",
                },
                {
                  question: "Can I claim for treatment abroad?",
                  answer:
                    "On Complete, within the 90-day limit and in an approved country. Pay locally, keep everything, and send it translated if it is not in English — we will cover a reasonable translation cost.",
                },
              ]}
            />
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            <a className="underline underline-offset-4" href="/">Compare the levels</a>
            {" · "}
            <a className="underline underline-offset-4" href="/cover">Cover in full</a>
          </p>
        </section>
      </div>
    </SiteChrome>
  );
}
