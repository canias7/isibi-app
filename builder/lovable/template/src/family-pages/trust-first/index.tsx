// trust-first — SINGLE-SCROLL, the conservative embodiment: one narrow
// column, ruled sections, no tinted bands, no oversized hero. A firm of
// this kind should read like a letterhead — the restraint IS the proof.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { ContactForm } from "@/components/ui/contact-form";
import { Faq } from "@/components/ui/faq";
import { PriceList } from "@/components/ui/price-list";
import { ProfileCard } from "@/components/ui/profile-card";
import { Testimonial } from "@/components/ui/testimonial";
import { TrustStrip } from "@/components/ui/trust-strip";
export const Route = createFileRoute("/")({ component: P });
function P() {
  const [sent, setSent] = useState(false);
  return (
    <SiteChrome name="Hartley & Voss" tagline="Chartered accountants, est. 1987."
      links={[{ label: "What we do", href: "#/services" }, { label: "The firm", href: "#/about" }, { label: "Contact", href: "#/contact" }]}
      action={{ label: "Free consultation", href: "#consult" }}>
      <div className="mx-auto max-w-2xl px-6 py-14">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Paradise Square, Sheffield · since 1987</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance">Accounts, payroll and tax for owner-run firms</h1>
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">Two partners, no juniors on your file, and a fixed monthly fee agreed in writing before any work starts. The first hour is free and always has been.</p>

        <div className="mt-10 border-t border-border pt-8">
          <TrustStrip items={[
            { title: "ICAEW regulated", description: "Firm C008841312 — check us on the register" },
            { title: "37 years, one square", description: "Paradise Square since 1987" },
            { title: "Insured to £2m", description: "Professional indemnity, renewed each May" }]} />
        </div>

        <section className="mt-10 border-t border-border pt-8">
          <h2 className="text-xl font-semibold tracking-tight">The partners are the firm</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Ring the office and one of these two answers. That is the whole staffing chart.</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <ProfileCard name="Eleanor Hartley FCA" meta="Partner — owner-managed businesses, exits" avatar={null} />
            <ProfileCard name="Jakob Voss CTA" meta="Partner — personal tax, HMRC enquiries" avatar={null} />
          </div>
        </section>

        <section className="mt-10 border-t border-border pt-8">
          <h2 className="text-xl font-semibold tracking-tight">Where fees start</h2>
          <PriceList className="mt-4" items={[
            { name: "Sole trader", description: "Accounts and self-assessment", price: 55, meta: "per month" },
            { name: "Limited company", description: "Accounts, CT600, director payroll", price: 125, meta: "per month" },
            { name: "Company + payroll", description: "Up to ten staff, pensions included", price: 175, meta: "per month" }]} />
          <p className="mt-3 text-sm"><a className="font-medium underline underline-offset-4" href="#/services">Every service, priced →</a></p>
        </section>

        <div className="mt-10 border-t border-border pt-8">
          <Testimonial item={{ quote: "They found four years of overpaid VAT and never once made me feel stupid about it.", name: "Carol Dunne", role: "Dunne Joinery" }} />
        </div>

        <section className="mt-10 border-t border-border pt-8">
          <Faq items={[
            { question: "What does the first meeting cost?", answer: "Nothing. An hour, your numbers, plain answers. You leave with them either way." },
            { question: "Can you take over mid-year?", answer: "Yes — we handle the handover letters. Most moves finish inside a fortnight." },
            { question: "Do you do audits?", answer: "No, and we say so quickly — we refer them to a firm we trust and stay your accountants." }]} />
        </section>

        <section id="consult" className="mt-10 border-t border-border pt-8">
          <h2 className="text-xl font-semibold tracking-tight">Ask for the hour</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Sent before noon, you hear back the same working day — from a partner, because there isn't anyone else.</p>
          <ContactForm className="mt-5" askPhone sent={sent} onSubmit={() => setSent(true)} />
        </section>
      </div>
    </SiteChrome>
  );
}
