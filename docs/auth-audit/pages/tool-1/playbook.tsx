import { createFileRoute, Navigate, Link } from "@tanstack/react-router";

import { useMember, useRows, type Row } from "@/lib/rows";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty } from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/section-header";

export const Route = createFileRoute("/playbook")({ component: Playbook });

type PlaybookEntry = Row & { title: string; body: string | null };

function Playbook() {
  const member = useMember();

  if (member.isPending) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Checking your sign-in…</div>;
  }

  if (!member.data) {
    return <Navigate to="/" />;
  }

  return <PlaybookList />;
}

function PlaybookList() {
  const entries = useRows<PlaybookEntry>("playbook", { order: "id", dir: "asc" });

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Button asChild variant="ghost" size="sm">
        <Link to="/records">← Back to records</Link>
      </Button>

      <SectionHeader className="mt-4" eyebrow="Reference" title="The team's playbook" description="Maintained by the business — read here, edited elsewhere." />

      <div className="mt-8 space-y-6">
        {entries.isPending && <Skeleton className="h-40 rounded-xl" />}
        {entries.isError && (
          <p className="text-sm text-destructive">Couldn't load the playbook. Refresh and try again.</p>
        )}
        {!entries.isPending && !entries.isError && entries.data?.length === 0 && (
          <Empty title="Nothing here yet" description="The playbook is empty for now — check back later." />
        )}
        {entries.data?.map((entry) => (
          <article key={entry.id} className="rounded-lg border border-border p-5">
            <h3 className="text-lg font-semibold tracking-tight">{entry.title}</h3>
            {entry.body && <p className="mt-2 text-sm text-muted-foreground whitespace-pre-line">{entry.body}</p>}
          </article>
        ))}
      </div>
    </div>
  );
}
