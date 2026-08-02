// charity /donate — the amount picker and one form. Nothing else on the page,
// because everything else is a chance to change your mind.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { DonationTiers } from "@/components/ui/donation-tiers";
import { Faq } from "@/components/ui/faq";
import { SectionHeader } from "@/components/ui/section-header";
import { TrustStrip } from "@/components/ui/trust-strip";
export const Route = createFileRoute("/donate")({ component: P });
function P() {
  return (
    <SiteChrome name="The Loxley Larder" tagline="A food bank and community kitchen in Walkley."
      links={[{ label: "Home", href: "#/" }, { label: "Where it goes", href: "#/impact" }]}
      action={{ label: "Donate", href: "#give" }}>
      <div className="mx-auto max-w-4xl px-6 py-14">
        <SectionHeader eyebrow="Give" title="Pick an amount"
          description="Monthly is what lets us order food in advance instead of hoping. One-off is what gets us through January." />
        <div id="give" className="mt-10 rounded-xl border border-border p-6 sm:p-8">
          <DonationTiers defaultCadence="monthly"
            monthly={[
              { amount: 5, buys: "A hot meal a week, every week" },
              { amount: 12, buys: "A household fed weekly", suggested: true },
              { amount: 25, buys: "Two households, and the fuel to deliver" },
              { amount: 50, buys: "A week of the whole Tuesday session" },
            ]}
            oneOff={[
              { amount: 12, buys: "One household, one week" },
              { amount: 30, buys: "A delivery round to the flats" },
              { amount: 75, buys: "A full Tuesday session", suggested: true },
              { amount: 150, buys: "A month of the community kitchen" },
            ]} />
        </div>
        <div className="mt-10">
          <TrustStrip items={[
            { title: "Registered charity 1194732", description: "Check us on the Commission's register" },
            { title: "89p in the pound", description: "Goes on food, fuel and the building" },
            { title: "Cancel in one email", description: "No retention call, no three-month notice" },
          ]} />
        </div>
        <div className="mt-12 border-t border-border pt-10">
          <SectionHeader eyebrow="Before you give" title="The questions we get asked" />
          <Faq className="mt-6" items={[
            { question: "What is Gift Aid?", answer: "If you pay UK income tax, we can claim 25p on every pound at no cost to you. There is a checkbox on the next screen and it takes one tick." },
            { question: "Where does the other 11p go?", answer: "The van, the gas bill, the insurance and the accountant. Nobody here is paid a salary, including the trustees." },
            { question: "Can I give to something specific?", answer: "You can, and we would gently rather you did not — the unrestricted money is what covers the thing that breaks in November." },
            { question: "Will you contact me afterwards?", answer: "Once a year, in January, with the accounts. That is the whole mailing." },
          ]} />
        </div>
      </div>
    </SiteChrome>
  );
}
