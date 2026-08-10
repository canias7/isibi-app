import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { useMember, useRows, useUpdateRow, type Row } from "@/lib/rows";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { RecordHeader } from "@/components/ui/record-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { ActivityFeed, type Activity } from "@/components/ui/activity-feed";
import { Skeleton } from "@/components/ui/skeleton";
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

const STAGES = ["New", "Qualifying", "Proposal", "Negotiating", "Won", "Lost"];

function stageState(stage: string | null): "success" | "warning" | "danger" | "neutral" {
  if (stage === "Won") return "success";
  if (stage === "Lost") return "danger";
  if (stage === "Negotiating" || stage === "Proposal") return "warning";
  return "neutral";
}

function RecordPage() {
  const member = useMember();
  const navigate = useNavigate();
  const { id } = Route.useSearch();
  const deals = useRows<Deal>("deals", { order: "id", dir: "desc" });
  const update = useUpdateRow<Deal>("deals");

  const [title, setTitle] = useState<string | null>(null);
  const [value, setValue] = useState<string | null>(null);

  if (member.isPending || deals.isPending) {
    return (
      <div className="p-10">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="mt-6 h-64 w-full" />
      </div>
    );
  }

  if (!member.data) {
    return (
      <main className="flex min-h-screen items-center justify-center p-10">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Sign in to open this record</CardTitle>
            <CardDescription>Deals are only visible to signed-in team members.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => navigate({ to: "/" })}>
              Go to sign in
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (deals.isError) {
    return (
      <div className="p-10">
        <p className="text-sm text-destructive">Couldn't load this deal. Refresh and try again.</p>
      </div>
    );
  }

  const deal = deals.data?.find((d) => String(d.id) === id);

  if (!id || !deal) {
    return (
      <div className="p-10">
        <p className="text-muted-foreground">
          We couldn't find that deal. It may not exist, or it's not one of ours.{" "}
          <Link to="/records" className="underline">
            Back to records
          </Link>
        </p>
      </div>
    );
  }

  const activity: Activity[] = [
    { who: "Deal", what: `Created as "${deal.title}" at ${deal.value ?? "an unset value"}`, at: deal.created_at },
  ];
  if (deal.updated_at && deal.updated_at !== deal.created_at) {
    activity.push({ who: "Deal", what: `Last updated — now at stage "${deal.stage ?? "New"}"`, at: deal.updated_at });
  }

  const saveField = (field: "title" | "value", next: string) => {
    update.mutate(
      { id: deal.id, [field]: next },
      {
        onSuccess: () => toast.success("Saved"),
        onError: (e) => toast.error(e.message),
      },
    );
  };

  const saveStage = (stage: string) => {
    update.mutate(
      { id: deal.id, stage },
      {
        onSuccess: () => toast.success("Stage updated"),
        onError: (e) => toast.error(e.message),
      },
    );
  };

  return (
    <div className="mx-auto max-w-3xl p-8">
      <Link to="/records" className="text-sm text-muted-foreground underline">
        Back to records
      </Link>

      <div className="mt-4">
        <RecordHeader
          title={deal.title}
          subtitle="Shared with the team"
          status={<StatusBadge state={stageState(deal.stage)}>{deal.stage ?? "New"}</StatusBadge>}
        />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Fields</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              defaultValue={deal.title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => title !== null && title !== deal.title && saveField("title", title)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="value">Value</Label>
            <Input
              id="value"
              defaultValue={deal.value ?? ""}
              onChange={(e) => setValue(e.target.value)}
              onBlur={() => value !== null && value !== deal.value && saveField("value", value)}
            />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="stage">Stage</Label>
            <Select value={deal.stage ?? "New"} onValueChange={saveStage}>
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
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Activity</CardTitle>
          <CardDescription>What we know from this record's own history.</CardDescription>
        </CardHeader>
        <CardContent>
          <ActivityFeed items={activity} empty="No activity yet" />
        </CardContent>
      </Card>
    </div>
  );
}
