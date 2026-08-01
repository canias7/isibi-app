// industrial — specs and downloads lead; the quote path is the conversion. A
// fastener manufacturer: the claim a buyer checks first, the spec table high,
// the paperwork downloadable before anyone asks, and the RFQ everywhere.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { ContactForm } from "@/components/ui/contact-form";
import { CtaBand } from "@/components/ui/cta-band";
import { DownloadCard } from "@/components/ui/download-card";
import { LogoCloud } from "@/components/ui/logo-cloud";
import { SectionHeader } from "@/components/ui/section-header";
import { SpecRow } from "@/components/ui/spec-row";
import { StatsBand } from "@/components/ui/stats-band";
export const Route = createFileRoute("/")({ component: P });
function P() {
  const [sent, setSent] = useState(false);
  return (
    <SiteChrome name="Attercliffe Fastenings" tagline="Cold-forged fasteners since 1953. BS EN ISO 898-1."
      links={[{ label: "Specs", href: "#specs" }, { label: "The 12.9 line", href: "#/product" }, { label: "Stockists", href: "#/stockists" }, { label: "Downloads", href: "#dl" }]}
      action={{ label: "Request quote", href: "#/quote" }}>

      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-4xl px-6 py-14">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Sheffield S9 · forging since 1953</p>
          <h1 className="mt-2 max-w-2xl text-4xl font-semibold tracking-tight">M6–M24, grade 8.8 to 12.9, from stock</h1>
          <p className="mt-3 max-w-xl text-lg text-muted-foreground">Two million pieces on the shelf. Same-day collection, next-day nationwide, certs with every batch.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground" href="#/quote">Request a quote</a>
            <a className="rounded-md border px-5 py-2.5 text-sm font-medium" href="#/stockists">Buy by the box</a>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-10">
        <StatsBand items={[
          { value: "2M+", label: "Pieces from stock" },
          { value: "73 yrs", label: "On the same street" },
          { value: "100%", label: "Cast-to-carton traceability" },
          { value: "By noon", label: "Quotes sent before 10" }]} />
      </section>

      {/* The spec table is the pitch. A buyer checks tolerance before prose. */}
      <section id="specs" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-3xl px-6 py-14">
          <SectionHeader eyebrow="The works" title="What we forge" description="Everything below is from stock. Fine threads and specials forge to order in ten working days." />
          <div className="mt-6 rounded-xl border bg-card">
            <SpecRow label="Thread range" value="M6 – M24" note="Metric coarse; fine to order" />
            <SpecRow label="Property classes" value={<a className="underline underline-offset-4" href="#/product">8.8 · 10.9 · 12.9 — full 12.9 datasheet</a>} highlight />
            <SpecRow label="Tensile, class 12.9" value="1220" unit="MPa min" />
            <SpecRow label="Finish" value="Plain · zinc · hot-dip galv" />
            <SpecRow label="Head marking" value="AF · class · cast code" note="Every piece, stamped" />
            <SpecRow label="Traceability" value="Full cast-to-carton" note="Certs with every batch" />
          </div>
        </div>
      </section>

      <section id="dl" className="mx-auto max-w-4xl px-6 py-14">
        <SectionHeader eyebrow="Paperwork" title="Download before you're asked" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <DownloadCard name="Full catalogue 2026" description="Every line, every finish, box quantities" size={4200000} href="#dl" />
          <DownloadCard name="898-1 cert template" description="What arrives with each batch" size={310000} href="#dl" />
          <DownloadCard name="Torque tables, all classes" description="Dry, lubricated, zinc-flake" size={220000} href="#dl" />
          <DownloadCard name="REACH & RoHS declaration" description="Current to 2027" size={120000} href="#dl" />
        </div>
      </section>

      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-4xl px-6 py-12">
          <LogoCloud label="On the approved lists at" items={[{ name: "Network Rail" }, { name: "Sheffield Forgemasters" }, { name: "JCB" }, { name: "Severfield" }]} />
        </div>
      </section>

      <section id="quote" className="mx-auto max-w-3xl px-6 py-14">
        <SectionHeader eyebrow="Priced by lunchtime" title="Quick question, quick answer" description="A whole schedule? The quote page takes it pasted straight in, spreadsheet rows and all." />
        <ContactForm className="mt-6" askPhone sent={sent} onSubmit={() => setSent(true)} />
        <p className="mt-3 text-sm"><a className="font-medium underline underline-offset-4" href="#/quote">Or the full RFQ form →</a></p>
      </section>

      <section className="mx-auto max-w-4xl px-6 pb-16">
        <CtaBand title="Schedule in hand?" description="Paste it whole — priced line by line, certs listed, by lunchtime." action={{ label: "Request a quote", href: "#/quote" }} />
      </section>
    </SiteChrome>
  );
}
