// docs-first /changelog — reverse-chronological, no marketing. Version, date,
// what kind of change, one honest sentence each. The taxonomy's own words:
// a changelog is a feed with the marketing removed.
import { createFileRoute } from "@tanstack/react-router";
import { ChangelogEntry } from "@/components/ui/changelog-entry";
import { PrevNext } from "@/components/ui/prev-next";
import { SideNav } from "@/components/ui/side-nav";
export const Route = createFileRoute("/changelog")({ component: P });
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
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><span>v3.2</span><span>·</span><a href="#/api" className="hover:text-foreground">API</a></div>
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-10 md:grid-cols-[210px_1fr]">
        <SideNav active="#/changelog" sections={NAV} />
        <main className="min-w-0 max-w-prose">
          <h1 className="text-3xl font-semibold tracking-tight">Changelog</h1>
          <p className="mt-2 text-muted-foreground">Every release, newest first. Breaking changes get a migration line, always.</p>
          <div className="mt-6">
            <ChangelogEntry version="3.2.0" date="2026-07-22" tag="new">
              Row virtualisation turns on automatically past 200 rows. Nothing to configure; pass <code>virtual=&#123;false&#125;</code> to keep the old behaviour.
            </ChangelogEntry>
            <ChangelogEntry version="3.1.2" date="2026-07-03" tag="fixed">
              Sorting a column of nulls no longer throws. Nulls sort last in both directions, which is what every issue asking about it wanted.
            </ChangelogEntry>
            <ChangelogEntry version="3.1.0" date="2026-06-11" tag="new">
              <code>empty</code> prop — what renders with zero rows. Defaults to the old "No rows" text.
            </ChangelogEntry>
            <ChangelogEntry version="3.0.0" date="2026-05-02" tag="changed">
              <code>cols</code> renamed to <code>columns</code>. A codemod ships in the package: <code>npx littletable-migrate v3</code>. That is the whole breaking change.
            </ChangelogEntry>
          </div>
          <PrevNext className="mt-12" prev={{ label: "API reference", href: "#/api" }} />
        </main>
      </div>
    </div>
  );
}
