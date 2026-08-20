import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { useMember, useRows, useUpdateRow, useDeleteRow, type Row } from "@/lib/rows";
import { RecordHeader } from "@/components/ui/record-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { ActivityFeed } from "@/components/ui/activity-feed";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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
  const navigate = useNavigate();
  const deals = useRows<Deal>("deals");
  const update = useUpdateRow<Deal>("deals");
  const remove = useDeleteRow("deals");
  const [title, setTitle] = useState<string | null>(null);
  const [value, setValue] = useState<string | null>(null);

  if (member.isPending) return null;

  if (!member.data) {
    return (
      <main className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in to view this record</h1>
        <p className="mt-2 text-muted-foreground">Deal records are only visible to the signed-in team.</p>
        <Button className="mt-6" onClick={() => navigate({ to: "/" })}>
          Go to sign in
        </Button>
      </main>
    );
  }

  if (!id) {
    return (
      <main className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">No record chosen</h1>
        <p className="mt-2 text-muted-foreground">
          Open a deal from{" "}
          <Link to="/records" className="underline">
            the records list
          </Link>
          .
        </p>
      </main>
    );
  }

  if (deals.isPending) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <Skeleton className="h-48 rounded-xl" />
      </main>
    );
  }

  if (deals.isError) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-sm text-destructive">Couldn't load this record. Refresh and try again.</p>
      </main>
    );
  }

  const deal = deals.data?.find((d) => String(d.id) === id);

  if (!deal) {
    return (
      <main className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Record not found</h1>
        <p className="mt-2 text-muted-foreground">
          It may have been removed.{" "}
          <Link to="/records" className="underline">
            Back to records
          </Link>
        </p>
      </main>
    );
  }

  const saveTitle = () => {
    if (title === null || title === deal.title) return;
    update.mutate(
      { id: deal.id, title },
      {
        onSuccess: () => toast.success("Saved"),
        onError: (e) => toast.error(e.message),
      },
    );
  };

  const saveValue = () => {
    if (value === null || value === deal.value) return;
    update.mutate(
      { id: deal.id, value },
      {
        onSuccess: () => toast.success("Saved"),
        onError: (e) => toast.error(e.message),
      },
    );
  };

  const onStage = (stage: string) => {
    update.mutate(
      { id: deal.id, stage },
      {
        onSuccess: () => toast.success("Stage updated"),
        onError: (e) => toast.error(e.message),
      },
    );
  };

  const onDelete = () => {
    remove.mutate(deal.id, {
      onSuccess: () => {
        toast.success("Deal removed");
        navigate({ to: "/records" });
      },
      onError: (e) => toast.error(e.message),
    });
  };

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <RecordHeader
        title={deal.title}
        subtitle={`Record #${deal.id}`}
        status={<StatusBadge state={stageState(deal.stage)}>{deal.stage ?? "New"}</StatusBadge>}
        actions={
          <div className="flex items-center gap-2">
            <Select value={deal.stage ?? "New"} onValueChange={onStage}>
              <SelectTrigger className="w-40">
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
            <Button variant="destructive" onClick={onDelete} disabled={remove.isPending}>
              {remove.isPending ? "Removing…" : "Delete"}
            </Button>
          </div>
        }
      />

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            defaultValue={deal.title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="value">Value</Label>
          <Input
            id="value"
            defaultValue={deal.value ?? ""}
            onChange={(e) => setValue(e.target.value)}
            onBlur={saveValue}
          />
        </div>
      </div>

      <div className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight">Activity</h2>
        <ActivityFeed
          className="mt-4"
          items={[
            { who: "Record", what: `created as "${deal.title}"`, at: deal.created_at },
            { who: "Record", what: `last updated`, at: deal.updated_at ?? deal.created_at },
          ]}
        />
      </div>

      <div className="mt-8">
        <Link to="/records" className="text-sm underline underline-offset-4">
          Back to records
        </Link>
      </div>
    </main>
  );
}
