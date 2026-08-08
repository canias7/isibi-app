import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { useMember, useRows, useUpdateRow, useDeleteRow, type Row } from "@/lib/rows";
import { RecordHeader } from "@/components/ui/record-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { ActivityFeed, type Activity } from "@/components/ui/activity-feed";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty } from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  const { id } = Route.useSearch();
  const member = useMember();
  const deals = useRows<Deal>("deals");
  const update = useUpdateRow<Deal>("deals");
  const del = useDeleteRow("deals");
  const [title, setTitle] = useState<string | null>(null);
  const [value, setValue] = useState<string | null>(null);

  if (member.isPending) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Checking your sign-in…</div>;
  }

  if (!member.data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-10 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Halyard</h1>
        <p className="max-w-sm text-muted-foreground">Sign in to open this record.</p>
        <Button asChild>
          <Link to="/">Sign in</Link>
        </Button>
      </div>
    );
  }

  if (!id) {
    return (
      <div className="mx-auto max-w-lg px-6 py-16 text-center">
        <Empty title="No record chosen" description="Open a deal from the records table." />
        <Button asChild className="mt-4">
          <Link to="/records">Back to records</Link>
        </Button>
      </div>
    );
  }

  if (deals.isPending) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Skeleton className="h-10 w-2/3 rounded-md" />
        <Skeleton className="mt-6 h-48 rounded-xl" />
      </div>
    );
  }

  if (deals.isError) {
    return (
      <div className="mx-auto max-w-lg px-6 py-16">
        <p className="text-sm text-destructive">Couldn't load this deal. Refresh and try again.</p>
      </div>
    );
  }

  const deal = deals.data?.find((d) => String(d.id) === id);

  if (!deal) {
    return (
      <div className="mx-auto max-w-lg px-6 py-16 text-center">
        <Empty title="Not found" description="This deal isn't there — it may have been removed." />
        <Button asChild className="mt-4">
          <Link to="/records">Back to records</Link>
        </Button>
      </div>
    );
  }

  const activity: Activity[] = [
    { who: "The team", what: `created "${deal.title}"`, at: deal.created_at },
  ];
  if (deal.updated_at && deal.updated_at !== deal.created_at) {
    activity.push({ who: "The team", what: "updated this deal", at: deal.updated_at });
  }

  const saveField = (patch: Partial<Deal>) => {
    update.mutate(
      { id: deal.id, ...patch },
      {
        onSuccess: () => toast.success("Saved"),
        onError: (e) => toast.error(e.message),
      },
    );
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link to="/records" className="text-sm text-muted-foreground underline underline-offset-4">
        Back to records
      </Link>

      <RecordHeader
        className="mt-4"
        title={deal.title}
        subtitle="Shared with the team"
        status={<StatusBadge state={stageState(deal.stage)}>{deal.stage ?? "New"}</StatusBadge>}
        actions={
          <Button
            variant="destructive"
            disabled={del.isPending}
            onClick={() =>
              del.mutate(deal.id, {
                onSuccess: () => toast.success("Deal deleted"),
                onError: (e) => toast.error(e.message),
              })
            }
          >
            {del.isPending ? "Deleting…" : "Delete"}
          </Button>
        }
      />

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={title ?? deal.title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              if (title !== null && title !== deal.title) saveField({ title });
            }}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="value">Value</Label>
          <Input
            id="value"
            value={value ?? deal.value ?? ""}
            onChange={(e) => setValue(e.target.value)}
            onBlur={() => {
              if (value !== null && value !== deal.value) saveField({ value });
            }}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="stage">Stage</Label>
          <Select value={deal.stage ?? "New"} onValueChange={(v) => saveField({ stage: v })}>
            <SelectTrigger id="stage">
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
      </div>

      <div className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight">Activity</h2>
        <ActivityFeed className="mt-4" items={activity} empty="No activity yet" />
      </div>
    </div>
  );
}
