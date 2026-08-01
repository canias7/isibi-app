// trust-first — credentials before pitch; conservative rhythm throughout. An
// accountancy firm: who we are and what we're licensed for, stated plainly,
// then the people, who vouches, what it costs to start, and the one form.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { ContactForm } from "@/components/ui/contact-form";
import { Faq } from "@/components/ui/faq";
import { PriceList } from "@/components/ui/price-list";
import { ProfileCard } from "@/components/ui/profile-card";
import { SectionHeader } from "@/components/ui/section-header";
import { Testimonial } from "@/components/ui/testimonial";
import { TrustStrip } from "@/components/ui/trust-strip";
export const Route = createFileRoute("/")({ component: P });
function P() {
  const [sent, setSent] = useState(false);
  return (
    <SiteChrome name="Hartley & Voss" tagline="Chartered accountants, est. 1987."
      links={[{ label: "Who we are", href: "#people" }, { label: "What we do", href: "#/services" }, { label: "The firm", href: "#/about" }, { label: "Questions", href: "#faq" }]}
      action={{ label: "Free consultation", href: "#consult" }}>

      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Paradise Square, Sheffield · since 1987</p>
          <h1 className="mt-3 max-w-xl text-4xl font-semibold tracking-tight text-balance">Accounts, payroll and tax for owner-run firms</h1>
          <p className="mt-4 max-w-xl text-lg text-muted-foreground">Two partners, no juniors on your file, and a fixed monthly fee agreed before any work starts.</p>
          <a className="mt-6 inline-block rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" href="#consult">Ask for the free hour</a>
        </div>
      </section>

      {/* Licensing before any pitch — the family's whole point. */}
      <section className="mx-auto max-w-5xl px-6 py-10">
        <TrustStrip items={[
          { title: "ICAEW regulated", description: "Firm C008841312 — check us on the register" },
          { title: "37 years, one square", description: "Paradise Square since 1987" },
          { title: "Insured to £2m", description: "Professional indemnity, renewed each May" },
        ]} />
      </section>

      <section id="people" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <SectionHeader eyebrow="Who you'd work with" title="The partners are the firm" description="Ring the office and one of these two answers. That is the whole staffing chart." />
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <ProfileCard name="Eleanor Hartley FCA" meta="Partner — owner-managed businesses, exits" avatar={null} />
            <ProfileCard name="Jakob Voss CTA" meta="Partner — personal tax, HMRC enquiries" avatar={null} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-14">
        <SectionHeader eyebrow="Where fees start" title="Fixed, monthly, in the open" description="Agreed in writing before any work starts, reviewed once a year. Calls and emails included — always." />
        <PriceList className="mt-6" items={[
          { name: "Sole trader", description: "Accounts and self-assessment", price: 55, meta: "per month" },
          { name: "Limited company", description: "Accounts, CT600, director payroll", price: 125, meta: "per month" },
          { name: "Company + payroll", description: "Up to ten staff, pensions included", price: 175, meta: "per month" },
        ]} />
        <p className="mt-3 text-sm"><a className="font-medium underline underline-offset-4" href="#/services">Every service, priced →</a></p>
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-3xl px-6 py-14">
          <Testimonial item={{ quote: "They found four years of overpaid VAT and never once made me feel stupid about it.", name: "Carol Dunne", role: "Dunne Joinery" }} />
        </div>
      </section>

      <section id="faq" className="mx-auto max-w-2xl px-6 py-14">
        <SectionHeader eyebrow="Questions" title="Asked in most first meetings" />
        <Faq className="mt-6" items={[
          { question: "What does the first meeting cost?", answer: "Nothing. An hour, your numbers, plain answers. You leave with them either way." },
          { question: "Can you take over mid-year?", answer: "Yes — we handle the handover letters. Most moves finish inside a fortnight." },
          { question: "Do you do audits?", answer: "No, and we say so quickly — we refer them to a firm we trust and stay your accountants." }]} />
      </section>

      <section id="consult" className="border-t border-border bg-muted/40">
        <div className="mx-auto max-w-2xl px-6 py-14">
          <SectionHeader eyebrow="The first step" title="Ask for the hour" description="Sent before noon, you'll hear back the same working day — from a partner, because there isn't anyone else." />
          <ContactForm className="mt-6" askPhone sent={sent} onSubmit={() => setSent(true)} />
        </div>
      </section>
    </SiteChrome>
  );
}
