import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useMember, useRows, useUpdateRow, type Row } from "@/lib/rows";
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
  const deals = useRows<Deal>("deals");
  const update = useUpdateRow<Deal>("deals");

  const record = deals.data?.find((d) => String(d.id) === id);

  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [stage, setStage] = useState("New");

  useEffect(() => {
    if (record) {
      setTitle(record.title);
      setValue(record.value ?? "");
      setStage(record.stage ?? "New");
    }
  }, [record]);

  if (!member.isPending && !member.data) {
    return (
      <main className="flex min-h-screen items-center justify-center p-10">
        <div className="max-w-sm text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Halyard</h1>
          <p className="mt-3 text-muted-foreground">Sign in to open this record.</p>
          <Button asChild className="mt-6">
            <Link to="/">Sign in</Link>
          </Button>
        </div>
      </main>
    );
  }

  if (!id) {
    return (
      <main className="p-10">
        <p className="text-muted-foreground">
          No record chosen.{" "}
          <Link to="/records" className="underline">
            Back to the list
          </Link>
          .
        </p>
      </main>
    );
  }

  if (member.isPending || deals.isPending) {
    return (
      <main className="p-10">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-6 h-48 w-full" />
      </main>
    );
  }

  if (deals.isError) {
    return (
      <main className="p-10">
        <p className="text-sm text-destructive">Couldn't load this record. Refresh and try again.</p>
      </main>
    );
  }

  if (!record) {
    return (
      <main className="p-10">
        <p className="text-muted-foreground">
          We couldn't find that deal. It may have been removed.{" "}
          <Link to="/records" className="underline">
            Back to the list
          </Link>
          .
        </p>
      </main>
    );
  }

  const save = () => {
    update.mutate(
      { id: record.id, title, value, stage },
      {
        onSuccess: () => toast.success("Saved"),
        onError: (e) => toast.error(e.message),
      },
    );
  };

  return (
    <main className="mx-auto max-w-3xl p-8">
      <Link to="/records" className="text-sm text-muted-foreground underline">
        Back to our deals
      </Link>

      <RecordHeader
        className="mt-4"
        title={record.title}
        subtitle={`Added ${new Date(record.created_at as string).toLocaleDateString()}`}
        status={<StatusBadge state={stageState(record.stage)}>{record.stage ?? "New"}</StatusBadge>}
        actions={<Button onClick={save} disabled={update.isPending}>{update.isPending ? "Saving…" : "Save changes"}</Button>}
      />

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="title">Title</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="value">Value</Label>
          <Input id="value" value={value} onChange={(e) => setValue(e.target.value)} />
        </div>
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="stage">Stage</Label>
          <Select value={stage} onValueChange={setStage}>
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
        <ActivityFeed
          className="mt-4"
          empty="No activity recorded yet."
          items={[
            { who: "Team", what: `added this deal at stage "${record.stage ?? "New"}"`, at: record.created_at as string },
          ]}
        />
      </div>
    </main>
  );
}
