// docs-first — the hero is the install command. The landing is running-in-a-
// minute: the one-liner, the sixty-second proof, the three doors in, and the
// sidebar that never leaves. Density is the aesthetic here.
import { createFileRoute } from "@tanstack/react-router";
import { SideNav } from "@/components/ui/side-nav";
import { CodeBlock } from "@/components/ui/code-block";
import { InstallCommand } from "@/components/ui/install-command";
import { LinkCard } from "@/components/ui/link-card";
import { PrevNext } from "@/components/ui/prev-next";
import { StatsBand } from "@/components/ui/stats-band";
export const Route = createFileRoute("/")({ component: P });
const NAV = [
  { title: "Start", items: [{ label: "Install", href: "#install" }, { label: "Guide", href: "#/guide" }] },
  { title: "Reference", items: [{ label: "API", href: "#/api" }, { label: "Examples", href: "#/examples" }, { label: "Changelog", href: "#/changelog" }] },
];
function P() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <span className="font-semibold tracking-tight">littletable</span>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>v3.2</span><span aria-hidden="true">·</span>
            <a href="#/changelog" className="hover:text-foreground">Changelog</a>
            <a href="#/guide" className="rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground">Get started</a>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-10 md:grid-cols-[210px_1fr]">
        <SideNav active="#install" sections={NAV} />
        <main className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">React data tables · 4.1 kB gzipped · MIT</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">A table in one import</h1>
          <p className="mt-3 max-w-prose text-lg text-muted-foreground">Rows and columns in, a sorted, keyboard-navigable, empty-state-handled table out. Everything is on by default and removable — not the other way round.</p>
          <div id="install" className="mt-6"><InstallCommand pkg="littletable" /></div>

          <h2 className="mt-10 text-xl font-medium">Sixty seconds to a table</h2>
          <p className="mt-2 max-w-prose text-muted-foreground">Hand it rows and columns. Sorting, keyboard and the empty state are already handled.</p>
          <div className="mt-4"><CodeBlock language="tsx" code={'import { LittleTable } from "littletable";\n\nconst invoices = [\n  { ref: "INV-204", due: "2026-08-14", total: 1240 },\n  { ref: "INV-205", due: "2026-08-21", total: 386 },\n];\n\n<LittleTable rows={invoices} columns={["ref", "due", "total"]} />'} /></div>

          <StatsBand className="mt-10" items={[
            { value: "4.1 kB", label: "Gzipped, no dependencies" },
            { value: "200+", label: "Rows before virtualising kicks in, automatically" },
            { value: "9.4k", label: "Stars, for what that's worth" }]} />

          <h2 className="mt-10 text-xl font-medium">Where next</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <LinkCard title="The guide" description="Install to first sorted table, in order." href="#/guide" />
            <LinkCard title="API reference" description="Every prop, its type, its default." href="#/api" />
            <LinkCard title="Cookbook" description="Whole recipes for the jobs you arrived with." href="#/examples" />
          </div>

          <PrevNext className="mt-12" next={{ label: "Guide — first table to sorted", href: "#/guide" }} />
        </main>
      </div>
    </div>
  );
}
