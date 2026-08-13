import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useMember, useRows, useUpdateRow, useDeleteRow, type Row } from "@/lib/rows";
import { SiteChrome } from "@/components/ui/site-chrome";
import { RecordHeader } from "@/components/ui/record-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { ActivityFeed, type Activity } from "@/components/ui/activity-feed";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

type Deal = Row & { title: string; value: string | null; stage: string | null; created_at: string; updated_at?: string };

const STAGES = ["New", "Qualifying", "Proposal", "Negotiation", "Won", "Lost"];

function stageState(stage: string | null): "success" | "warning" | "danger" | "neutral" {
  if (stage === "Won") return "success";
  if (stage === "Lost") return "danger";
  if (stage === "Negotiation" || stage === "Proposal") return "warning";
  return "neutral";
}

const CHROME = {
  name: "Halyard",
  tagline: "The team's deals and accounts, in one place.",
};

function RecordPage() {
  const { id } = Route.useSearch();
  const member = useMember();
  const navigate = useNavigate();
  const deals = useRows<Deal>("deals");
  const update = useUpdateRow<Deal>("deals");
  const remove = useDeleteRow("deals");

  const deal = deals.data?.find((d) => String(d.id) === id);

  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [stage, setStage] = useState("New");

  useEffect(() => {
    if (deal) {
      setTitle(deal.title);
      setValue(deal.value ?? "");
      setStage(deal.stage ?? "New");
    }
  }, [deal?.id]);

  if (member.isPending || deals.isPending) {
    return (
      <SiteChrome {...CHROME}>
        <div className="p-10"><Skeleton className="h-64 rounded-xl" /></div>
      </SiteChrome>
    );
  }

  if (!member.data) {
    return (
      <SiteChrome {...CHROME}>
        <div className="mx-auto max-w-md px-6 py-24 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Sign in to see this record</h1>
          <p className="mt-3 text-muted-foreground">Deals are only visible to signed-in team members.</p>
          <Button className="mt-6" onClick={() => navigate({ to: "/" })}>Go to sign in</Button>
        </div>
      </SiteChrome>
    );
  }

  if (deals.isError) {
    return (
      <SiteChrome {...CHROME}>
        <div className="mx-auto max-w-md px-6 py-24 text-center">
          <p className="text-sm text-destructive">Couldn't load this deal. Refresh and try again.</p>
        </div>
      </SiteChrome>
    );
  }

  if (!deal) {
    return (
      <SiteChrome {...CHROME}>
        <div className="mx-auto max-w-md px-6 py-24 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Deal not found</h1>
          <p className="mt-3 text-muted-foreground">It may have been removed.</p>
          <Button className="mt-6" asChild>
            <Link to="/records">Back to records</Link>
          </Button>
        </div>
      </SiteChrome>
    );
  }

  const activity: Activity[] = [
    { who: "Team", what: "created this deal", at: deal.created_at },
    ...(deal.updated_at && deal.updated_at !== deal.created_at
      ? [{ who: "Team", what: "updated this deal", at: deal.updated_at }]
      : []),
  ];

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

  return (
    <SiteChrome {...CHROME}>
      <div className="mx-auto max-w-3xl px-6 py-10">
        <RecordHeader
          title={deal.title}
          subtitle={deal.value ?? "No value set"}
          status={<StatusBadge state={stageState(deal.stage)}>{deal.stage ?? "New"}</StatusBadge>}
          actions={
            <div className="flex gap-2">
              <Button variant="outline" onClick={onSave} disabled={update.isPending}>
                {update.isPending ? "Saving…" : "Save"}
              </Button>
              <Button variant="destructive" onClick={onDelete} disabled={remove.isPending}>
                {remove.isPending ? "Removing…" : "Delete"}
              </Button>
            </div>
          }
        />

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <label className="text-sm text-muted-foreground">Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <label className="text-sm text-muted-foreground">Value</label>
            <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="£5,000" />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <label className="text-sm text-muted-foreground">Stage</label>
            <Select value={stage} onValueChange={setStage}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STAGES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-10">
          <h2 className="text-lg font-semibold tracking-tight">Activity</h2>
          <ActivityFeed className="mt-4" items={activity} empty="Nothing yet" />
        </div>

        <div className="mt-8">
          <Button variant="ghost" asChild>
            <Link to="/records">Back to records</Link>
          </Button>
        </div>
      </div>
    </SiteChrome>
  );
}
