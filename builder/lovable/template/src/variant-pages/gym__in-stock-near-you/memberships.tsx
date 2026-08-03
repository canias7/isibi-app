// gym/in-stock-near-you /memberships — a gym's plans page becomes a coffee
// subscription. The chain's pitch is "one price at every branch"; a roaster's
// is that the beans are FRESHER, which is a date rather than a feature — so
// the page leads with the roast day and what a subscription actually changes.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { ComparisonTable } from "@/components/ui/comparison-table";
import { Faq } from "@/components/ui/faq";
import { FrequencyPicker } from "@/components/ui/frequency-picker";
import { PricingTable } from "@/components/ui/pricing-table";
import { SectionHeader } from "@/components/ui/section-header";
import { StatsBand } from "@/components/ui/stats-band";
export const Route = createFileRoute("/memberships")({ component: P });
function P() {
  return (
    <SiteChrome name="Foundry Coffee" tagline="Four shops in Sheffield. Beans roasted on Alma Street since 2012."
      links={[{ label: "All four shops", href: "#/" }, { label: "One shop", href: "#/location" }]}
      action={{ label: "Ring 0114 272 8800", href: "tel:01142728800" }}>

      <div className="mx-auto max-w-6xl px-6 py-12">
        <SectionHeader eyebrow="Subscriptions" title="Roasted Tuesday, with you Wednesday"
          description="A subscription does not get you a discount worth having — it gets you beans that were green four days ago, which is the only thing about coffee subscriptions that is actually true." />

        <StatsBand className="mt-8" items={[
          { value: "Tue & Fri", label: "Roast days, and we post the same afternoon" },
          { value: "1–2 days", label: "Roast to your door" },
          { value: "10%", label: "Off, which is not the point" },
          { value: "Any time", label: "Pause, skip or stop, no notice" },
        ]} />

        <section className="mt-12 grid gap-10 lg:grid-cols-[1.25fr_1fr]">
          <div>
            <SectionHeader eyebrow="How often" title="Most people get it wrong the first time"
              description="Two bags a fortnight sounds right and is usually too much. Start with one bag every three weeks and change it — it takes one click and there is no penalty." />
            <div className="mt-6 max-w-lg">
              <FrequencyPicker defaultValue="Every three weeks" options={[
                { label: "Every week", perYear: 52, pricePerVisit: 8.55, note: "Two people, one coffee each a day. Rare, and they know who they are" },
                { label: "Every two weeks", perYear: 26, pricePerVisit: 8.55, note: "What most people choose first, and about a third then slow down" },
                { label: "Every three weeks", perYear: 17, pricePerVisit: 8.55, suggested: true, note: "The one to start on. Move it up if you run out; nothing is lost either way" },
                { label: "Once a month", perYear: 12, pricePerVisit: 8.55, note: "One person, a coffee at the weekend. A bag will still be good at four weeks" },
                { label: "One-off", perYear: 0, pricePerVisit: 9.50, note: "Full shop price, sent once, no account made. Perfectly reasonable" },
              ]} />
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              A 250g bag is about eighteen filter coffees or twelve espressos. Two people drinking
              one each a day get through a bag in nine days; one person having one at the weekend
              takes a month, and a bag that has sat a month is exactly what a subscription is
              supposed to prevent.
            </p>

            <div className="mt-10">
              <SectionHeader eyebrow="The plans" title="Three, and the middle one is right for almost everybody" />
              <PricingTable className="mt-6" tiers={[
                {
                  name: "One bag", price: "£8.55", period: "a bag, whenever you like",
                  description: "250g of whichever single origin is on. Change or skip any time.",
                  features: ["10% off the shop price", "Free UK post", "Roasted the day it is sent", "Skip, pause or stop in one click"],
                  action: { label: "Start with one", href: "#/" },
                },
                {
                  name: "Two bags", price: "£16.20", period: "a delivery", featured: true,
                  description: "One we choose and one you do — which is how people find the ones they would never have picked.",
                  features: ["Everything in one bag", "One bag is our pick, which changes fortnightly", "Tasting note in every box, written by whoever roasted it", "Priority on the small lots, which sell out in two days"],
                  action: { label: "Start with two", href: "#/" },
                },
                {
                  name: "Office", price: "£58", period: "a delivery, 6 bags",
                  description: "1.5kg, ground to your machine if you say which, on a standing day.",
                  features: ["Everything above", "Invoiced monthly rather than card-per-delivery", "Ground to your machine, free", "A grinder on loan if you want to grind it yourselves"],
                  action: { label: "Talk to us", href: "tel:01142728800" },
                },
              ]} />
            </div>
          </div>

          <div>
            <SectionHeader eyebrow="Subscription against walking in" title="The honest comparison"
              description="It is not a big win on price and we would rather say so. What it wins on is the date on the bag." />
            {/* A TICK AND A DASH. Two of these rows go the shop's way, which is
                the reason to publish the table rather than a list of benefits. */}
            <ComparisonTable className="mt-6"
              columns={["Subscription", "Walk in"]}
              rows={[
                { feature: "Roasted within 48 hours", values: [true, false] },
                { feature: "10% off", values: [true, false] },
                { feature: "Free postage", values: [true, "n/a"] },
                { feature: "Choose after tasting it", values: [false, true] },
                { feature: "Have it ground for you", values: [true, true] },
                { feature: "Get it today", values: [false, true] },
                { feature: "Ask somebody what to try", values: [false, true] },
                { feature: "Access to the small lots", values: [true, false] },
              ]} />
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Two of these go the shop's way, and one of them — asking somebody what to try — is
              worth more than the ten per cent to most people starting out. If you live near one of
              the four, walking in is genuinely a reasonable answer.
            </p>

            <div className="mt-8 rounded-lg border border-border bg-muted/50 p-5">
              <p className="text-base font-medium">Collect it instead, and keep the discount</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                A subscription set to collection is 10% off, roasted to your day, put behind the
                counter at whichever shop you name. It costs us less than posting it and you get the
                same beans on the same day — which is why it is the same price rather than dearer.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="max-w-3xl">
            <SectionHeader eyebrow="Asked often" title="About subscribing" />
            <Faq className="mt-6" items={[
              { question: "Can I cancel?", answer: "Any time, in one click, no notice and no email asking you to reconsider. If a delivery has already been roasted for you we will send it and then stop — we are not going to bin it." },
              { question: "What if I do not like one?", answer: "Tell us and the next one is free. It happens perhaps twice a month and we have never asked anybody to send a bag back." },
              { question: "Whole bean or ground?", answer: "Either, and ground is free. Say which machine and we will match it — 'ground for filter' means four different things and getting it wrong wastes a bag." },
              { question: "Do you post outside the UK?", answer: "Ireland and the EU, at cost, and it takes four to eight days — which is long enough that we would rather point you at a roaster nearer you. Ask and we will name one." },
              { question: "Is the 10% off everything?", answer: "Beans only. Equipment is the same price whether you subscribe or not, in the shops and online, and always has been." },
              { question: "Can I give one as a present?", answer: "Three, six or twelve deliveries, prepaid, and it stops on its own rather than rolling into a card charge the recipient did not agree to." },
            ]} />
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
