import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { useMember, useRows, useUpdateRow, type Row } from "@/lib/rows";
import { Button } from "@/components/ui/button";
import { RecordHeader } from "@/components/ui/record-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { ActivityFeed, type Activity } from "@/components/ui/activity-feed";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty } from "@/components/ui/empty";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

  const [titleDraft, setTitleDraft] = useState<string | null>(null);
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
      <div className="flex min-h-screen items-center justify-center p-10">
        <div className="max-w-sm text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Halyard</h1>
          <p className="mt-3 text-muted-foreground">Sign in to open this record.</p>
          <Button asChild className="mt-6">
            <Link to="/">Sign in</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!id) {
    return (
      <div className="mx-auto max-w-lg px-6 py-16 text-center">
        <Empty
          title="No record chosen"
          description="Open a deal from the records list to see it here."
        />
        <Button asChild className="mt-6">
          <Link to="/records">Back to records</Link>
        </Button>
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
      <div className="mx-auto max-w-lg px-6 py-16">
        <p className="text-sm text-destructive">
          Couldn't load this record. Refresh and try again.
        </p>
      </div>
    );
  }

  const deal = deals.data?.find((d) => String(d.id) === id);

  if (!deal) {
    return (
      <div className="mx-auto max-w-lg px-6 py-16 text-center">
        <Empty
          title="Not found"
          description="This deal doesn't exist, or isn't one your team can see."
        />
        <Button asChild className="mt-6">
          <Link to="/records">Back to records</Link>
        </Button>
      </div>
    );
  }

  const activity: Activity[] = [
    {
      who: member.data.name || member.data.email,
      what: "opened this record",
      at: deal.created_at ?? new Date(),
    },
  ];

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

      <div className="mt-4">
        <RecordHeader
          title={deal.title}
          subtitle="Shared with the team"
          status={<StatusBadge state={stageState(deal.stage)}>{deal.stage ?? "New"}</StatusBadge>}
        />
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="deal-title">Title</Label>
          <Input
            id="deal-title"
            value={titleDraft ?? deal.title}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={() => {
              if (titleDraft !== null && titleDraft !== deal.title) {
                saveField({ title: titleDraft });
              }
              setTitleDraft(null);
            }}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="deal-value">Value</Label>
          <Input
            id="deal-value"
            value={valueDraft ?? (deal.value ?? "")}
            onChange={(e) => setValueDraft(e.target.value)}
            onBlur={() => {
              if (valueDraft !== null && valueDraft !== deal.value) {
                saveField({ value: valueDraft });
              }
              setValueDraft(null);
            }}
          />
        </div>
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="deal-stage">Stage</Label>
          <Select
            value={deal.stage ?? "New"}
            onValueChange={(v) => saveField({ stage: v })}
          >
            <SelectTrigger id="deal-stage">
              <SelectValue placeholder="Choose a stage" />
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
        <h2 className="text-sm font-medium text-muted-foreground">Activity</h2>
        <ActivityFeed className="mt-3" items={activity} empty="Nothing logged on this record yet." />
      </div>
    </div>
  );
}
