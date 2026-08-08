import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { useMember, useRows, useUpdateRow, useDeleteRow, type Row } from "@/lib/rows";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { RecordHeader } from "@/components/ui/record-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { ActivityFeed, type Activity } from "@/components/ui/activity-feed";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty } from "@/components/ui/empty";

export const Route = createFileRoute("/record")({
  component: RecordPage,
  validateSearch: (search: Record<string, unknown>): { id?: string } => ({
    id: typeof search.id === "string" ? search.id : undefined,
  }),
});

type Deal = Row & { title: string; value: string | null; stage: string | null };

const STAGES = ["New", "Qualifying", "Proposal", "Negotiation", "Won", "Lost"];

function stageState(stage: string | null): "success" | "warning" | "danger" | "neutral" {
  if (stage === "Won") return "success";
  if (stage === "Lost") return "danger";
  if (stage === "Negotiation" || stage === "Proposal") return "warning";
  return "neutral";
}

function RecordPage() {
  const member = useMember();
  const { id } = Route.useSearch();
  const navigate = useNavigate();
  const deals = useRows<Deal>("deals");
  const update = useUpdateRow<Deal>("deals");
  const del = useDeleteRow("deals");

  const [log, setLog] = useState<Activity[]>([]);
  const [valueDraft, setValueDraft] = useState<string | null>(null);

  if (member.isPending) {
    return (
      <div className="p-10">
        <Skeleton className="h-8 w-40" />
      </div>
    );
  }

  if (!member.data) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-10 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Halyard</h1>
        <p className="text-muted-foreground">Sign in to open this record.</p>
        <Button asChild>
          <Link to="/">Sign in</Link>
        </Button>
      </div>
    );
  }

  if (!id) {
    return (
      <div className="mx-auto max-w-lg p-10 text-center">
        <Empty title="No record chosen" description="Open a deal from the records table." />
        <Button asChild className="mt-4">
          <Link to="/records">Back to records</Link>
        </Button>
      </div>
    );
  }

  if (deals.isPending) {
    return (
      <div className="p-10">
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }

  if (deals.isError) {
    return (
      <div className="mx-auto max-w-lg p-10 text-center">
        <p className="text-sm text-destructive">Couldn't load this record. Refresh and try again.</p>
      </div>
    );
  }

  const deal = deals.data?.find((d) => String(d.id) === id);

  if (!deal) {
    return (
      <div className="mx-auto max-w-lg p-10 text-center">
        <Empty title="Not found" description="This deal doesn't exist, or belongs to a different team." />
        <Button asChild className="mt-4">
          <Link to="/records">Back to records</Link>
        </Button>
      </div>
    );
  }

  const onStageChange = (stage: string) => {
    update.mutate(
      { id: deal.id, stage },
      {
        onSuccess: () => {
          toast.success("Stage updated");
          setLog((prev) => [{ who: member.data!.name, what: `Moved to ${stage}`, at: new Date() }, ...prev]);
        },
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
          setLog((prev) => [{ who: member.data!.name, what: `Updated value to ${valueDraft}`, at: new Date() }, ...prev]);
          setValueDraft(null);
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  const onDelete = () => {
    del.mutate(deal.id, {
      onSuccess: () => {
        toast.success("Deal removed");
        navigate({ to: "/records" });
      },
      onError: (e) => toast.error(e.message),
    });
  };

  return (
    <div className="mx-auto max-w-3xl p-6">
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link to="/records">← Back to records</Link>
      </Button>

      <RecordHeader
        title={deal.title}
        subtitle="Shared with the team"
        status={<StatusBadge state={stageState(deal.stage)}>{deal.stage ?? "New"}</StatusBadge>}
        actions={
          <Button variant="destructive" onClick={onDelete} disabled={del.isPending}>
            {del.isPending ? "Removing…" : "Delete"}
          </Button>
        }
      />

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <div>
          <Label>Stage</Label>
          <Select value={deal.stage ?? "New"} onValueChange={onStageChange}>
            <SelectTrigger className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STAGES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Value</Label>
          <div className="mt-1.5 flex gap-2">
            <Input
              value={valueDraft ?? deal.value ?? ""}
              onChange={(e) => setValueDraft(e.target.value)}
            />
            <Button
              variant="outline"
              onClick={onValueSave}
              disabled={update.isPending || valueDraft === null}
            >
              Save
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-10">
        <h2 className="text-sm font-medium text-muted-foreground">Activity</h2>
        <div className="mt-3">
          <ActivityFeed items={log} empty="No activity yet on this record." />
        </div>
      </div>
    </div>
  );
}
