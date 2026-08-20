// debt-advice /options — what can actually be arranged, each with what it
// costs you AFTERWARDS.
//
// EVERY OPTION STATES ITS CREDIT-FILE CONSEQUENCE AND ITS DURATION, because
// those are the two facts a commercial debt company omits. "Write off up to
// 81% of your debt" is a real advert for an IVA and it does not mention the
// five years, the fee, the home, or the six-year mark on the file. Putting
// those in the same block as the benefit is the whole difference between
// advice and a lead-generation page.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { ChecklistDot } from "@/components/ui/checklist-dot";
import { ContactCard } from "@/components/ui/contact-card";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/options")({ component: P });

const OPTIONS = [
  {
    name: "A payment arrangement",
    who: "You can pay something each month and the debts are not enormous.",
    lasts: "Until it is paid",
    file: "No mark, provided the creditor agrees and you keep to it.",
    costs: "Nothing.",
    detail:
      "Creditors accept far lower offers than people expect, particularly with a budget sheet attached. This is what most first appointments end with and it is by some distance the least drastic thing on this page.",
  },
  {
    name: "Breathing space",
    who: "You need creditors to stop while something is sorted out.",
    lasts: "60 days, once a year",
    file: "No mark. It is recorded on a government register creditors can see, not on your credit file.",
    costs: "Nothing.",
    detail:
      "Interest, fees and enforcement all stop, legally. We apply for it — you cannot apply yourself. There is a longer version for anyone receiving mental-health crisis treatment, which lasts as long as the treatment does.",
  },
  {
    name: "A Debt Relief Order",
    who: "You owe under £50,000, have under £2,000 of assets, no home, and less than £75 a month spare.",
    lasts: "12 months, then written off",
    file: "Six years from the date it is made. Also on a public register.",
    costs: "Nothing — the £90 fee was abolished in 2024.",
    detail:
      "For a lot of the people who come here this is the right answer and nobody has ever mentioned it to them. The thresholds are strict and we check them properly rather than guess.",
  },
  {
    name: "An Individual Voluntary Arrangement",
    who: "You have a home to protect and enough income to pay something substantial for years.",
    lasts: "Five or six years",
    file: "Six years from the start. Public register. Failure part-way through leaves you worse off.",
    costs: "Fees of several thousand pounds, taken from your payments.",
    detail:
      "The one advertised relentlessly, because those fees are somebody's business model. It suits a minority of people genuinely well. We will tell you honestly whether you are one of them, and we do not receive a penny either way.",
  },
  {
    name: "Bankruptcy",
    who: "The debts cannot realistically be repaid and there is no other route.",
    lasts: "Usually discharged after 12 months",
    file: "Six years. Public register. A home with equity will normally be sold.",
    costs: "£680 to apply. There is a fund that can cover it and we will help you apply to it.",
    detail:
      "Far less catastrophic than its reputation, and for some people the fastest way back to a normal life. It does have serious consequences for homeowners and for a few occupations, and those come first in any conversation about it.",
  },
];

function P() {
  return (
    <SiteChrome
      name="Sheffield Money Advice"
      tagline="Five arrangements, and what each one costs you afterwards."
      links={[
        { label: "Start here", href: "/" },
        { label: "What to bring", href: "/" },
      ]}
      action={{ label: "Ring 0114 276 0500", href: "tel:01142760500" }}
    >
      <div className="mx-auto max-w-4xl px-6 py-14">
        <h1 className="text-4xl font-semibold tracking-tight text-balance">What can be arranged</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Five of them, in roughly the order we would consider them. Each one says how long it
          lasts, what it does to your credit file and what it costs — the three things a company
          selling you one will leave until after you have signed.
        </p>
        <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
          None of these should be chosen off a web page. They are here so that when somebody
          telephones you offering one, you already know what they are not telling you.
        </p>

        <section className="mt-12 space-y-8">
          {OPTIONS.map((o) => (
            <article key={o.name} className="rounded-xl border border-border p-6">
              <h2 className="text-lg font-semibold">{o.name}</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">{o.who}</p>
              <dl className="mt-5 grid gap-4 sm:grid-cols-3">
                <div>
                  <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">How long</dt>
                  <dd className="mt-1 text-sm">{o.lasts}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Credit file</dt>
                  <dd className="mt-1 text-sm">{o.file}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">What it costs</dt>
                  <dd className="mt-1 text-sm">{o.costs}</dd>
                </div>
              </dl>
              <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground">{o.detail}</p>
            </article>
          ))}
        </section>

        <section className="mt-14">
          <div className="grid items-start gap-10 lg:grid-cols-[1.15fr_1fr]">
            <div>
              <SectionHeader
                eyebrow="How we choose"
                title="It is a conversation, not a calculator"
                description="The right answer depends on whether you rent or own, what you expect to earn next year, and what you can live with. No web form knows any of that."
              />
              <p className="mt-5 max-w-lg text-sm leading-relaxed text-muted-foreground">
                We are required to tell you about every option that fits your circumstances, including
                the ones that earn nobody anything. That obligation is the difference between an
                FCA-authorised charity and an advert.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <a className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" href="tel:01142760500">
                  Ring 0114 276 0500
                </a>
                <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="/">
                  Back to the priority order
                </a>
              </div>
            </div>
            <div className="space-y-6">
              <div className="rounded-xl border border-border p-6">
                <p className="text-sm font-medium">Getting to a decision</p>
                <p className="mt-2 text-sm text-muted-foreground">Usually two appointments, sometimes three.</p>
                <div className="mt-4">
                  <ChecklistDot done={3} total={5} />
                </div>
              </div>
              <ContactCard
                address="Central Library, Surrey Street, Sheffield S1 1XZ"
                phone="0114 276 0500"
                email="advice@sheffieldmoney.org.uk"
              />
            </div>
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader title="Questions about the options" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "A company rang offering to write off most of my debt. Are they genuine?",
                  answer:
                    "They are usually selling an IVA, and their fee comes out of the payments you make. It is a real arrangement that suits some people. Ring us before agreeing to anything — we will tell you whether it fits, for nothing.",
                },
                {
                  question: "Will I lose my house?",
                  answer:
                    "Not through a payment arrangement, breathing space or a Debt Relief Order — a DRO is not available to homeowners at all. Bankruptcy can mean a sale where there is equity. This is precisely why the order of the conversation matters.",
                },
                {
                  question: "Can I do any of this myself?",
                  answer:
                    "A payment arrangement, yes, and plenty of people do. A DRO must go through an approved intermediary, which we have. Bankruptcy you apply for yourself online and we will sit with you while you do it.",
                },
                {
                  question: "What if my situation changes?",
                  answer:
                    "Every arrangement here can be revisited. Come back — a plan that fitted last year and does not fit now is a normal event, not a failure.",
                },
              ]}
            />
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
