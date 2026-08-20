// subscription-box /manage — skipping, pausing, changing and stopping, on one
// page, with the stop button no harder to find than the others.
//
// A "manage subscription" page that buries cancellation three clicks deep
// behind two "are you sure" screens and a discount offer is the single most
// common dark pattern in consumer software. This page is the argument that it
// costs nothing to be straight: the four actions are one list, cancelling is
// the fourth, and nothing tries to talk anybody out of it.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { RecurringPicker } from "@/components/ui/recurring-picker";
import { CutoffTime } from "@/components/ui/cutoff-time";
import { CancelPolicy } from "@/components/ui/cancel-policy";
import { DeliveryEstimate } from "@/components/ui/delivery-estimate";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/manage")({ component: P });

const ACTIONS = [
  {
    what: "Skip the next one",
    when: "Any time before Sunday 20:00",
    detail: "One delivery does not go and nothing is charged. The subscription carries on as normal afterwards — this is not a pause and you do not need to restart anything.",
  },
  {
    what: "Pause until further notice",
    when: "Any time",
    detail: "Deliveries stop and stay stopped until you restart them. We will not restart it for you and we will not email you every fortnight asking. Going away for three months is a normal reason.",
  },
  {
    what: "Change size or frequency",
    when: "Takes effect from the next delivery",
    detail: "Two separate settings. Either can move without touching the other, and neither resets any kind of term because there is no term.",
  },
  {
    what: "Cancel",
    when: "Any time",
    detail: "One button. No reason asked, no offer, no survey. If the next box is already roasted we will say so and you can take it or not; either way that is the last one.",
  },
];

function P() {
  return (
    <SiteChrome
      name="Neepsend Coffee Club"
      tagline="Skip, pause, change or stop. All four on one page."
      links={[
        { label: "Home", href: "/" },
        { label: "Plans", href: "/plans" },
      ]}
      action={{ label: "Plans", href: "/plans" }}
    >
      <div className="mx-auto max-w-5xl px-6 py-14">
        <h1 className="text-4xl font-semibold tracking-tight text-balance">
          Skipping, pausing and stopping
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Four things you can do, in one list, with cancelling as ordinary as the other three. There
          is no retention offer at the end of it because we would rather you came back later than
          resented staying.
        </p>

        <section className="mt-12">
          <div className="grid items-start gap-10 lg:grid-cols-[1.2fr_1fr]">
            <ul className="divide-y divide-border border-y border-border">
              {ACTIONS.map((a) => (
                <li key={a.what} className="py-5">
                  <div className="flex flex-wrap items-baseline gap-x-3">
                    <p className="font-medium">{a.what}</p>
                    <p className="text-sm text-muted-foreground">{a.when}</p>
                  </div>
                  <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">{a.detail}</p>
                </li>
              ))}
            </ul>
            <div className="space-y-6">
              <CutoffTime
                by="Sunday 20:00"
                promise="the Tuesday roast"
                remaining="2 days"
                nextPromise="After the cut-off the beans for your box are already ordered green, which is why this deadline exists at all."
              />
              <DeliveryEstimate from="2026-08-05" to="2026-08-07" method="Royal Mail 48" />
              <CancelPolicy
                hours={48}
                deposit="Nothing held, nothing charged. Cancelling and starting again in six months costs the same as never having stopped."
              />
            </div>
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader
            eyebrow="Changing frequency"
            title="Pick a rhythm and change it whenever"
            description="Most people move once, in the first two months, once they know how fast they actually get through a bag."
          />
          <div className="mt-6 max-w-md">
            <RecurringPicker value="Every 2 weeks" onChange={() => {}} />
          </div>
        </section>

        <section className="mt-14">
          <SectionHeader title="Managing questions" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "I skipped but a box arrived anyway.",
                  answer:
                    "Then the skip landed after Sunday 20:00 and the box was already roasted. Tell us and we will credit it — that is our cut-off being unclear, not your mistake.",
                },
                {
                  question: "Can I skip several deliveries at once?",
                  answer: "Skip up to four in a row from the account. Beyond that, pause — it is the same thing and you will not have to remember to keep skipping.",
                },
                {
                  question: "Does pausing lose my price?",
                  answer:
                    "No. Restart at any point on the same plan at the same price. There is no returning-customer rate and no loyalty tier, because both mean somebody is paying more for standing still.",
                },
                {
                  question: "Can I cancel by email instead?",
                  answer:
                    "Yes — hello@neepsendcoffee.co.uk and we will do it the same day, no questions. A subscription that can only be cancelled through one specific button is a subscription designed to be difficult.",
                },
              ]}
            />
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            <a className="underline underline-offset-4" href="/">Back to the start</a>
            {" · "}
            <a className="underline underline-offset-4" href="/plans">Every plan</a>
          </p>
        </section>
      </div>
    </SiteChrome>
  );
}
