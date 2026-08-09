// sports-club /join — trials, subs and the form. Money is stated plainly,
// because "contact us about fees" is how a club loses a fourteen-year-old.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { ContactForm } from "@/components/ui/contact-form";
import { Faq } from "@/components/ui/faq";
import { PriceList } from "@/components/ui/price-list";
import { SectionHeader } from "@/components/ui/section-header";
import { TrustStrip } from "@/components/ui/trust-strip";
export const Route = createFileRoute("/join")({ component: P });
function P() {
  const [sent, setSent] = useState(false);
  return (
    <SiteChrome name="Walkley Wanderers" tagline="Four teams, one pitch, Sheffield & Hallamshire League."
      links={[{ label: "Home", href: "/" }, { label: "Teams", href: "/teams" }]}
      action={{ label: "Trials — Tuesdays 7pm", href: "#trials" }}>
      <div className="mx-auto max-w-5xl px-6 py-14">
        <SectionHeader eyebrow="Joining" title="Turn up in boots"
          description="There is no form to fill in before a trial and there never has been. The form below is for afterwards." />
        <section id="trials" className="mt-10 rounded-xl border border-border bg-muted/40 p-6">
          <h2 className="text-lg font-medium">Trials</h2>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Tuesdays at seven, Rowel Bridge, all four teams at once on the same pitch. Boots and shin pads;
            we have spare bibs and a spare set of gloves. Under-18s bring a parent or carer for the first one.
          </p>
        </section>
        <section className="mt-12">
          <SectionHeader eyebrow="Subs" title="What it costs, all in" />
          <PriceList className="mt-6" items={[
            { name: "Adult, per season", description: "Payable £10 a month if that is easier — most do", price: 90, meta: "Aug–May" },
            { name: "Under-18s, per season", description: "Includes kit, which adults pay separately for", price: 45, meta: "Aug–May" },
            { name: "Match fee", description: "Per game played, adults only", price: 5, meta: "on the day" },
            { name: "Social member", description: "Bar and the AGM, no playing", price: 15, meta: "per year" },
          ]} />
          <p className="mt-4 text-sm text-muted-foreground">
            Nobody has ever been dropped over subs and nobody ever will be. If money is the problem, say so
            to Eileen and it is dealt with quietly.
          </p>
        </section>
        <section className="mt-12">
          <TrustStrip items={[
            { title: "FA-affiliated", description: "All coaches DBS-checked and Level 2 or above" },
            { title: "Kit included for juniors", description: "Shirt, shorts and socks, replaced when outgrown" },
            { title: "No joining fee", description: "Subs start the month you start playing" },
          ]} />
        </section>
        <section className="mt-12 grid gap-10 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <SectionHeader eyebrow="After a trial" title="Tell us about yourself" />
            <ContactForm className="mt-6" askPhone sent={sent} onSubmit={() => setSent(true)} />
          </div>
          <div>
            <SectionHeader eyebrow="Asked often" title="Before you come down" />
            <Faq className="mt-6" items={[
              { question: "I have not played for ten years.", answer: "That describes about a third of the reserves. Come on a Tuesday and see how you feel on the Wednesday." },
              { question: "Is there a women's team?", answer: "Yes, in its third season, and it trains Wednesdays. Same pitch, same kit, same subs." },
              { question: "My child is thirteen.", answer: "The under-18s take from thirteen. First session with a parent, then it is up to them." },
              { question: "Do I need my own boots?", answer: "Yes for boots, no for everything else. We have bibs, balls and a spare pair of gloves." },
            ]} />
          </div>
        </section>
      </div>
    </SiteChrome>
  );
}
