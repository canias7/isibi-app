// bank /save — the savings accounts, each with its withdrawal limits stated in
// the row rather than under it.
//
// NO BONUS RATES ANYWHERE, and the page says so as a policy rather than as a
// boast. An account paying 4.6% for twelve months and 1.1% after it is the
// single most common shape in retail savings, and it works because people do
// not move. Refusing to do it is worth a paragraph.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { InterestRates } from "@/components/ui/interest-rates";
import { ChecklistDot } from "@/components/ui/checklist-dot";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/save")({ component: P });

function P() {
  return (
    <SiteChrome
      name="Sheffield Steel Credit Union"
      tagline="Four savings accounts. None of them steps down after a year."
      links={[
        { label: "Rates", href: "#/" },
        { label: "Borrow", href: "#/borrow" },
        { label: "Join", href: "#/join" },
      ]}
      action={{ label: "Apply to join", href: "#/join" }}
    >
      <div className="mx-auto max-w-5xl px-6 py-14">
        <h1 className="text-4xl font-semibold tracking-tight text-balance">Saving</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          The rate you open an account on is the rate it stays on. We do not run introductory
          bonuses, because an account designed to be good for twelve months is an account designed
          to be forgotten about in the thirteenth.
        </p>

        <section className="mt-12">
          <SectionHeader eyebrow="The accounts" title="Four, and what each restricts" />
          <div className="mt-6">
            <InterestRates
              rates={[
                {
                  name: "Regular Saver",
                  rate: "4.10%", basis: "AER",
                  range: "£10 to £250 a month",
                  conditions: [
                    "Instant access, no limit on withdrawals.",
                    "Rate is reviewed at the AGM by members, not by a pricing team.",
                  ],
                },
                {
                  name: "Christmas Saver",
                  rate: "3.20%", basis: "AER",
                  range: "£5 to £100 a month",
                  conditions: [
                    "One withdrawal a year, released in the first week of November.",
                    "The restriction is the entire point — it is why the money is still there in December.",
                  ],
                },
                {
                  name: "Junior Saver",
                  rate: "4.40%", basis: "AER",
                  range: "Under 18s · up to £5,000",
                  conditions: [
                    "Instant access, held by an adult member until sixteen.",
                    "Our highest rate, deliberately.",
                  ],
                },
                {
                  name: "Share Account",
                  rate: "1.40%", basis: "gross",
                  conditions: [
                    "Paid as a dividend after the year end, so the figure is last year's actual.",
                    "This is the account that makes you a member and gives you a vote.",
                  ],
                },
              ]}
              caption="Dividend rates are declared at the AGM and cannot be promised in advance — the 1.40% above is what was actually paid for the year to September 2025."
            />
          </div>
        </section>

        <section className="mt-14">
          <div className="grid items-start gap-10 lg:grid-cols-[1.2fr_1fr]">
            <div>
              <SectionHeader
                eyebrow="Protection"
                title="The same cover as a high-street bank"
                description="Not a similar scheme, not an equivalent — the same one, on the same terms."
              />
              <ul className="mt-6 space-y-3 text-sm leading-relaxed text-muted-foreground">
                <li>Protected by the FSCS to £85,000 per person, per institution.</li>
                <li>Authorised by the Prudential Regulation Authority, firm reference 213573.</li>
                <li>Regulated by the PRA and the Financial Conduct Authority.</li>
                <li>Accounts are examined by an external auditor and published each March.</li>
              </ul>
            </div>
            <div className="rounded-xl border border-border p-6">
              <p className="text-sm font-medium">Opening an account</p>
              <p className="mt-2 text-sm text-muted-foreground">Four steps, about ten minutes at the counter.</p>
              <div className="mt-4">
                <ChecklistDot done={1} total={4} />
              </div>
              <ol className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li>1. Check you live or work in a Sheffield postcode</li>
                <li>2. Bring photo ID and proof of address</li>
                <li>3. Open a Share Account with £5</li>
                <li>4. Set up a standing order or payroll deduction</li>
              </ol>
              <a className="mt-5 inline-block text-sm underline underline-offset-4" href="#/join">
                What counts as proof
              </a>
            </div>
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader title="Saving questions" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "Is the interest taxed?",
                  answer:
                    "A credit union dividend is paid gross and counts towards your Personal Savings Allowance — £1,000 for a basic-rate taxpayer. Almost nobody here goes near that.",
                },
                {
                  question: "Can I take my money out whenever I like?",
                  answer:
                    "From the Regular and Junior accounts, yes, same day at the counter or next day by transfer. The Christmas account is once a year and that is deliberate. A Share Account balance can be withdrawn unless it secures a loan.",
                },
                {
                  question: "Why is the Junior rate the highest?",
                  answer:
                    "Because the members voted for it. It costs us very little and it is the account most likely to still be open in twenty years.",
                },
                {
                  question: "What happens to my savings if I have a loan?",
                  answer:
                    "They stay yours and keep earning. They can be offset against a loan in default, and we would always ask you first — it is in the agreement and we would rather you knew now than then.",
                },
              ]}
            />
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            <a className="underline underline-offset-4" href="#/">All rates</a>
            {" · "}
            <a className="underline underline-offset-4" href="#/borrow">Borrowing</a>
          </p>
        </section>
      </div>
    </SiteChrome>
  );
}
