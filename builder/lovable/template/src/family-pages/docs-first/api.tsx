// docs-first /api — the reference: every prop with its type and default,
// linkable headings, and the HTTP shape for the hosted half. Dense on
// purpose; the guide narrates, this page answers.
import { createFileRoute } from "@tanstack/react-router";
import { AnchorHeading } from "@/components/ui/anchor-heading";
import { CurlExample } from "@/components/ui/curl-example";
import { DataTable } from "@/components/ui/data-table";
import { PrevNext } from "@/components/ui/prev-next";
import { SdkTabs } from "@/components/ui/sdk-tabs";
import { SideNav } from "@/components/ui/side-nav";
export const Route = createFileRoute("/api")({ component: P });
const NAV = [
  { title: "Start", items: [{ label: "Install", href: "#/" }, { label: "Guide", href: "#/guide" }] },
  { title: "Reference", items: [{ label: "API", href: "#/api" }, { label: "Changelog", href: "#/changelog" }] },
];
function P() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <a href="#/" className="font-semibold tracking-tight">littletable</a>
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><span>v3.2</span><span>·</span><a href="#/guide" className="hover:text-foreground">Guide</a></div>
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-10 md:grid-cols-[210px_1fr]">
        <SideNav active="#/api" sections={NAV} />
        <main className="min-w-0">
          <h1 className="text-3xl font-semibold tracking-tight">API reference</h1>
          <AnchorHeading id="littletable-props" className="mt-8 text-xl font-medium">&lt;LittleTable&gt; props</AnchorHeading>
          <DataTable className="mt-3" columns={[{ key: "prop", header: "Prop" }, { key: "type", header: "Type" }, { key: "def", header: "Default" }, { key: "what", header: "What it does" }]} rows={[
            { prop: "rows", type: "T[]", def: "—", what: "Your data, plain objects" },
            { prop: "columns", type: "(keyof T)[]", def: "—", what: "Which keys show, in order" },
            { prop: "sort", type: "{ by, dir }", def: "none", what: "Initial sort; header clicks take over" },
            { prop: "empty", type: "ReactNode", def: '"No rows"', what: "What renders with zero rows" },
            { prop: "virtual", type: "boolean", def: "auto", what: "Row virtualisation past 200 rows" },
          ]} />
          <AnchorHeading id="fetch-rows" className="mt-10 text-xl font-medium">Hosted: fetch rows</AnchorHeading>
          <p className="mt-2 max-w-prose text-muted-foreground">The hosted API speaks plain JSON. Auth is a bearer key; the key here is a placeholder.</p>
          <CurlExample className="mt-3" method="GET" url="https://api.littletable.dev/v3/tables/invoices/rows" headers={{ Authorization: "Bearer lt_live_XXXX" }} secrets={["lt_live_XXXX"]} />
          <AnchorHeading id="sdk" className="mt-10 text-xl font-medium">The same call, in your language</AnchorHeading>
          <SdkTabs className="mt-3" samples={[
            { key: "ts", label: "TypeScript", lang: "ts", code: 'import { lt } from "littletable/client";\n\nconst rows = await lt("invoices").rows();' },
            { key: "py", label: "Python", lang: "python", code: 'from littletable import lt\n\nrows = lt("invoices").rows()' },
            { key: "sh", label: "curl", lang: "bash", code: 'curl -H "Authorization: Bearer $LT_KEY" \\\n  https://api.littletable.dev/v3/tables/invoices/rows' },
          ]} />
          <PrevNext className="mt-12" prev={{ label: "Guide", href: "#/guide" }} next={{ label: "Changelog", href: "#/changelog" }} />
        </main>
      </div>
    </div>
  );
}
