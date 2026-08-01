// trust-first — credentials before pitch; conservative rhythm; the consultation
// form is the destination. A small accountancy firm.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { ContactForm } from "@/components/ui/contact-form";
import { Faq } from "@/components/ui/faq";
import { ProfileCard } from "@/components/ui/profile-card";
import { Testimonial } from "@/components/ui/testimonial";
import { TrustStrip } from "@/components/ui/trust-strip";
export const Route = createFileRoute("/")({ component: P });
function P() {
  const [sent, setSent] = useState(false);
  return (
    <SiteChrome name="Hartley & Voss" tagline="Chartered accountants, est. 1987."
      links={[{ label: "Who we are", href: "#people" }, { label: "What we do", href: "#/services" }, { label: "Questions", href: "#faq" }]}
      action={{ label: "Free consultation", href: "#/contact" }}>
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">Hartley &amp; Voss</h1>
        <p className="mt-2 max-w-xl text-muted-foreground">Accounts, payroll and tax for owner-run firms. Two partners, no juniors on your file.</p>
        {/* Licensing before any pitch — the family's whole point. */}
        <TrustStrip className="mt-8" items={[
          { title: "ICAEW regulated", description: "Firm C008841312" },
          { title: "37 years, one office", description: "Paradise Square since 1987" },
          { title: "Insured to £2m", description: "Professional indemnity, renewed May" }]} />
        <section id="people" className="mt-10 grid gap-4 sm:grid-cols-2">
          <ProfileCard name="Eleanor Hartley FCA" meta="Partner — owner-managed businesses, exits" avatar={null} />
          <ProfileCard name="Jakob Voss CTA" meta="Partner — personal tax, HMRC enquiries" avatar={null} />
        </section>
        <Testimonial className="mt-8" item={{ quote: "They found four years of overpaid VAT and never once made me feel stupid about it.", name: "Carol Dunne", role: "Dunne Joinery" }} />
        <section id="faq" className="mt-10">
          <Faq items={[
            { question: "What does the first meeting cost?", answer: "Nothing. An hour, your numbers, plain answers. You leave with them either way." },
            { question: "Can you take over mid-year?", answer: "Yes — we handle the handover letters. Most moves finish inside a fortnight." }]} />
        </section>
        <p className="mt-8 text-sm"><a className="underline underline-offset-4" href="#/services">What we do, with fees in the open →</a></p>
        <section id="consult" className="mt-10">
          <h2 className="text-lg font-medium">Ask for the hour</h2>
          <ContactForm className="mt-4" askPhone sent={sent} onSubmit={() => setSent(true)} />
        </section>
      </div>
    </SiteChrome>
  );
}
