// bank /borrow — the loans in full, with a repayment preview, and what
// actually happens when a payment is missed.
//
// THE MISSED-PAYMENT SECTION IS ON THE BORROWING PAGE, not buried in terms.
// Somebody deciding whether to borrow is deciding whether they can afford the
// bad month, and every lender that hides the answer is relying on them not
// asking.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { InterestRates } from "@/components/ui/interest-rates";
import { RepaymentPreview } from "@/components/ui/repayment-preview";
import { EligibilityCheck } from "@/components/ui/eligibility-check";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/borrow")({ component: P });

function P() {
  return (
    <SiteChrome
      name="Sheffield Steel Credit Union"
      tagline="What a loan costs, and what happens in a month you cannot pay."
      links={[
        { label: "Rates", href: "/" },
        { label: "Save", href: "/save" },
        { label: "Join", href: "/join" },
      ]}
      action={{ label: "Apply to join", href: "/join" }}
    >
      <div className="mx-auto max-w-5xl px-6 py-14">
        <h1 className="text-4xl font-semibold tracking-tight text-balance">Borrowing</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Four loans. No arrangement fee on any of them, no charge for settling early, and no
          penalty for a late payment — the only consequence is that it affects what you can
          borrow next.
        </p>

        <section className="mt-12">
          <SectionHeader eyebrow="The rates" title="Every loan we offer" />
          <div className="mt-6">
            <InterestRates
              rates={[
                {
                  name: "Member loan",
                  rate: "12.7%", basis: "APR",
                  range: "£500 to £7,500 · 1 to 5 years",
                  conditions: [
                    "Three months of saving with us first, any amount.",
                    "Repayment by standing order or payroll deduction.",
                  ],
                },
                {
                  name: "Established member loan",
                  rate: "8.9%", basis: "APR",
                  range: "£1,000 to £15,000 · 1 to 7 years",
                  conditions: [
                    "Two years of membership and a clean repayment history.",
                    "The lowest rate we offer, and it is not advertised anywhere else.",
                  ],
                },
                {
                  name: "Family loan",
                  rate: "26.8%", basis: "APR", representative: true,
                  range: "£300 to £1,000 · up to 18 months",
                  conditions: [
                    "For members receiving Child Benefit; no saving history needed.",
                    "Repaid direct from the benefit, so there is nothing to remember.",
                  ],
                },
                {
                  name: "Winter loan",
                  rate: "19.4%", basis: "APR",
                  range: "£100 to £750 · up to 12 months",
                  conditions: [
                    "October to January only.",
                    "Exists so that nobody in this city needs a doorstep lender in December.",
                  ],
                },
              ]}
            />
          </div>
        </section>

        <section className="mt-14">
          <div className="grid items-start gap-10 lg:grid-cols-[1fr_1fr]">
            <div>
              <SectionHeader
                eyebrow="Worked through"
                title="£3,000 over three years"
                description="On the member loan at 12.7% APR. The total repayable is the number worth looking at — the monthly figure alone tells you very little."
              />
              <p className="mt-5 max-w-lg text-sm leading-relaxed text-muted-foreground">
                Pay it off at any point and you pay no further interest, so the total below is a
                ceiling rather than a commitment. About a third of our borrowers settle early.
              </p>
            </div>
            <RepaymentPreview principal={3000} annualRatePercent={12.7} years={3} />
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader
            eyebrow="The month you cannot pay"
            title="What actually happens"
            description="Written here rather than in the agreement, because it is part of deciding whether to borrow at all."
          />
          <ul className="mt-6 divide-y divide-border border-y border-border">
            <li className="py-4">
              <p className="font-medium">There is no late fee</p>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Not a reduced one — none. Charging somebody for being short of money is how a
                difficult month becomes an impossible one.
              </p>
            </li>
            <li className="py-4">
              <p className="font-medium">We ring you, we do not write</p>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                A letter with a reference number is designed not to be opened. A person asking what
                happened usually ends with a payment arrangement in the same call.
              </p>
            </li>
            <li className="py-4">
              <p className="font-medium">A payment holiday is a normal request</p>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Up to two months, twice in the life of a loan. Interest still accrues and the term
                extends — we will show you both figures before you agree.
              </p>
            </li>
            <li className="py-4">
              <p className="font-medium">Your savings are not taken automatically</p>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                We can offset a defaulted loan against your shares and we will always ask first.
                It is in the agreement and we would rather you knew now.
              </p>
            </li>
          </ul>
        </section>

        <section className="mt-14">
          <SectionHeader eyebrow="Before applying" title="Whether we can lend to you" />
          <div className="mt-6 max-w-2xl">
            <EligibilityCheck
              criteria={[
                { id: "m", label: "You are a member", met: true, detail: "Joining first is the only hard requirement." },
                { id: "s", label: "Three months of saving", met: true, detail: "Waived on the Family and Winter loans." },
                { id: "a", label: "The repayment fits your budget", detail: "We work this out with you rather than from a formula. Bring a recent bank statement." },
                { id: "c", label: "A full credit search", detail: "Runs at application and does show on your file. We tell you before we run it." },
              ]}
              indicative
              applyNote="A refusal is explained in person and comes with what would change the answer. We are not able to lend to everybody and we would rather say why."
            />
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader title="Borrowing questions" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "Can I borrow more than I have saved?",
                  answer: "Yes — up to three times your shares on the member loan, and the established member loan has no such ratio at all.",
                },
                {
                  question: "How long does a decision take?",
                  answer: "Two working days for anything under £2,000, five for larger amounts because a person reads it rather than a system.",
                },
                {
                  question: "Do you lend to people with poor credit?",
                  answer:
                    "Often, yes. A default from four years ago matters much less to us than what the last six months look like. It is worth applying rather than assuming.",
                },
              ]}
            />
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            <a className="underline underline-offset-4" href="/">All rates</a>
            {" · "}
            <a className="underline underline-offset-4" href="/join">How to join</a>
          </p>
        </section>
      </div>
    </SiteChrome>
  );
}
