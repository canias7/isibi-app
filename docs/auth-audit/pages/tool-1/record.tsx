import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { useMember, useRows, useUpdateRow, useDeleteRow, type Row } from "@/lib/rows";
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
  const deals = useRows<Deal>("deals");
  const update = useUpdateRow<Deal>("deals");
  const remove = useDeleteRow("deals");
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");

  if (member.isPending) {
    return (
      <div className="p-10">
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!member.data) {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in required</h1>
        <p className="mt-3 text-muted-foreground">Sign in to see this record.</p>
        <Button asChild className="mt-6">
          <Link to="/">Go to sign in</Link>
        </Button>
      </div>
    );
  }

  if (!id) {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">No record chosen</h1>
        <p className="mt-3 text-muted-foreground">Open a deal from the records list.</p>
        <Button asChild className="mt-6">
          <Link to="/records">Back to records</Link>
        </Button>
      </div>
    );
  }

  if (deals.isPending) {
    return (
      <div className="p-10">
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (deals.isError) {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <p className="text-sm text-destructive">Couldn't load this record. Refresh and try again.</p>
      </div>
    );
  }

  const deal = deals.data?.find((r) => String(r.id) === id);

  if (!deal) {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Not found</h1>
        <p className="mt-3 text-muted-foreground">
          That record doesn't exist, or isn't one your team can see.
        </p>
        <Button asChild className="mt-6">
          <Link to="/records">Back to records</Link>
        </Button>
      </div>
    );
  }

  const startEdit = () => {
    setTitle(deal.title);
    setValue(deal.value ?? "");
    setEditing(true);
  };

  const saveEdit = () => {
    update.mutate(
      { id: deal.id, title, value },
      {
        onSuccess: () => {
          toast.success("Saved");
          setEditing(false);
        },
        onError: (e: Error) => toast.error(e.message),
      },
    );
  };

  const setStage = (stage: string) => {
    update.mutate(
      { id: deal.id, stage },
      {
        onSuccess: () => toast.success("Stage updated"),
        onError: (e: Error) => toast.error(e.message),
      },
    );
  };

  const onDelete = () => {
    remove.mutate(deal.id, {
      onSuccess: () => toast.success("Deleted"),
      onError: (e: Error) => toast.error(e.message),
    });
  };

  const trail = [
    {
      who: "Record",
      what: "created",
      at: deal.created_at,
    },
    ...(deal.updated_at && deal.updated_at !== deal.created_at
      ? [{ who: "Record", what: "last updated", at: deal.updated_at }]
      : []),
  ];

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <RecordHeader
        title={deal.title}
        subtitle={deal.value ? `Worth ${deal.value}` : undefined}
        status={<StatusBadge state={stageState(deal.stage)}>{deal.stage ?? "New"}</StatusBadge>}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={editing ? saveEdit : startEdit} disabled={update.isPending}>
              {editing ? (update.isPending ? "Saving…" : "Save") : "Edit"}
            </Button>
            <Button variant="destructive" onClick={onDelete} disabled={remove.isPending}>
              {remove.isPending ? "Deleting…" : "Delete"}
            </Button>
          </div>
        }
      />

      <div className="mt-8 grid gap-6">
        <div className="rounded-xl border border-border p-5">
          <h2 className="text-sm font-medium text-muted-foreground">Fields</h2>
          {editing ? (
            <div className="mt-4 grid gap-3">
              <label className="grid gap-1 text-sm">
                <span className="text-muted-foreground">Title</span>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-muted-foreground">Value</span>
                <Input value={value} onChange={(e) => setValue(e.target.value)} />
              </label>
            </div>
          ) : (
            <dl className="mt-4 grid gap-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Title</dt>
                <dd>{deal.title}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Value</dt>
                <dd>{deal.value ?? "—"}</dd>
              </div>
            </dl>
          )}

          <div className="mt-5">
            <span className="text-sm text-muted-foreground">Stage</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {STAGES.map((s) => (
                <button
                  key={s}
                  onClick={() => setStage(s)}
                  className={`motion-press rounded-md px-3 py-1 text-xs ${
                    deal.stage === s
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border p-5">
          <h2 className="text-sm font-medium text-muted-foreground">Activity</h2>
          <ActivityFeed className="mt-4" items={trail} empty="No activity yet" />
        </div>
      </div>

      <Button asChild variant="ghost" className="mt-6">
        <Link to="/records">Back to records</Link>
      </Button>
    </div>
  );
}
