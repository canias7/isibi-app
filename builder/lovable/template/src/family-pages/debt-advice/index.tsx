// debt-advice — URGENT-HELP-FIRST: a phone number before a form, and the
// priority order before anything else.
//
// NOTHING ON THIS PAGE ASKS FOR A DETAIL BEFORE IT HAS GIVEN SOMETHING. A
// contact form ahead of the advice is a door, and the person reading this has
// met enough doors. The single most valuable thing a free debt service knows
// — which creditor can take your home, ahead of whichever one is ringing you
// hardest — is free to publish and is the top of the page.
//
// No imagery of worried people, no colour, no urgency banner in red. The
// reader supplies the urgency; the page supplies the order to do things in.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { TriageBanner } from "@/components/ui/triage-banner";
import { PriorityDebts } from "@/components/ui/priority-debts";
import { ChecklistDot } from "@/components/ui/checklist-dot";
import { ContactCard } from "@/components/ui/contact-card";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/")({ component: P });

const DEBTS = [
  { what: "Rent arrears", amount: "any amount", consequence: "Your landlord can begin possession proceedings. This is the fastest route to losing a home and it outranks everything below it.", priority: true },
  { what: "Mortgage arrears", amount: "any amount", consequence: "The lender can apply for possession. Courts expect them to have tried to arrange something first, which is why contact matters so much.", priority: true },
  { what: "Council tax", amount: "any amount", consequence: "A liability order lets the council use bailiffs, take money from wages or benefits, and in rare cases seek imprisonment.", priority: true },
  { what: "Gas and electricity", amount: "any amount", consequence: "Disconnection, or a prepayment meter fitted under warrant at your cost. Ring the supplier — every one of them has a hardship fund.", priority: true },
  { what: "Magistrates' court fines", amount: "any amount", consequence: "Non-payment can end in a prison sentence. Fines are the only consumer debt in Britain where that is still true.", priority: true },
  { what: "TV licence", consequence: "A criminal prosecution and a fine, which then becomes a court fine — the row above.", priority: true },
  { what: "Credit and store cards", consequence: "Default notices, a mark on your credit file for six years, and eventually a county court judgment. Unpleasant, and none of it costs you your home.", priority: false },
  { what: "Personal loans and overdrafts", consequence: "The same. The bank may take money from another account with them, so move your wages elsewhere before you talk to them.", priority: false },
  { what: "Catalogue and buy-now-pay-later", consequence: "Debt collectors, who have no more power than the original creditor. They may not enter your home and they are not bailiffs.", priority: false },
  { what: "Money owed to family", consequence: "Nothing legal, usually. It is often the one causing the most distress, and an adviser will still help you plan for it.", priority: false },
];

