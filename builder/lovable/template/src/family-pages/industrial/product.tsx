// industrial /product — one line in full: the complete spec table and every
// document a buyer's QA department will ask for. The prose stays at two
// sentences; past that a buyer stops trusting the page.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Badge } from "@/components/ui/badge";
import { DownloadCard } from "@/components/ui/download-card";
import { FileList } from "@/components/ui/file-list";
import { SpecRow } from "@/components/ui/spec-row";
export const Route = createFileRoute("/product")({ component: P });
const CHROME = {
  name: "Attercliffe Fastenings", tagline: "Cold-forged fasteners since 1953. BS EN ISO 898-1.",
  links: [{ label: "Home", href: "#/" }, { label: "This line", href: "#/product" }],
  action: { label: "Request quote", href: "#/quote" },
};
function P() {
  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-3xl px-6 py-12">
        <a className="text-sm text-muted-foreground underline underline-offset-4" href="#/">← All lines</a>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">Hex bolt, class 12.9, plain</h1>
          <Badge variant="secondary">From stock</Badge>
        </div>
        <p className="mt-2 max-w-xl text-muted-foreground">Our highest-tensile line, cold-forged in S9 from boron steel we buy certified. This page is the datasheet.</p>
        <section className="mt-8 rounded-xl border">
          <SpecRow label="Standard" value="BS EN ISO 4014 / 898-1" highlight />
          <SpecRow label="Sizes from stock" value="M8 – M20" note="M6 and M24 forged to order, 10 working days" />
          <SpecRow label="Tensile strength" value="1220" unit="MPa min" />
          <SpecRow label="Proof load, M12" value="74.2" unit="kN" />
          <SpecRow label="Hardness" value="39 – 44 HRC" />
          <SpecRow label="Thread tolerance" value="6g" />
          <SpecRow label="Marking" value="AF · 12.9 · cast code" note="Head-stamped, every piece" />
          <SpecRow label="Box quantities" value="M8 ×200 · M12 ×100 · M16 ×50 · M20 ×25" />
        </section>
        <section className="mt-8">
          <h2 className="text-lg font-medium">The paperwork, up front</h2>
          <p className="mt-1 text-sm text-muted-foreground">Everything QA asks for, downloadable before you order rather than chased after.</p>
          <FileList className="mt-3" files={[
            { name: "datasheet-hex-129.pdf", size: 480_000, href: "#/product", meta: "Rev 6, June 2026" },
            { name: "898-1-type-cert.pdf", size: 310_000, href: "#/product", meta: "Sample batch certificate" },
            { name: "hex-129.step", size: 2_100_000, href: "#/product", meta: "CAD, all sizes" },
            { name: "reach-rohs-declaration.pdf", size: 120_000, href: "#/product", meta: "Current to 2027" },
          ]} />
        </section>
        <section className="mt-8 grid gap-4 sm:grid-cols-2">
          <DownloadCard name="Torque tables, 12.9" description="Dry, lubricated, and zinc-flake figures" size={220_000} href="#/product" />
          <DownloadCard name="Full catalogue 2026" description="Every line, every finish, box quantities" size={4_200_000} href="#/product" />
        </section>
        <div className="mt-10 rounded-xl border bg-muted/40 p-6 text-center">
          <p className="font-medium">Schedule in hand?</p>
          <p className="mt-1 text-sm text-muted-foreground">Paste it into the quote form — priced by lunchtime, certs listed line by line.</p>
          <a className="mt-3 inline-block rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background" href="#/quote">Request a quote</a>
        </div>
      </div>
    </SiteChrome>
  );
}
