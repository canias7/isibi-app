import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import { useMember, useRows, type Row } from "@/lib/rows";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { TableSearch } from "@/components/ui/table-search";

export const Route = createFileRoute("/playbook")({ component: Playbook });

type Play = Row & { title: string; body: string | null };

function Playbook() {
  const member = useMember();
  const plays = useRows<Play>("playbook", { order: "id", dir: "asc" });
  const [query, setQuery] = useState("");

  if (member.isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Checking your sign-in…</p>
      </div>
    );
  }

  if (!member.data) {
    return (
      <div className="flex min-h-screen items-center justify-center p-10">
        <div className="max-w-sm text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Halyard</h1>
          <p className="mt-3 text-muted-foreground">Sign in to read the team playbook.</p>
          <Button asChild className="mt-6">
            <Link to="/">Sign in</Link>
          </Button>
        </div>
      </div>
    );
  }

  const filtered = (plays.data ?? []).filter((p) =>
    query ? p.title.toLowerCase().includes(query.toLowerCase()) : true,
  );

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-56 shrink-0 border-r border-border bg-muted/40 p-6 md:flex md:flex-col md:justify-between">
        <div>
          <p className="text-lg font-semibold tracking-tight">Halyard</p>
          <nav className="mt-8 grid gap-1 text-sm">
            <Link
              to="/records"
              className="rounded-md px-3 py-2 text-muted-foreground hover:bg-accent/50"
            >
              Deals
            </Link>
            <Link
              to="/accounts"
              className="rounded-md px-3 py-2 text-muted-foreground hover:bg-accent/50"
            >
              Accounts
            </Link>
            <Link
              to="/playbook"
              className="rounded-md bg-accent px-3 py-2 font-medium text-accent-foreground"
            >
              Playbook
            </Link>
          </nav>
        </div>
        <p className="text-xs text-muted-foreground">
          Signed in as {member.data.name || member.data.email}
        </p>
      </aside>

      <main className="flex-1 p-6 md:p-10">
        <h1 className="text-2xl font-semibold tracking-tight">Playbook</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Maintained by the business — read here, no edits from this page.
        </p>

        <div className="mt-6">
          <TableSearch
            value={query}
            onChange={setQuery}
            placeholder="Search the playbook…"
            count={filtered.length}
            total={plays.data?.length}
          />
        </div>

        <div className="mt-6 grid gap-4">
          {plays.isPending && <Skeleton className="h-40 rounded-xl" />}

          {plays.isError && (
            <p className="text-sm text-destructive">
              Couldn't load the playbook. Refresh and try again.
            </p>
          )}

          {!plays.isPending && !plays.isError && plays.data?.length === 0 && (
            <Empty
              title="Nothing published yet"
              description="The business hasn't added any playbook entries yet."
            />
          )}

          {!plays.isPending && !plays.isError && filtered.length > 0 && (
            <div className="grid gap-4 motion-stagger">
              {filtered.map((p) => (
                <Card key={p.id}>
                  <CardHeader>
                    <CardTitle className="text-base">{p.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="whitespace-pre-line text-sm text-muted-foreground">
                      {p.body ?? "No detail added yet."}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {!plays.isPending &&
            !plays.isError &&
            !!plays.data?.length &&
            filtered.length === 0 && (
              <Empty
                title="No matches"
                description="Nothing in the playbook matches that search."
              />
            )}
        </div>
      </main>
    </div>
  );
}
