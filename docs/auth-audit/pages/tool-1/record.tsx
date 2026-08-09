import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { useMember, useRows, useUpdateRow, type Row } from "@/lib/rows";
import { Button } from "@/components/ui/button";
import { RecordHeader } from "@/components/ui/record-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { ActivityFeed, type Activity } from "@/components/ui/activity-feed";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/record")({
  component: RecordPage,
  validateSearch: (search: Record<string, unknown>): { id?: string } => ({
    id: typeof search.id === "string" ? search.id : undefined,
  }),
});

type Deal = Row & { title: string; value: string | null; stage: string | null };

const STAGES = ["new", "qualifying", "proposal", "negotiation", "won", "lost"];

function stageState(stage: string | null): "success" | "warning" | "danger" | "neutral" {
  if (stage === "won") return "success";
  if (stage === "lost") return "danger";
  if (stage === "negotiation" || stage === "proposal") return "warning";
  return "neutral";
}

function RecordPage() {
  const member = useMember();
  const { id } = Route.useSearch();
  const deals = useRows<Deal>("deals");
  const update = useUpdateRow<Deal>("deals");
  const [valueDraft, setValueDraft] = useState<string | null>(null);

  if (member.isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Checking your sign-in…</p>
      </div>
    );
  }

  if (!member.data) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Sign in to view this record</h1>
          <p className="mt-2 text-muted-foreground">Deal records are private to signed-in members.</p>
          <Button asChild className="mt-6">
            <Link to="/">Go to sign in</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!id) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <h1 className="text-2xl font-semibold tracking-tight">No record chosen</h1>
          <p className="mt-2 text-muted-foreground">Open a deal from the pipeline table.</p>
          <Button asChild className="mt-6">
            <Link to="/records">Back to records</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (deals.isPending) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16">
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  if (deals.isError) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-sm text-destructive">Couldn't load this record. Refresh and try again.</p>
      </div>
    );
  }

  const deal = deals.data?.find((d) => String(d.id) === id);

  if (!deal) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">We couldn't find that deal</h1>
        <p className="mt-2 text-muted-foreground">It may have been removed.</p>
        <Button asChild className="mt-6">
          <Link to="/records">Back to records</Link>
        </Button>
      </div>
    );
  }

  const activity: Activity[] = [
    { who: "The team", what: `Created "${deal.title}"`, at: deal.created_at },
  ];
  if (deal.updated_at && deal.updated_at !== deal.created_at) {
    activity.push({ who: "The team", what: `Updated to stage "${deal.stage ?? "new"}"`, at: deal.updated_at });
  }

  const onStage = (stage: string) => {
    update.mutate(
      { id: deal.id, stage },
      {
        onSuccess: () => toast.success("Stage updated"),
        onError: (e) => toast.error(e.message),
      },
    );
  };

  const onValueSave = () => {
    if (valueDraft === null) return;
    update.mutate(
      { id: deal.id, value: valueDraft },
      {
        onSuccess: () => {
          toast.success("Value updated");
          setValueDraft(null);
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link to="/records" className="text-sm text-muted-foreground underline underline-offset-4">
        ← Back to our deals
      </Link>

      <div className="mt-4">
        <RecordHeader
          title={deal.title}
          subtitle="Shared with the team"
          status={<StatusBadge state={stageState(deal.stage)}>{deal.stage ?? "new"}</StatusBadge>}
        />
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium uppercase text-muted-foreground">Value</p>
          <div className="mt-2 flex gap-2">
            <Input
              value={valueDraft ?? deal.value ?? ""}
              onChange={(e) => setValueDraft(e.target.value)}
              placeholder="£12,000"
            />
            <Button
              variant="outline"
              disabled={update.isPending || valueDraft === null}
              onClick={onValueSave}
            >
              Save
            </Button>
          </div>
        </div>

        <div>
          <p className="text-xs font-medium uppercase text-muted-foreground">Stage</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {STAGES.map((s) => (
              <button
                key={s}
                className={`rounded-md border px-2 py-1 text-xs capitalize motion-press ${deal.stage === s ? "border-primary bg-primary/10" : "border-border"}`}
                disabled={update.isPending}
                onClick={() => onStage(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-10">
        <p className="text-xs font-medium uppercase text-muted-foreground">Activity</p>
        <ActivityFeed className="mt-3" items={activity} empty="Nothing has happened on this deal yet." />
      </div>
    </div>
  );
}
