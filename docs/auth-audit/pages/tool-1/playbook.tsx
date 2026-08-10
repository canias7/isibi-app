import { createFileRoute, Link } from "@tanstack/react-router";

import { useMember, useRows, type Row } from "@/lib/rows";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SideNav } from "@/components/ui/side-nav";
import { Empty } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/playbook")({ component: Playbook });

type Play = Row & { title: string; body: string | null };

function Playbook() {
  const member = useMember();
  const plays = useRows<Play>("playbook", { order: "id", dir: "asc" });

  if (!member.isPending && !member.data) {
    return (
      <main className="flex min-h-screen items-center justify-center p-10">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Sign in required</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Sign in to read the team's playbook.
            </p>
            <Button asChild className="mt-4">
              <Link to="/">Go to sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-56 shrink-0 border-r border-border p-6 md:block">
        <p className="mb-6 text-lg font-semibold tracking-tight">Halyard</p>
        <SideNav
          sections={[
            {
              items: [
                { label: "Deals", href: "/records" },
                { label: "Accounts", href: "/accounts" },
                { label: "Playbook", href: "/playbook" },
              ],
            },
          ]}
          active="/playbook"
        />
      </aside>

      <main className="flex-1 p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Playbook</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Maintained by the team lead. Read-only from here.
        </p>

        <div className="mt-6 grid gap-4">
          {plays.isPending && <Skeleton className="h-40 rounded-xl" />}
          {plays.isError && (
            <p className="text-sm text-destructive">Couldn't load the playbook. Refresh and try again.</p>
          )}
          {!plays.isPending && !plays.isError && plays.data?.length === 0 && (
            <Empty
              title="No plays published yet"
              description="Your team lead hasn't added anything to the playbook."
            />
          )}
          {!plays.isPending &&
            !plays.isError &&
            plays.data?.map((p) => (
              <Card key={p.id}>
                <CardHeader>
                  <CardTitle className="text-base">{p.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-line text-sm text-muted-foreground">{p.body}</p>
                </CardContent>
              </Card>
            ))}
        </div>
      </main>
    </div>
  );
}
