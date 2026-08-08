import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { useMember, useRows, useUpdateRow, type Row } from "@/lib/rows";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RecordHeader } from "@/components/ui/record-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { ActivityFeed } from "@/components/ui/activity-feed";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/record")({
  component: RecordPage,
  validateSearch: (search: Record<string, unknown>): { id?: string } => ({
    id: typeof search.id === "string" ? search.id : undefined,
  }),
});

type Deal = Row & { title: string; value: string | null; stage: string | null };

const STAGES = ["new", "qualified", "proposal", "won", "lost"] as const;

function stageState(stage: string | null): "success" | "warning" | "danger" | "neutral" {
  if (stage === "won") return "success";
  if (stage === "lost") return "danger";
  if (stage === "proposal") return "warning";
  return "neutral";
}

function RecordPage() {
  const { id } = Route.useSearch();
  const member = useMember();
  const deals = useRows<Deal>("deals");
  const update = useUpdateRow<Deal>("deals");
  const [valueDraft, setValueDraft] = useState<string | null>(null);
  const [trail, setTrail] = useState<{ who: string; what: string; at: Date }[]>([]);

  const deal = deals.data?.find((d) => String(d.id) === id);

  if (member.isPending) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Checking your sign-in…</div>;
  }

  if (!member.data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-10 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in to view this record</h1>
        <Button asChild>
          <Link to="/">Go to sign in</Link>
        </Button>
      </div>
    );
  }

  if (!id) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-10 text-center">
        <p className="text-muted-foreground">No record chosen.</p>
        <Button asChild variant="outline">
          <Link to="/records">Back to records</Link>
        </Button>
      </div>
    );
  }

  if (deals.isPending) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }

  if (deals.isError) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <p className="text-sm text-destructive">Couldn't load this record. Refresh and try again.</p>
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="mx-auto max-w-3xl p-8 text-center">
        <h1 className="text-xl font-semibold">Not found</h1>
        <p className="mt-2 text-muted-foreground">
          This record isn't there — it may have been removed by the team.
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/records">Back to records</Link>
        </Button>
      </div>
    );
  }

  const setStage = (stage: string) => {
    update.mutate(
      { id: deal.id, values: { stage } },
      {
        onSuccess: () => {
          toast.success(`Moved to ${stage}`);
          setTrail((prev) => [
            { who: member.data!.name ?? member.data!.email, what: `moved this to ${stage}`, at: new Date() },
            ...prev,
          ]);
        },
        onError: (e: Error) => toast.error(e.message),
      },
    );
  };

  const saveValue = () => {
    if (valueDraft === null) return;
    update.mutate(
      { id: deal.id, values: { value: valueDraft } },
      {
        onSuccess: () => {
          toast.success("Value updated");
          setTrail((prev) => [
            { who: member.data!.name ?? member.data!.email, what: `updated the value to ${valueDraft}`, at: new Date() },
            ...prev,
          ]);
          setValueDraft(null);
        },
        onError: (e: Error) => toast.error(e.message),
      },
    );
  };

  return (
    <div className="mx-auto max-w-3xl p-8">
      <Link to="/records" className="text-sm text-muted-foreground underline underline-offset-4">
        Back to records
      </Link>

      <RecordHeader
        className="mt-4"
        title={deal.title}
        subtitle="Shared with the team"
        status={<StatusBadge state={stageState(deal.stage)}>{deal.stage ?? "new"}</StatusBadge>}
      />

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Value</p>
          <div className="mt-1 flex gap-2">
            <Input
              value={valueDraft ?? deal.value ?? ""}
              onChange={(e) => setValueDraft(e.target.value)}
              placeholder="£0"
            />
            <Button
              variant="outline"
              disabled={update.isPending || valueDraft === null}
              onClick={saveValue}
            >
              Save
            </Button>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-muted-foreground">Stage</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {STAGES.map((s) => (
              <button
                key={s}
                onClick={() => setStage(s)}
                disabled={update.isPending}
                className={`rounded-full border px-3 py-1 text-xs motion-press ${
                  deal.stage === s ? "border-primary bg-primary/10 font-medium" : "border-border"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-10">
        <h2 className="text-sm font-medium text-muted-foreground">Activity</h2>
        <ActivityFeed
          className="mt-3"
          empty="No changes yet in this session — edits made here will show up below."
          items={trail.map((t) => ({ who: t.who, what: t.what, at: t.at }))}
        />
      </div>
    </div>
  );
}
