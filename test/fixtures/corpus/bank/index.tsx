// bank — RATES-FIRST: every rate on one page with its conditions in the same
// row, because the conditions ARE the product.
//
// A savings account paying 4.6% that drops to 1.1% after a year is a different
// account from one paying 4.4% flat, and the industry convention — headline in
// 48px, conditions in a footnote — describes the first as if it were the
// second. Everything here puts them together.
//
// SIDEBAR structure: the rail is the rate navigation, because somebody arrives
// wanting either to borrow or to save and those are two different pages of one
// table.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { InterestRates } from "@/components/ui/interest-rates";
import { EligibilityCheck } from "@/components/ui/eligibility-check";
import { SectionHeader } from "@/components/ui/section-header";
import { ContactCard } from "@/components/ui/contact-card";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/")({ component: P });

const NAV = [
  { href: "/borrow", label: "Borrowing", note: "Loans from £500 to £15,000" },
  { href: "/save", label: "Saving", note: "Four accounts, all instant access or better" },
  { href: "/join", label: "Joining", note: "Who can, and what to bring" },
];

function P() {
  return (
    <SiteChrome
      name="Sheffield Steel Credit Union"
      tagline="A member-owned lender for anyone who lives or works in S1–S36."
      links={[
        { label: "Borrow", href: "/borrow" },
        { label: "Save", href: "/save" },
        { label: "Join", href: "/join" },
      ]}
      action={{ label: "Apply to join", href: "/join" }}
    >
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 lg:grid-cols-[minmax(0,15rem)_1fr]">
        {/* The rail IS the rate navigation — borrow and save are two halves of
            one table and people arrive knowing which half they want. */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Rates</p>
          <nav className="mt-3 flex flex-col gap-1">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} className="rounded-md px-3 py-2 hover:bg-muted">
                <span className="block text-sm font-medium">{n.label}</span>
                <span className="block text-xs text-muted-foreground">{n.note}</span>
              </a>
            ))}
          </nav>
          <div className="mt-8">
            <ContactCard
              address="41 Division Street, Sheffield S1 4GF"
              phone="0114 276 0104"
              email="hello@steelcu.coop"
            />
          </div>
        </aside>

        <main className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Authorised by the PRA · Savings protected by the FSCS
          </p>
          <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">
            The conditions are in the row
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Not in a footnote, not behind a link marked "key facts". If an account limits you to
            three withdrawals a year, that sentence is next to the rate — because it is the thing
            that decides whether the rate is any good to you.
          </p>

          <section className="mt-12">
            <SectionHeader
              eyebrow="Borrowing"
              title="What a loan costs here"
              description="We are capped by law at 42.6% APR and we are well under it. Nobody is offered a worse rate than the one shown for their band."
            />
            <div className="mt-6">
              <InterestRates
                rates={[
                  {
                    name: "Member loan",
                    rate: "12.7%",
                    basis: "APR",
                    range: "£500 to £7,500 · 1 to 5 years",
                    conditions: [
                      "Three months of saving with us first, any amount.",
                      "No fee for paying it off early, ever.",
                    ],
                  },
                  {
                    name: "Family loan",
                    rate: "26.8%",
                    basis: "APR",
                    representative: true,
                    range: "£300 to £1,000 · up to 18 months",
                    conditions: [
                      "For members receiving Child Benefit. No saving history needed.",
                      "Repaid direct from benefit, so there is nothing to remember.",
                    ],
                  },
                ]}
                caption="Missing a payment does not incur a charge. It does affect what you can borrow next, and we will ring you rather than write."
              />
            </div>
            <a className="mt-5 inline-block text-sm underline underline-offset-4" href="/borrow">
              Every loan, with a repayment preview
            </a>
          </section>

          <section className="mt-14">
            <SectionHeader
              eyebrow="Saving"
              title="Four accounts, no bonus rates"
              description="No account here pays more for the first twelve months and then quietly less. That practice is why people distrust the whole sector."
            />
            <div className="mt-6">
              <InterestRates
                rates={[
                  {
                    name: "Regular Saver",
                    rate: "4.10%",
                    basis: "AER",
                    range: "£10 to £250 a month",
                    conditions: ["Instant access, no withdrawal limit.", "Rate does not step down after a year."],
                  },
                  {
                    name: "Christmas Saver",
                    rate: "3.20%",
                    basis: "AER",
                    conditions: ["One withdrawal a year, in November.", "That restriction is the point of the account."],
                  },
                ]}
              />
            </div>
            <a className="mt-5 inline-block text-sm underline underline-offset-4" href="/save">
              All four savings accounts
            </a>
          </section>

          <section className="mt-14">
            <SectionHeader eyebrow="Joining" title="Whether you can" />
            <div className="mt-6 max-w-2xl">
              <EligibilityCheck
                criteria={[
                  { id: "a", label: "You live or work in a Sheffield postcode", met: true, detail: "S1 through S36, including Stocksbridge and Chapeltown." },
                  { id: "b", label: "You are over 16", met: true },
                  { id: "c", label: "You can pay in at least £5 a month", met: true, detail: "Standing order, payroll deduction or cash at the counter." },
                  { id: "d", label: "You have proof of address from the last three months" },
                ]}
                indicative
                alternative="Outside Sheffield? Find your nearest union at findyourcreditunion.co.uk — we would rather send you there than take an application we must refuse."
                applyNote="Joining takes about ten minutes at the counter and there is no credit check to become a member."
              />
            </div>
            <a className="mt-5 inline-block text-sm underline underline-offset-4" href="/join">
              What to bring
            </a>
          </section>

          <section className="mt-14">
            <SectionHeader title="Questions members ask" />
            <div className="mt-6">
              <Faq
                items={[
                  {
                    question: "Is my money as safe as it would be in a bank?",
                    answer:
                      "Protected by the FSCS to £85,000 per person, exactly as at a high-street bank. We are regulated by the PRA and the FCA on the same basis.",
                  },
                  {
                    question: "What does member-owned actually mean for me?",
                    answer:
                      "One member, one vote at the AGM regardless of how much you hold, and any surplus comes back as a dividend rather than going to shareholders. Last year it was 1.4%.",
                  },
                  {
                    question: "Will applying hurt my credit score?",
                    answer:
                      "Joining does not touch it. A loan application is a full search and does show — we will tell you before we run one, so you can decide.",
                  },
                ]}
              />
            </div>
          </section>
        </main>
      </div>
    </SiteChrome>
  );
}
