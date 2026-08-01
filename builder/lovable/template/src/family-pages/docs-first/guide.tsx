// docs-first /guide — the walkthrough: install to first result, in order. The
// sidebar persists (it IS the family), every step ends in runnable code, and
// the page hands you to the reference when you outgrow it.
import { createFileRoute } from "@tanstack/react-router";
import { AnchorHeading } from "@/components/ui/anchor-heading";
import { CodeBlock } from "@/components/ui/code-block";
import { InstallCommand } from "@/components/ui/install-command";
import { PrevNext } from "@/components/ui/prev-next";
import { SideNav } from "@/components/ui/side-nav";
export const Route = createFileRoute("/guide")({ component: P });
const NAV = [
  { title: "Start", items: [{ label: "Install", href: "#/" }, { label: "Guide", href: "#/guide" }] },
  { title: "Reference", items: [{ label: "API", href: "#/api" }, { label: "Examples", href: "#/examples" }, { label: "Changelog", href: "#/changelog" }] },
];
function P() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <a href="#/" className="font-semibold tracking-tight">littletable</a>
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><span>v3.2</span><span>·</span><a href="#/api" className="hover:text-foreground">API</a></div>
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-10 md:grid-cols-[210px_1fr]">
        <SideNav active="#/guide" sections={NAV} />
        <main className="min-w-0 max-w-prose">
          <h1 className="text-3xl font-semibold tracking-tight">From install to a sorted table</h1>
          <p className="mt-2 text-muted-foreground">Ten minutes, three steps, no configuration files.</p>
          <AnchorHeading id="step-1" className="mt-8 text-xl font-medium">1. Install</AnchorHeading>
          <div className="mt-3"><InstallCommand pkg="littletable" /></div>
          <AnchorHeading id="step-2" className="mt-8 text-xl font-medium">2. Render your rows</AnchorHeading>
          <p className="mt-2 text-muted-foreground">Rows are plain objects; columns are the keys you want shown, in order.</p>
          <div className="mt-3"><CodeBlock language="tsx" code={'import { LittleTable } from "littletable";\n\nconst invoices = [\n  { ref: "INV-204", due: "2026-08-14", total: 1240 },\n  { ref: "INV-205", due: "2026-08-21", total: 386 },\n];\n\n<LittleTable rows={invoices} columns={["ref", "due", "total"]} />'} /></div>
          <AnchorHeading id="step-3" className="mt-8 text-xl font-medium">3. Let people sort it</AnchorHeading>
          <p className="mt-2 text-muted-foreground">Sorting is on by default. To START sorted, say which column and which way — that's the whole API.</p>
          <div className="mt-3"><CodeBlock language="tsx" code={'<LittleTable\n  rows={invoices}\n  columns={["ref", "due", "total"]}\n  sort={{ by: "due", dir: "asc" }}\n/>'} /></div>
          <p className="mt-6 text-sm text-muted-foreground">That's a working table. Column widths, empty states and keyboard navigation are already handled — see the <a className="font-medium underline underline-offset-4" href="#/api">API reference</a> when you need to change them.</p>
          <PrevNext className="mt-12" prev={{ label: "Install", href: "#/" }} next={{ label: "API reference", href: "#/api" }} />
        </main>
      </div>
    </div>
  );
}