function P() {
  return (
    <SiteChrome
      name="Sheffield Money Advice"
      tagline="Free, confidential and independent. We are not a debt company and we do not sell anything."
      links={[
        { label: "What can be arranged", href: "#/options" },
        { label: "What to bring", href: "#bring" },
      ]}
      action={{ label: "Ring 0114 276 0500", href: "tel:01142760500" }}
    >
      <section className="border-b border-border">
        <div className="mx-auto max-w-4xl px-6 py-14">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Free · Confidential · FCA-authorised charity, firm reference 617679
          </p>
          <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">
            Talk to a person today
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            There is no form on this page. Ring, or walk in — Monday to Friday, nine to four, and
            Tuesday evenings until seven. We will not ask for a penny at any stage and we do not
            pass your details to anybody.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a className="rounded-md bg-primary px-6 py-3 text-base font-medium text-primary-foreground" href="tel:01142760500">
              Ring 0114 276 0500
            </a>
            <a className="rounded-md border border-border px-6 py-3 text-base font-medium" href="#/options">
              What can actually be arranged
            </a>
          </div>

          <div className="mt-10">
            <TriageBanner
              heading="If something is happening now"
              levels={[
                {
                  when: "Bailiffs are at the door",
                  action: "Do not let them in. Ring us straight away — we can often stop it the same day.",
                  tel: "0114 276 0500",
                  note: "They may not force entry to a home for consumer debt. A closed door is a legal answer.",
                },
                {
                  when: "Your supply is being disconnected, or you have no credit on a meter",
                  action: "Ring your energy supplier and say the words 'I am in financial hardship'",
                  note: "Every supplier must have a process. If they do not help, ring us and we will ring them with you.",
                },
                {
                  when: "You have a court date, or a possession hearing",
                  action: "Ring us before it, however close it is",
                  tel: "0114 276 0500",
                  note: "There is a duty adviser at Sheffield County Court on hearing days and it is free.",
                },
                {
                  when: "You are having thoughts of harming yourself",
                  action: "Ring Samaritans, free, any hour",
                  tel: "116 123",
                  note: "Money problems are solvable and every one of them takes longer than a bad night.",
                },
              ]}
            />
          </div>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-4xl px-6 py-14">
          <SectionHeader
            eyebrow="The order to do things in"
            title="Pay these first — not the loudest, the most dangerous"
            description="Almost everybody pays whoever is ringing them most. That is nearly always the wrong creditor, and getting the order right is most of what an adviser does on the first visit."
          />
          <div className="mt-10">
            <PriorityDebts debts={DEBTS} />
          </div>
          <p className="mt-8 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            If there is nothing left after the first list, that is a real answer and not a failure.
            There are arrangements for exactly that situation and none of them cost you anything —
            they are on the <a className="underline underline-offset-4" href="#/options">options page</a>.
          </p>
        </div>
      </section>

      <section className="border-b border-border" id="bring">
        <div className="mx-auto max-w-4xl px-6 py-14">
          <div className="grid items-start gap-10 lg:grid-cols-[1.15fr_1fr]">
            <div>
              <SectionHeader
                eyebrow="Before you come"
                title="Bring what you have, not what you should have"
                description="Nobody has ever arrived with all of this and it has never stopped an appointment. Unopened post in a carrier bag is a completely normal way to turn up."
              />
              <ul className="mt-6 space-y-3 text-sm leading-relaxed text-muted-foreground">
                <li>Any letters you have, opened or not.</li>
                <li>Recent wage slips, or your benefit award letter.</li>
                <li>A bank statement, or online banking on your phone.</li>
                <li>Your rent or mortgage statement if you can find it.</li>
                <li>A rough idea of what you spend on food and travel.</li>
              </ul>
              <p className="mt-5 max-w-lg text-sm leading-relaxed text-muted-foreground">
                We can get most of this ourselves with your permission. The only thing we genuinely
                cannot do without you is know what your week actually costs.
              </p>
            </div>
            <div className="space-y-6">
              <div className="rounded-xl border border-border p-6">
                <p className="text-sm font-medium">A first appointment</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  About an hour. Most people leave with the first two of these done.
                </p>
                <div className="mt-4">
                  <ChecklistDot done={2} total={5} />
                </div>
                <ol className="mt-4 space-y-2 text-sm text-muted-foreground">
                  <li>1. Work out what is actually owed, to whom</li>
                  <li>2. Sort it into the two lists above</li>
                  <li>3. Write a budget that is honest rather than optimistic</li>
                  <li>4. Contact the priority creditors, with you</li>
                  <li>5. Choose an arrangement for the rest</li>
                </ol>
              </div>
              <ContactCard
                address="Central Library, Surrey Street, Sheffield S1 1XZ"
                phone="0114 276 0500"
                email="advice@sheffieldmoney.org.uk"
                mapUrl="https://www.openstreetmap.org/search?query=Surrey%20Street%20Sheffield"
              />
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-3xl px-6 py-14">
          <SectionHeader title="What people ask before ringing" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "Is this really free?",
                  answer:
                    "Yes, entirely, and there is nothing we will try to sell you later. We are a charity funded by the council and the Money and Pensions Service. Any company charging you a fee for debt advice is selling you something you can have here for nothing.",
                },
                {
                  question: "Will you tell anyone?",
                  answer:
                    "No. Not your landlord, not your employer, not your family. We only contact a creditor if you ask us to, and we would tell you before we did.",
                },
                {
                  question: "Will this ruin my credit file?",
                  answer:
                    "Talking to us does nothing to it at all. Some of the arrangements on the options page do leave a mark, for six years, and we will tell you which before you choose anything.",
                },
                {
                  question: "I am too embarrassed to come in.",
                  answer:
                    "That is the most common thing anybody says here, and it is the only real barrier in the whole process. We speak to about 4,000 households a year in this city. There is nothing you can tell us that we have not heard this week.",
                },
                {
                  question: "Can somebody come with me?",
                  answer: "Yes, anybody you like. Bring them. It helps more than people expect.",
                },
              ]}
            />
          </div>
        </div>
      </section>
    </SiteChrome>
  );
}
