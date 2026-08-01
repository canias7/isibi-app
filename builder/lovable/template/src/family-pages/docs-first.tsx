// docs-first — "the hero is the install command". Directive components only.
import { createFileRoute } from "@tanstack/react-router";
import { SideNav } from "@/components/ui/side-nav";
import { CodeBlock } from "@/components/ui/code-block";
import { InstallCommand } from "@/components/ui/install-command";
import { PrevNext } from "@/components/ui/prev-next";
export const Route = createFileRoute("/")({ component: P });
function P() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <span className="font-semibold tracking-tight">littletable</span>
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><span>v3.2</span><span>·</span><a href="#install" className="hover:text-foreground">Get started</a></div>
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-10 md:grid-cols-[210px_1fr]">
        <SideNav active="#install" sections={[
          { title: "Start", items: [{ label: "Install", href: "#install" }, { label: "First table", href: "#first" }] },
          { title: "Guides", items: [{ label: "Sorting", href: "#sorting" }, { label: "Virtual rows", href: "#virtual" }, { label: "Server data", href: "#server" }] },
        ]} />
        <main className="min-w-0">
          <h1 className="text-3xl font-semibold tracking-tight">A table in one import</h1>
          {/* The landed install-command: one package name, every manager's exact
              line, remembered choice, copy built in. */}
          <div id="install" className="mt-6"><InstallCommand pkg="littletable" /></div>
          <h2 id="first" className="mt-10 text-xl font-medium">Your first table</h2>
          <p className="mt-2 max-w-prose text-muted-foreground">Hand it rows and columns. Everything else — sorting, keyboard, empty states — is on by default and removable, not the other way round.</p>
          <div className="mt-4"><CodeBlock language="tsx" code={'import { LittleTable } from "littletable";\n\n<LittleTable rows={invoices} columns={["ref", "due", "total"]} />'} /></div>
          <PrevNext className="mt-12" next={{ label: "Sorting", href: "#sorting" }} />
        </main>
      </div>
    </div>
  );
}
