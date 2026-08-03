// subscription-box — PLAN-AND-FREQUENCY-FIRST: two decisions made together,
// before any card details.
//
// THE CANCEL TERMS ARE IN THE HERO. Every subscription page in existence puts
// "cancel anytime" in eight-point grey at the bottom, and every complaint about
// subscriptions is about somebody who could not. Putting the real terms — the
// cut-off, what happens to a box already picked — beside the sign-up button
// costs a few sales and prevents the thing that makes people distrust the whole
// model.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { FrequencyPicker } from "@/components/ui/frequency-picker";
import { CancelPolicy } from "@/components/ui/cancel-policy";
import { CutoffTime } from "@/components/ui/cutoff-time";
import { DeliveryEstimate } from "@/components/ui/delivery-estimate";
import { MediaGrid } from "@/components/ui/media-grid";
import { SectionHeader } from "@/components/ui/section-header";
import { Faq } from "@/components/ui/faq";

export const Route = createFileRoute("/")({ component: P });

function P() {
  return (
    <SiteChrome
      name="Neepsend Coffee Club"
      tagline="Roasted on Tuesday in Sheffield, posted the same afternoon."
      links={[
        { label: "Plans", href: "#/plans" },
        { label: "Skip or cancel", href: "#/manage" },
        { label: "Questions", href: "#questions" },
      ]}
      action={{ label: "Start a box", href: "#choose" }}
    >
      <section className="border-b border-border" id="choose">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid items-start gap-12 lg:grid-cols-[1fr_1.05fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Single origin · Roasted to order · No contract
              </p>
              <h1 className="mt-3 text-5xl font-semibold tracking-tight text-balance">
                Two decisions, and you can undo both
              </h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                How much, and how often. That is the whole sign-up. Skipping a delivery takes one
                click and does not count as cancelling, which is the distinction most subscriptions
                are careful not to make.
              </p>

              {/* THE TERMS, BESIDE THE BUTTON. Not in a footer. */}
              <div className="mt-8 grid gap-4">
                <CancelPolicy
                  hours={48}
                  deposit="Nothing is held. Cancel and the next box simply does not go — you keep everything already sent."
                />
                <CutoffTime
                  by="Sunday 20:00"
                  promise="roasted Tuesday, posted Tuesday afternoon"
                  remaining="2 days"
                  nextPromise="Miss it and you are on the following Tuesday. Nothing is lost and nothing is charged twice."
                />
              </div>

              <div className="mt-7 flex flex-wrap gap-3">
                <a className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" href="#/plans">
                  See every plan
                </a>
                <a className="rounded-md border border-border px-5 py-2.5 text-sm font-medium" href="#/manage">
                  How skipping works
                </a>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium">How often</p>
              <p className="mt-1 text-sm text-muted-foreground">
                250g of whole beans a time. Change it whenever, from any delivery onwards.
              </p>
              <div className="mt-5">
                <FrequencyPicker
                  columns={2}
                  defaultValue="Every two weeks"
                  options={[
                    { label: "Every week", perYear: 52, pricePerVisit: 8.5, note: "For a household that gets through a bag in six days." },
                    { label: "Every two weeks", perYear: 26, pricePerVisit: 9, note: "What most people land on. Beans are still well inside their best window." },
                    { label: "Once a month", perYear: 12, pricePerVisit: 9.5, note: "Fine for one person. Keep the second half of the bag sealed." },
                    { label: "One-off", perYear: 0, pricePerVisit: 11, note: "No subscription at all. Buy a bag and see." },
                  ]}
                />
              </div>
              <div className="mt-6">
                <DeliveryEstimate from="2026-08-05" to="2026-08-07" method="Royal Mail 48, letterbox-sized" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* THE BOX, OPEN, WITH EVERYTHING OUT OF IT. A subscription is bought
          on one question — is it worth £28 — and the answer is a photograph of
          the contents beside something for scale, not a styled flat-lay with
          three artfully scattered beans. The captions say the MONTH, so
          somebody can see we do not reuse one shot all year. */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <MediaGrid
            columns={4}
            ratio="1/1"
            items={[
              { src: null, alt: "August's box open on a table, all six bags out beside it, a mug for scale", caption: "August. Six 250g bags — that mug is a normal mug." },
              { src: null, alt: "The roastery on a Tuesday, the drum going, sacks stacked behind", caption: "Roasted Tuesday, posted Wednesday, drunk by the weekend." },
              { src: null, alt: "The box flat-packed beside a bin — plain card, paper tape, no plastic", caption: "Card, paper tape, and a compostable valve bag. All of it goes in the recycling." },
              { src: null, alt: "Last month's box next to this one, different bags, same size", caption: "July beside August. Nothing repeats inside six months." },
            ]}
          />
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <SectionHeader
            eyebrow="What turns up"
            title="A bag, a card, and nothing else"
            description="No branded mug, no sticker, no tissue paper. Those things are why a lot of subscriptions cost what they cost."
          />
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">250g, whole beans</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Ground to order if you ask — say which brewer and we will set the grinder properly
                rather than guess at "medium".
              </p>
            </div>
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">Through the letterbox</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                The bag is sized for it. Nobody has to be in and there is no card through the door
                telling you to drive to Attercliffe.
              </p>
            </div>
            <div className="rounded-xl border border-border p-6">
              <p className="font-medium">The roast date, printed</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Not a best-before eleven months out. Coffee is at its best between four days and
                five weeks off the roaster and you should be able to tell where yours is.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="questions">
        <div className="mx-auto max-w-3xl px-6 py-14">
          <SectionHeader title="Before you subscribe" />
          <div className="mt-6">
            <Faq
              items={[
                {
                  question: "How do I cancel?",
                  answer:
                    "One button in your account, no reason asked, no retention offer. If the next box has already been roasted we will tell you and you can have it or not — either way that is the last one.",
                },
                {
                  question: "What is the difference between skipping and pausing?",
                  answer:
                    "Skipping drops one delivery. Pausing stops them until you say otherwise, and we do not restart it for you. Neither charges you anything.",
                },
                {
                  question: "Can I change the frequency later?",
                  answer: "Yes, from the next delivery. It is the most common change people make and it takes one click.",
                },
                {
                  question: "Do you charge for postage?",
                  answer: "It is in the price shown. There is no separate delivery line at checkout, on any plan.",
                },
              ]}
            />
          </div>
        </div>
      </section>
    </SiteChrome>
  );
}
