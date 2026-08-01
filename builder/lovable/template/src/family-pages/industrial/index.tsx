// industrial — specs and downloads lead; the quote path is the conversion.
// A fastener manufacturer.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { ContactForm } from "@/components/ui/contact-form";
import { DownloadCard } from "@/components/ui/download-card";
import { SpecRow } from "@/components/ui/spec-row";
export const Route = createFileRoute("/")({ component: P });
function P() {
  const [sent, setSent] = useState(false);
  return (
    <SiteChrome name="Attercliffe Fastenings" tagline="Cold-forged fasteners since 1953. BS EN ISO 898-1."
      links={[{ label: "Specs", href: "#specs" }, { label: "The 12.9 line", href: "#/product" }, { label: "Stockists", href: "#/stockists" }, { label: "Downloads", href: "#dl" }]}
      action={{ label: "Request quote", href: "#/quote" }}>
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">M6–M24, grade 8.8 to 12.9, from stock</h1>
        <p className="mt-2 max-w-xl text-muted-foreground">Two million pieces on the shelf in S9. Same-day collection, next-day nationwide.</p>
        {/* The spec table is the pitch. A buyer checks tolerance before prose. */}
        <section id="specs" className="mt-8 rounded-xl border">
          <SpecRow label="Thread range" value="M6 – M24" note="Metric coarse; fine to order" />
          <SpecRow label="Property classes" value={<a className="underline underline-offset-4" href="#/product">8.8 · 10.9 · 12.9 — full 12.9 datasheet</a>} highlight />
          <SpecRow label="Tensile, class 12.9" value="1220" unit="MPa min" />
          <SpecRow label="Finish" value="Plain · zinc · hot-dip galv" />
          <SpecRow label="Traceability" value="Full cast-to-carton" note="Certs with every batch" />
        </section>
        <section id="dl" className="mt-8 grid gap-4 sm:grid-cols-2">
          <DownloadCard name="Full catalogue 2026" description="Every line, every finish, box quantities" size={4_200_000} href="#dl" />
          <DownloadCard name="898-1 cert template" description="What arrives with each batch" size={310_000} href="#dl" />
        </section>
        <section id="quote" className="mt-10">
          <h2 className="text-lg font-medium">Priced by lunchtime</h2>
          <p className="mt-1 text-sm text-muted-foreground">Quick question — use the form. A whole schedule — the <a className="font-medium underline underline-offset-4" href="#/quote">quote page</a> takes it pasted whole.</p>
          <ContactForm className="mt-4" askPhone sent={sent} onSubmit={() => setSent(true)} />
        </section>
      </div>
    </SiteChrome>
  );
}
