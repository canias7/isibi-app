// docs-first /examples — the cookbook. The guide teaches the model of the
// thing; recipes solve the job somebody arrived with. Each one is complete
// and copyable — a snippet that needs three unstated imports is a support
// ticket with syntax highlighting.
import { createFileRoute } from "@tanstack/react-router";
import { AnchorHeading } from "@/components/ui/anchor-heading";
import { CodeBlock } from "@/components/ui/code-block";
import { PrevNext } from "@/components/ui/prev-next";
import { SideNav } from "@/components/ui/side-nav";
export const Route = createFileRoute("/examples")({ component: P });
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
        <SideNav active="#/examples" sections={NAV} />
        <main className="min-w-0 max-w-prose">
          <h1 className="text-3xl font-semibold tracking-tight">Cookbook</h1>
          <p className="mt-2 text-muted-foreground">Whole, runnable recipes for the jobs people actually show up with. Copy the block; nothing is left out of it.</p>
          <AnchorHeading id="server-rows" className="mt-8 text-xl font-medium">Rows from the hosted API, with loading and error</AnchorHeading>
          <div className="mt-3"><CodeBlock language="tsx" code={'import { useEffect, useState } from "react";\nimport { LittleTable } from "littletable";\nimport { lt } from "littletable/client";\n\nexport function Invoices() {\n  const [rows, setRows] = useState<Invoice[] | null>(null);\n  const [error, setError] = useState<string | null>(null);\n\n  useEffect(() => {\n    lt("invoices").rows().then(setRows, (e) => setError(e.message));\n  }, []);\n\n  if (error) return <p role="alert">Couldn\'t load: {error}</p>;\n  if (!rows) return <LittleTable.Skeleton columns={3} />;\n  return <LittleTable rows={rows} columns={["ref", "due", "total"]} />;\n}'} /></div>
          <AnchorHeading id="money" className="mt-10 text-xl font-medium">Formatting a money column</AnchorHeading>
          <p className="mt-2 text-muted-foreground">Format in the row, not in the cell renderer — sorting keeps working on the raw number.</p>
          <div className="mt-3"><CodeBlock language="tsx" code={'const gbp = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });\n\n<LittleTable\n  rows={invoices}\n  columns={["ref", "due", "total"]}\n  render={{ total: (v) => gbp.format(v as number) }}\n  sort={{ by: "total", dir: "desc" }}\n/>'} /></div>
          <AnchorHeading id="row-actions" className="mt-10 text-xl font-medium">A button on every row</AnchorHeading>
          <div className="mt-3"><CodeBlock language="tsx" code={'<LittleTable\n  rows={invoices}\n  columns={["ref", "due", "total", "actions"]}\n  render={{\n    actions: (_v, row) => (\n      <button onClick={() => window.open(`/invoices/${row.ref}.pdf`)}>PDF</button>\n    ),\n  }}\n/>'} /></div>
          <PrevNext className="mt-12" prev={{ label: "API reference", href: "#/api" }} next={{ label: "Changelog", href: "#/changelog" }} />
        </main>
      </div>
    </div>
  );
}
