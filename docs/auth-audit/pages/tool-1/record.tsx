import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useState } from "react";

import { useMember, useRows, useRpcAction, type Row } from "@/lib/rows";
import { RecordHeader } from "@/components/ui/record-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { ActivityFeed } from "@/components/ui/activity-feed";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty } from "@/components/ui/empty";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/record")({
  component: RecordPage,
  validateSearch: (search: Record<string, unknown>): { id?: string } => ({
    id: typeof search.id === "string" ? search.id : undefined,
  }),
});

type Deal = Row & { title: string; value: string | null; stage: string | null };

function stageState(stage: string | null): "success" | "warning" | "danger" | "neutral" | "quiet" {
  switch (stage) {
    case "Won":
      return "success";
    case "Lost":
      return "danger";
    case "Negotiation":
    case "Proposal":
      return "warning";
    default:
      return "neutral";
  }
}

function RecordPage() {
  const member = useMember();

  if (member.isPending) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Checking your sign-in…</div>;
  }

  if (!member.data) {
    return <Navigate to="/" />;
  }

  return <RecordDetail />;
}

function RecordDetail() {
  const { id } = Route.useSearch();
  const deals = useRows<Deal>("deals", { order: "id", dir: "desc" });

  const deal = deals.data?.find((d) => String(d.id) === id);

  if (deals.isPending) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16">
        <Skeleton className="h-40 rounded-xl" />
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

  if (!id || !deal) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16">
        <Empty title="We can't find that deal" description="It may have been removed by a teammate." />
        <Button asChild variant="outline" className="mt-6">
          <Link to="/records">Back to the records</Link>
        </Button>
      </div>
    );
  }

  const activity = [
    { who: "System", what: `Deal "${deal.title}" created`, at: deal.created_at ?? new Date().toISOString() },
    { who: "Team", what: `Currently in ${deal.stage ?? "New"}`, at: deal.updated_at ?? deal.created_at ?? new Date().toISOString() },
  ];

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Button asChild variant="ghost" size="sm">
        <Link to="/records">← Back to records</Link>
      </Button>

      <RecordHeader
        className="mt-4"
        title={deal.title}
        subtitle={deal.value ? `Worth ${deal.value}` : undefined}
        status={<StatusBadge state={stageState(deal.stage)}>{deal.stage ?? "New"}</StatusBadge>}
      />

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <div className="rounded-lg border border-border p-4">
          <p className="text-xs uppercase text-muted-foreground">Title</p>
          <p className="mt-1 text-sm">{deal.title}</p>
        </div>
        <div className="rounded-lg border border-border p-4">
          <p className="text-xs uppercase text-muted-foreground">Value</p>
          <p className="mt-1 text-sm">{deal.value ?? "—"}</p>
        </div>
        <div className="rounded-lg border border-border p-4 sm:col-span-2">
          <p className="text-xs uppercase text-muted-foreground">Stage</p>
          <p className="mt-1 text-sm">{deal.stage ?? "New"}</p>
        </div>
      </div>

      <div className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight">Activity</h2>
        <ActivityFeed className="mt-4" items={activity} empty="Nothing logged on this deal yet" />
      </div>
    </div>
  );
}
