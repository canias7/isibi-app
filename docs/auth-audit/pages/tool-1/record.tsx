import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useMember, useRows, useUpdateRow, useDeleteRow, type Row } from "@/lib/rows";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RecordHeader } from "@/components/ui/record-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { ActivityFeed } from "@/components/ui/activity-feed";
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
type Account = Row & { name: string; website: string | null; notes: string | null };

const STAGES = ["New", "Qualifying", "Proposal", "Negotiation", "Won", "Lost"];

function stageState(stage: string | null) {
  if (stage === "Won") return "success" as const;
  if (stage === "Lost") return "danger" as const;
  if (stage === "Negotiation" || stage === "Proposal") return "warning" as const;
  return "neutral" as const;
}

function RecordPage() {
  const { id } = Route.useSearch();
  const member = useMember();
  const deals = useRows<Deal>("deals");
  const accounts = useRows<Account>("accounts", { order: "id", dir: "desc" });
  const update = useUpdateRow<Deal>("deals");
  const remove = useDeleteRow("deals");
  const navigate = useNavigate();

  const deal = deals.data?.find((r) => String(r.id) === id);

  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [stage, setStage] = useState("New");

  useEffect(() => {
    if (deal) {
      setTitle(deal.title);
      setValue(deal.value ?? "");
      setStage(deal.stage ?? "New");
    }
  }, [deal]);

  if (member.isPending || deals.isPending) {
    return (
      <div className="p-10">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-4 h-40 w-full" />
      </div>
    );
  }

  if (!member.data) {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in to open this record</h1>
        <p className="mt-3 text-muted-foreground">Deals are private to your signed-in team.</p>
        <Button asChild className="mt-6">
          <Link to="/">Sign in</Link>
        </Button>
      </div>
    );
  }

  if (!id) {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">No record chosen</h1>
        <p className="mt-3 text-muted-foreground">Open a deal from the records table.</p>
        <Button asChild className="mt-6" variant="outline">
          <Link to="/records">Back to records</Link>
        </Button>
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

  if (!deal) {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">We couldn't find that deal</h1>
        <p className="mt-3 text-muted-foreground">
          It may have been removed, or it belongs to a different team.
        </p>
        <Button asChild className="mt-6" variant="outline">
          <Link to="/records">Back to records</Link>
        </Button>
      </div>
    );
  }

  const onSave = () => {
    update.mutate(
      { id: deal.id, title, value, stage },
      {
        onSuccess: () => toast.success("Saved"),
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

  const trail = [
    { who: "Team", what: `stage set to ${deal.stage ?? "New"}`, at: deal.updated_at ?? deal.created_at },
    { who: "Team", what: "record created", at: deal.created_at },
  ];

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <RecordHeader
        title={deal.title}
        subtitle="Shared with your team — anyone can edit"
        status={<StatusBadge state={stageState(deal.stage)}>{deal.stage ?? "New"}</StatusBadge>}
        actions={
          <Button variant="destructive" onClick={onDelete} disabled={remove.isPending}>
            {remove.isPending ? "Removing…" : "Delete"}
          </Button>
        }
      />

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <label className="text-sm font-medium">Title</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <label className="text-sm font-medium">Value</label>
          <Input value={value} onChange={(e) => setValue(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <label className="text-sm font-medium">Stage</label>
          <Select value={stage} onValueChange={setStage}>
            <SelectTrigger>
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
        <div className="flex items-end">
          <Button className="motion-press" onClick={onSave} disabled={update.isPending}>
            {update.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>

      <div className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight">Activity</h2>
        <ActivityFeed className="mt-4" items={trail} empty="Nothing recorded yet" />
      </div>

      <div className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight">Accounts</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The team's shared accounts, for reference while you work this deal.
        </p>
        {accounts.isPending && <Skeleton className="mt-4 h-24" />}
        {accounts.isError && (
          <p className="mt-4 text-sm text-destructive">Couldn't load accounts.</p>
        )}
        {accounts.data?.length === 0 && (
          <p className="mt-4 text-sm text-muted-foreground">No accounts yet.</p>
        )}
        <ul className="mt-4 space-y-2 motion-stagger">
          {accounts.data?.slice(0, 5).map((a) => (
            <li key={a.id} className="rounded-md border border-border p-3 text-sm">
              <p className="font-medium">{a.name}</p>
              {a.website && <p className="text-muted-foreground">{a.website}</p>}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-10">
        <Button asChild variant="outline">
          <Link to="/records">Back to records</Link>
        </Button>
      </div>
    </div>
  );
}
