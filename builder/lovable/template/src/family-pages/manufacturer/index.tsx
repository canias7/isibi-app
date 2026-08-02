// manufacturer — SPLIT-SCREEN structure: the buyer's standing facts pinned
// left (what we make, the quote path, who answers the phone), the evidence
// scrolling right (specs, paperwork, approvals). A catalogue's endpapers
// and its plates, side by side.
import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { DownloadCard } from "@/components/ui/download-card";
import { LogoCloud } from "@/components/ui/logo-cloud";
import { SpecRow } from "@/components/ui/spec-row";
import { SafeImage } from "@/components/ui/safe-image";
import { StatsBand } from "@/components/ui/stats-band";
export const Route = createFileRoute("/")({ component: P });
function P() {
  return (
    <SiteChrome name="Attercliffe Fastenings" tagline="Cold-forged fasteners since 1953. BS EN ISO 898-1."
      links={[{ label: "The 12.9 line", href: "#/product" }, { label: "Stockists", href: "#/stockists" }]}
      action={{ label: "Request quote", href: "#/quote" }}>

      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-10 md:grid-cols-[2fr_3fr]">
        {/* LEFT — pinned: the claim, the action, the phone. */}
        <div className="self-start md:sticky md:top-20">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Sheffield S9 · forging since 1953</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">M6–M24, grade 8.8 to 12.9, from stock</h1>
          <p className="mt-3 text-lg text-muted-foreground">Two million pieces on the shelf. Same-day collection, next-day nationwide, certs with every batch.</p>
          <div className="mt-6 grid gap-2">
            <a className="rounded-md bg-primary px-5 py-2.5 text-center text-sm font-medium text-primary-foreground" href="#/quote">Request a quote — priced by lunchtime</a>
            <a className="rounded-md border px-5 py-2.5 text-center text-sm font-medium" href="#/stockists">Buy by the box near you</a>
          </div>
          <div className="mt-6 rounded-lg border bg-muted/40 p-4 text-sm">
            <p className="font-medium">Trade counter, 7:30–4:30</p>
            <p className="mt-1 text-muted-foreground">Warhurst Road, S9 3TR · <a className="font-medium underline underline-offset-4" href="tel:+441142441953">0114 244 1953</a> — Marie or Stu answer, nobody else.</p>
          </div>
        </div>

        {/* RIGHT — the evidence, scrolling. */}
        <div className="grid gap-10">
          {/* The product and the floor it comes off. A manufacturer's site with
              no photograph of the part reads as a catalogue entry rather than a
              supplier — added 2026-08-02, when this column was six spec rows,
              a stats band and three PDF links. */}
          <div className="grid grid-cols-3 gap-4">
            <SafeImage src={null} alt="M12 × 60, class 12.9, head marking visible" ratio="1/1" />
            <SafeImage src={null} alt="The forging line, second shift" ratio="1/1" />
            <SafeImage src={null} alt="Cartons ready for the 4:30 collection" ratio="1/1" />
          </div>
          <div>
            <h2 className="text-lg font-medium">What we forge</h2>
            <div className="mt-3 rounded-xl border bg-card">
              <SpecRow label="Thread range" value="M6 – M24" note="Metric coarse; fine to order" />
              <SpecRow label="Property classes" value={<a className="underline underline-offset-4" href="#/product">8.8 · 10.9 · 12.9 — full datasheet</a>} highlight />
              <SpecRow label="Tensile, class 12.9" value="1220" unit="MPa min" />
              <SpecRow label="Finish" value="Plain · zinc · hot-dip galv" />
              <SpecRow label="Head marking" value="AF · class · cast code" note="Every piece, stamped" />
              <SpecRow label="Traceability" value="Full cast-to-carton" note="Certs with every batch" />
            </div>
          </div>
          <StatsBand items={[
            { value: "2M+", label: "Pieces from stock" },
            { value: "73 yrs", label: "Same street" },
            { value: "By noon", label: "Quotes sent before 10" }]} />
          <div>
            <h2 className="text-lg font-medium">The paperwork, before you ask</h2>
            <div className="mt-3 grid gap-3">
              <DownloadCard name="Full catalogue 2026" description="Every line, every finish, box quantities" size={4200000} href="#dl" />
              <DownloadCard name="898-1 cert template" description="What arrives with each batch" size={310000} href="#dl" />
              <DownloadCard name="Torque tables, all classes" description="Dry, lubricated, zinc-flake" size={220000} href="#dl" />
              <DownloadCard name="REACH & RoHS declaration" description="Current to 2027" size={120000} href="#dl" />
            </div>
          </div>
          <LogoCloud label="On the approved lists at" items={[{ name: "Network Rail" }, { name: "Sheffield Forgemasters" }, { name: "JCB" }, { name: "Severfield" }]} />
        </div>
      </div>
    </SiteChrome>
  );
}
