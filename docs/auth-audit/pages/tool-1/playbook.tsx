import { createFileRoute, Link } from "@tanstack/react-router";

import { useMember, useRows, type Row } from "@/lib/rows";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty } from "@/components/ui/empty";

export const Route = createFileRoute("/playbook")({ component: Playbook });

type PlaybookEntry = Row & { title: string; body: string | null };

function Playbook() {
  const member = useMember();
  const entries = useRows<PlaybookEntry>("playbook", { order: "id", dir: "asc" });

  if (member.isPending) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <Skeleton className="h-40 rounded-xl" />
      </main>
    );
  }

  if (!member.data) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-10 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Halyard</h1>
        <p className="text-muted-foreground">Sign in to read the playbook.</p>
        <Button asChild>
          <Link to="/">Sign in</Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl p-8">
      <Link to="/records" className="text-sm text-muted-foreground underline underline-offset-4">
        Back to records
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Playbook</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Maintained by the business — read here, edited elsewhere.
      </p>

      <div className="mt-6 grid gap-4">
        {entries.isPending && <Skeleton className="h-40 rounded-xl" />}
        {entries.isError && (
          <p className="text-sm text-destructive">Couldn't load the playbook. Refresh and try again.</p>
        )}
        {!entries.isPending && !entries.isError && entries.data?.length === 0 && (
          <Empty title="Nothing here yet" description="The team hasn't published any playbook entries." />
        )}
        {entries.data?.map((e) => (
          <Card key={e.id}>
            <CardHeader>
              <CardTitle className="text-base">{e.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-line text-sm text-muted-foreground">{e.body ?? "—"}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
