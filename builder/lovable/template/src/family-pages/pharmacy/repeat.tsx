// pharmacy /repeat — ordering, how long it really takes, and what happens when
// an item is out of stock.
//
// THE OUT-OF-STOCK CASE IS THE WHOLE PAGE. Medicine shortages are constant and
// the standard experience is arriving to be told "we haven't got it" with no
// explanation and no plan. Naming what we do instead — ring the prescriber,
// find an equivalent, source it from another branch — turns a wasted journey
// into a phone call.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { PrescriptionRow } from "@/components/ui/prescription-row";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/repeat")({ component: P });

const STEPS = [
  { n: "1", what: "Tell us what you need", detail: "Online, at the counter, or on 0114 234 1180. Name, date of birth, and which items — not all of them, just the ones you actually need." },
  { n: "2", what: "We send it to the surgery", detail: "Same working day. This is the step nobody sees and the one that takes the time." },
  { n: "3", what: "The surgery signs it", detail: "Two working days is normal and it is outside our control. A GP has to look at every item and there is no way to hurry it." },
  { n: "4", what: "We dispense and text you", detail: "Usually within a day of it arriving. The text is the moment it is genuinely ready — do not come before it." },
];

function P() {
  return (
    <SiteChrome
      name="Walkley Pharmacy"
      tagline="Ordering a repeat, and what happens when something is out of stock."
      links={[
        { label: "Home", href: "#/" },
        { label: "Services", href: "#/services" },
      ]}
      action={{ label: "Ring 0114 234 1180", href: "tel:01142341180" }}
    >
      <div className="mx-auto max-w-5xl px-6 py-14">
        <h1 className="text-4xl font-semibold tracking-tight text-balance">Repeat prescriptions</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Allow three working days from asking to collecting. Two of those are the surgery and
          nothing we can do speeds them up — which is worth knowing on the Friday before a bank
          holiday.
        </p>

        <section className="mt-12">
          <SectionHeader eyebrow="How it works" title="Four steps, and where the time goes" />
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
          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Order only what you need. Stockpiling looks sensible and it is how people end up with a
            cupboard of expired medicine and a surgery query that delays the next order.
          </p>
        </section>

        <section className="mt-14">
          <SectionHeader
            eyebrow="A typical order"
            title="What is ready, and what is not"
            description="This is what the counter sees. An item we cannot get says why and what we are doing about it, rather than just being absent."
          />
          <div className="mt-8 max-w-2xl space-y-3">
            <PrescriptionRow
              item={{ drug: "Atorvastatin", strength: "20mg", form: "tablets", quantity: 28, unit: "tablets", directions: "One at night" }}
              dispensed
            />
            <PrescriptionRow
              item={{ drug: "Salbutamol", strength: "100 micrograms", form: "inhaler", quantity: 2, unit: "inhalers", directions: "Two puffs when needed, up to four times a day" }}
              dispensed
            />
            <PrescriptionRow
              item={{ drug: "Levothyroxine", strength: "75 micrograms", form: "tablets", quantity: 28, unit: "tablets", directions: "One in the morning, half an hour before food" }}
              unavailable
              unavailableReason="National shortage since June. We have rung the surgery to ask for two 25mcg and one 50mcg instead, which comes to the same dose — waiting on their reply, expected today."
            />
            <PrescriptionRow
              item={{ drug: "Amitriptyline", strength: "10mg", form: "tablets", quantity: 56, unit: "tablets", directions: "One or two at night" }}
              unavailable
              unavailableReason="Not held — we get it in by 11:00 tomorrow. There is no need to come back for it; we will text and it can go on the Friday delivery."
            />
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader
            eyebrow="Out of stock"
            title="What we do instead of telling you we haven't got it"
            description="Shortages are constant and the standard experience is a wasted journey. These four things happen before you are told there is a problem."
          />
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">Check the other branches and the wholesalers</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Three wholesalers and every independent within a couple of miles. It finds it more
                often than people expect and costs a phone call.
              </p>
            </div>
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">Ring the prescriber about an equivalent</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Two 25mcg tablets instead of one 50mcg, or a different brand of the same drug. Needs
                their agreement and we ask rather than waiting for you to.
              </p>
            </div>
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">Give you what we have</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                A part supply now and the rest when it lands. Nobody should go without because we
                could not fill the whole box.
              </p>
            </div>
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">Tell you before you set off</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                We text. The whole point is that you find out at home rather than at the counter,
                and it is the part most pharmacies skip.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader title="Repeat questions" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "Can you order automatically every month?",
                  answer:
                    "We can, and mostly we would rather not — automatic ordering is how people accumulate six months of something they stopped taking. For a stable long-term medicine it is fine and we will set it up.",
                },
                {
                  question: "What about a bank holiday?",
                  answer:
                    "Order a week ahead. The surgery loses a day, we lose a day, and a three-day gap becomes five. It is the single most common cause of somebody running out.",
                },
                {
                  question: "Can I collect at another branch?",
                  answer: "We are one shop, so no. If you are away, any pharmacy can dispense your electronic prescription — ring them and they will pull it down.",
                },
                {
                  question: "I have run out completely and the surgery is closed.",
                  answer:
                    "Come in. We can supply an emergency amount of most things at the pharmacist's discretion, and we will do it. Insulin, inhalers and epilepsy medicines especially — do not go without over a weekend.",
                },
              ]}
            />
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            <a className="underline underline-offset-4" href="#/">The four doors</a>
            {" · "}
            <a className="underline underline-offset-4" href="#/services">Everything we do</a>
          </p>
        </section>
      </div>
    </SiteChrome>
  );
}
