// facility /membership — joining against paying each time, with the break-even
// STATED. Every leisure centre sells a membership and none of them will tell
// you how many visits a month it takes to be worth it.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Faq } from "@/components/ui/faq";
import { PricingTable } from "@/components/ui/pricing-table";
import { RateCard } from "@/components/ui/rate-card";
import { SectionHeader } from "@/components/ui/section-header";
export const Route = createFileRoute("/membership")({ component: P });
function P() {
  return (
    <SiteChrome name="Hillsborough Leisure" tagline="Pool, courts, gym and a climbing wall, on Penistone Road."
      links={[{ label: "Home", href: "/" }, { label: "Book a slot", href: "/book" }]}
      action={{ label: "Ring 0114 273 4444", href: "tel:01142734444" }}>

      <div className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeader eyebrow="Membership" title="Worth it above about eight visits a month"
          description="That is the answer, and it is on this page rather than at the end of a tour. Below eight, pay as you go and keep the difference." />

        {/* THE ARITHMETIC, FIRST. Every centre sells a membership and none of
            them will tell you the break-even, because the honest number sends
            about half of enquirers away. */}
        <section className="mt-10 rounded-xl border border-border bg-muted/50 p-6 sm:p-8">
          <h2 className="text-2xl font-semibold tracking-tight">Do the sum before you sign anything</h2>
          <div className="mt-6 grid gap-8 sm:grid-cols-3">
            <div>
              <p className="text-3xl font-semibold tabular-nums">£38</p>
              <p className="mt-1 font-medium">Full membership, a month</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Everything, any time, no contract.</p>
            </div>
            <div>
              <p className="text-3xl font-semibold tabular-nums">8</p>
              <p className="mt-1 font-medium">Visits to break even</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                At peak swim-and-gym prices. Off-peak only, it is nearer twelve.
              </p>
            </div>
            <div>
              <p className="text-3xl font-semibold tabular-nums">2.1</p>
              <p className="mt-1 font-medium">Average visits a month</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Across everybody who joined last January. Most people should not be members and we
                would rather say so.
              </p>
            </div>
          </div>
          <p className="mt-6 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            If you are coming twice a week, join — you will save about £150 a year and get the
            twenty-eight day court window. If you are coming twice a month, do not. There is no
            joining fee either way, so you can start paying as you go and switch when the pattern
            is obvious.
          </p>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="The tiers" title="Three, and one of them is free"
            description="Monthly, no contract, cancel with a month's notice. Nobody will ring you about upgrading." />
          <PricingTable className="mt-8" tiers={[
            {
              name: "Pay as you go", price: "£0", period: "a month",
              description: "No membership at all. Turn up, pay, leave.",
              features: ["Every activity at the standard price", "Book courts 14 days ahead", "No commitment of any kind"],
              action: { label: "Just turn up", href: "/book" },
            },
            {
              name: "Off-peak", price: "£24", period: "a month", featured: true,
              description: "Weekdays before 4pm and all day Sunday. The one most people should be on.",
              features: ["Unlimited swim, gym and climbing off-peak", "Courts at member rates", "Book 28 days ahead", "Bring a guest twice a month at half price"],
              action: { label: "Join off-peak", href: "/book" },
            },
            {
              name: "Full", price: "£38", period: "a month",
              description: "Any activity at any hour we are open.",
              features: ["Unlimited everything, any time", "Courts at member rates", "Book 28 days ahead", "Bring a guest twice a month at half price", "Free induction and a programme review twice a year"],
              action: { label: "Join full", href: "/book" },
            },
          ]} />
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <SectionHeader eyebrow="What you would pay instead" title="Pay-as-you-go prices, for the comparison"
            description="The numbers the break-even above is calculated from, so you can check it rather than trust it." />
          <div className="mt-8 max-w-3xl">
            <RateCard label="Activity" unit="visit" bands={["Off-peak", "Peak"]} rates={[
              { period: "Swim", units: 1, price: 4.2, more: [5.6] },
              { period: "Gym", units: 1, price: 5.5, more: [7.2] },
              { period: "Climbing, day pass", units: 1, price: 8.5, more: [11] },
              { period: "Badminton court, per hour", units: 1, price: 9, more: [13] },
              { period: "Squash court, per 40 min", units: 1, price: 7.5, more: [10.5] },
            ]} />
          </div>
        </section>

        <section className="mt-14 border-t border-border pt-10">
          <div className="max-w-3xl">
            <SectionHeader eyebrow="Asked often" title="About joining" />
            <Faq className="mt-6" items={[
              { question: "Is there a joining fee?", answer: "No, and there never has been. Any centre charging one is charging you for a database record." },
              { question: "How do I cancel?", answer: "A month's notice, by email or at the desk. No retention call, no offer, no form to post." },
              { question: "Can I freeze it?", answer: "Up to three months a year, free — injury, a long holiday, whatever. Say when, not why." },
              { question: "Do members get priority on courts?", answer: "A longer booking window, twenty-eight days against fourteen. Not a better price and not a queue-jump on the day." },
              { question: "Is there a concession rate?", answer: "Over-60s, under-18s, students and anyone on Universal Credit pay the off-peak rate at all times, membership or not. Ask at the desk; we do not ask for proof more than once." },
              { question: "What about a family membership?", answer: "£62 a month for two adults and up to three children at the same address. It breaks even at about fourteen visits between everybody, which most families do clear." },
            ]} />
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
