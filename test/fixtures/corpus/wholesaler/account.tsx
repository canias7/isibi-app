// wholesaler /account — opening a trade account: what is needed, how long it
// takes, and what happens if credit is refused. The last one is the question
// nobody answers, and "refused" does not mean "cannot buy from us".
import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { BusyButton } from "@/components/ui/busy-button";
import { DownloadCard } from "@/components/ui/download-card";
import { Faq } from "@/components/ui/faq";
import { FormRow } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import { SectionHeader } from "@/components/ui/section-header";
import { SuccessPanel } from "@/components/ui/success-panel";
import { Textarea } from "@/components/ui/textarea";
import { TradeTerms } from "@/components/ui/trade-terms";
import { TERMS } from "./index";
export const Route = createFileRoute("/account")({ component: P });
function P() {
  const [company, setCompany] = React.useState("");
  const [vat, setVat] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [detail, setDetail] = React.useState("");
  const [sent, setSent] = React.useState(false);
  return (
    <SiteChrome name="Attercliffe Catering Supplies" tagline="Dry goods, chilled and disposables to independent kitchens across South Yorkshire."
      links={[{ label: "Home", href: "/" }, { label: "The range", href: "/range" }]}
      action={{ label: "Ring 0114 244 8810", href: "tel:01142448810" }}>

      <div className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="Open an account" title="Two working days, and four things"
          description="Then a pro forma first order while credit is checked, and thirty days after that. If credit comes back refused you can still buy — that is the part nobody tells you." />

        <section className="mt-10 grid gap-12 lg:grid-cols-[1fr_1fr]">
          <div>
            <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">What we need</h2>
            <ol className="mt-3 divide-y divide-border border-y border-border text-base">
              <li className="py-3.5">
                <span className="font-medium">A VAT number, or a food business registration</span>
                <span className="block text-sm text-muted-foreground">
                  Either is fine. A new business below the VAT threshold is not a problem and about
                  a third of the accounts opened last year were exactly that.
                </span>
              </li>
              <li className="py-3.5">
                <span className="font-medium">Two trade references</span>
                <span className="block text-sm text-muted-foreground">
                  Suppliers you already pay. If you have none because you have just started, say so
                  — it changes the terms, not the answer.
                </span>
              </li>
              <li className="py-3.5">
                <span className="font-medium">A delivery address we actually reach</span>
                <span className="block text-sm text-muted-foreground">
                  S, DN and part of HD, Tuesdays and Thursdays. Outside that, collection only, and
                  we will say so on the phone rather than after you have filled the form in.
                </span>
              </li>
              <li className="py-3.5">
                <span className="font-medium">Somebody's name for the invoices</span>
                <span className="block text-sm text-muted-foreground">
                  A person, not accounts@. Nine tenths of the chasing we do is because an invoice
                  went to an inbox nobody owns.
                </span>
              </li>
            </ol>

            <div className="mt-8 rounded-lg border border-border bg-muted/50 p-5">
              <p className="text-base font-medium">If credit is refused</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                You buy pro forma — pay before the van, same prices, same minimum, same delivery
                days. Nothing else changes, and we will re-run the credit check after six months
                without being asked. A refusal here is an agency's view of a company number, and it
                is very often about a business being eight months old rather than anything else.
              </p>
            </div>

            <div className="mt-8 space-y-3">
              <DownloadCard name="Account application.pdf" size={210_000}
                description="If you would rather do it on paper — post or bring it" />
              <DownloadCard name="Terms and conditions of sale.pdf" size={180_000}
                description="Four pages, and there is nothing clever in them" />
            </div>
          </div>

          <div>
            <TradeTerms {...TERMS} columns={2} heading="What you are signing up to"
              note="No annual fee, no rebate scheme, no minimum spend over a year and no notice to close. If we stop being useful, stop ordering." />

            <div className="mt-8">
              <SectionHeader eyebrow="Apply" title="Four fields, and we ring back" />
              {sent ? (
                <SuccessPanel className="mt-6" title="With us — you'll hear back within two working days"
                  description="Sooner if your references answer quickly. We ring rather than email, because half of these have a question in them that takes one sentence on the phone and four emails otherwise." />
              ) : (
                <div className="mt-6 space-y-4">
                  <FormRow label="Trading name" htmlFor="w-co" required>
                    <Input id="w-co" autoComplete="organization" value={company} onChange={(e) => setCompany(e.target.value)} />
                  </FormRow>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormRow label="VAT or food business reg." htmlFor="w-vat" required
                      hint="Either one. Not both.">
                      <Input id="w-vat" value={vat} onChange={(e) => setVat(e.target.value)} />
                    </FormRow>
                    <FormRow label="Email" htmlFor="w-em" required>
                      <Input id="w-em" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                    </FormRow>
                  </div>
                  <FormRow label="Where you are, and roughly what you would order" htmlFor="w-detail"
                    hint="Postcode is the important half — it decides which van you are on, or whether there is one.">
                    <Textarea id="w-detail" rows={6}
                      placeholder={"Café on Abbeydale Road, S7. Open six days, about 90 covers a day.\nMostly dry goods and disposables, maybe £250 a fortnight.\nTrade refs: Bookers, and the coffee roaster on Sidney Street."}
                      value={detail} onChange={(e) => setDetail(e.target.value)} />
                  </FormRow>
                  <BusyButton disabled={!company || !vat || !email} onClick={() => setSent(true)}>
                    Send the application
                  </BusyButton>
                  <p className="text-sm text-muted-foreground">
                    No card details, no direct debit mandate at this stage, and nothing is run
                    against your personal credit file — only the company's.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="max-w-3xl">
            <SectionHeader eyebrow="Asked often" title="About the account" />
            <Faq className="mt-6" items={[
              { question: "How long does approval take?", answer: "Two working days, and the delay is almost always a trade reference not answering. If it is urgent, collect on the first order and let the paperwork catch up." },
              { question: "Do you credit-check me personally?", answer: "No. The company only, and there is no personal guarantee on a thirty-day account of this size. If we ever needed one we would say so before you applied, not in a clause." },
              { question: "What credit limit will I get?", answer: "£1,000 to start on most new accounts, reviewed after three invoices. It goes up on its own if you pay on time; we do not make people ask." },
              { question: "Is there a minimum annual spend?", answer: "None. We have accounts that order twice a year and accounts that order twice a week and they are on identical terms." },
              { question: "Can I close the account?", answer: "Stop ordering. There is no notice period and no form. We will ring once after three months to ask if something went wrong, and that is the whole of it." },
              { question: "Do you sell to the public?", answer: "No. The packs are catering sizes and a 20 litre drum of oil helps almost nobody at home. It is not snobbery — it is that we would be selling you something you do not want." },
            ]} />
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
