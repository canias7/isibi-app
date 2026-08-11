import { createFileRoute, Link } from "@tanstack/react-router";

import { useMember, useRows, type Row } from "@/lib/rows";
import { Button } from "@/components/ui/button";
import { SideNav } from "@/components/ui/side-nav";
import { Empty } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/playbook")({ component: Playbook });

type PlaybookEntry = Row & { title: string; body: string | null };

function Playbook() {
  const member = useMember();
  const entries = useRows<PlaybookEntry>("playbook", { order: "id", dir: "asc" });

  if (member.isPending) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Checking your sign-in…</p>
      </main>
    );
  }

  if (!member.data) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 text-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sign in to read the playbook</h1>
          <Button asChild className="mt-6">
            <Link to="/">Go to sign in</Link>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 shrink-0 border-r border-border bg-muted/30 p-6">
        <p className="text-lg font-semibold tracking-tight">Halyard</p>
        <SideNav
          className="mt-6"
          active="playbook"
          sections={[
            {
              title: "Records",
              items: [
                { label: "Deals", href: "/records" },
                { label: "Accounts", href: "/records?tab=accounts" },
                { label: "Playbook", href: "/playbook" },
              ],
            },
          ]}
        />
      </aside>

      <main className="flex-1 p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Playbook</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Shared reference the team reads. Kept up to date from outside the tool.
        </p>

        <div className="mt-6 grid gap-4">
          {entries.isPending && <Skeleton className="h-40 rounded-xl" />}
          {entries.isError && (
            <p className="text-sm text-destructive">Couldn't load the playbook. Refresh and try again.</p>
          )}
          {entries.data?.length === 0 && (
            <Empty title="Nothing here yet" description="The playbook is empty for now — check back later." />
          )}
          {entries.data?.map((entry) => (
            <Card key={entry.id}>
              <CardHeader>
                <CardTitle className="text-base">{entry.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-line text-sm text-muted-foreground">{entry.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
