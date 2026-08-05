import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  useMember,
  useRows,
  useUpdateRow,
  type Row,
} from "@/lib/rows";
import { RecordHeader } from "@/components/ui/record-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { ActivityFeed } from "@/components/ui/activity-feed";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/record")({
  component: RecordPage,
  validateSearch: (search: Record<string, unknown>): { table?: string; id?: string } => ({
    table: typeof search.table === "string" ? search.table : undefined,
    id: typeof search.id === "string" ? search.id : undefined,
  }),
});

type Deal = Row & { title: string; value: string | null; stage: string | null };
type Account = Row & { name: string; website: string | null; notes: string | null };

const STAGES = ["lead", "qualified", "proposal", "negotiation", "won", "lost"];

function stageState(stage: string | null): "success" | "warning" | "danger" | "neutral" {
  if (stage === "won") return "success";
  if (stage === "lost") return "danger";
  if (stage === "negotiation" || stage === "proposal") return "warning";
  return "neutral";
}

function RecordPage() {
  const { table, id } = Route.useSearch();
  const member = useMember();
  const navigate = useNavigate();

  const deals = useRows<Deal>("deals", table === "deals" ? { order: "id", dir: "desc" } : undefined);
  const accounts = useRows<Account>(
    "accounts",
    table === "accounts" ? { order: "id", dir: "desc" } : undefined,
  );

  const updateDeal = useUpdateRow<Deal>("deals");
  const updateAccount = useUpdateRow<Account>("accounts");

  const deal = useMemo(
    () => (table === "deals" ? deals.data?.find((d) => String(d.id) === id) : undefined),
    [deals.data, table, id],
  );
  const account = useMemo(
    () => (table === "accounts" ? accounts.data?.find((a) => String(a.id) === id) : undefined),
    [accounts.data, table, id],
  );

  const [titleDraft, setTitleDraft] = useState("");
  const [valueDraft, setValueDraft] = useState("");
  const [notesDraft, setNotesDraft] = useState("");
  const [websiteDraft, setWebsiteDraft] = useState("");
  const [dirtyDeal, setDirtyDeal] = useState(false);
  const [dirtyAccount, setDirtyAccount] = useState(false);

  if (member.isPending) {
    return (
      <div className="p-10">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-6 h-64 w-full" />
      </div>
    );
  }

  if (!member.data) {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in required</h1>
        <p className="mt-3 text-muted-foreground">Sign in to open this record.</p>
        <Button asChild className="mt-6">
          <Link to="/">Go to sign in</Link>
        </Button>
      </div>
    );
  }

  if (!table || !id || (table !== "deals" && table !== "accounts")) {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">No record chosen</h1>
        <p className="mt-3 text-muted-foreground">
          Open a record from the table instead of this link directly.
        </p>
        <Button asChild className="mt-6" variant="outline">
          <Link to="/records">Back to records</Link>
        </Button>
      </div>
    );
  }

  const loading = table === "deals" ? deals.isPending : accounts.isPending;
  const errored = table === "deals" ? deals.isError : accounts.isError;
  const notFound = table === "deals" ? !deal && !deals.isPending && !deals.isError : !account && !accounts.isPending && !accounts.isError;

  if (loading) {
    return (
      <div className="p-10">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-6 h-96 w-full" />
      </div>
    );
  }

  if (errored) {
    return (
      <div className="p-10">
        <p className="text-sm text-destructive">Couldn't load this record. Refresh and try again.</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Not found</h1>
        <p className="mt-3 text-muted-foreground">
          That record isn't there — it may have been removed.
        </p>
        <Button asChild className="mt-6" variant="outline">
          <Link to="/records">Back to records</Link>
        </Button>
      </div>
    );
  }

  if (table === "deals" && deal) {
    const title = dirtyDeal ? titleDraft : deal.title;
    const value = dirtyDeal ? valueDraft : deal.value ?? "";

    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Button variant="ghost" className="mb-4" onClick={() => navigate({ to: "/records" })}>
          Back to records
        </Button>
        <RecordHeader
          title={deal.title}
          subtitle="A deal the team is working"
          status={<StatusBadge state={stageState(deal.stage)}>{deal.stage ?? "lead"}</StatusBadge>}
        />

        <div className="mt-8 grid gap-6">
          <div className="grid gap-2">
            <label className="text-sm font-medium">Title</label>
            <Input
              value={title}
              onChange={(e) => {
                setDirtyDeal(true);
                setTitleDraft(e.target.value);
              }}
            />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Value</label>
            <Input
              value={value}
              onChange={(e) => {
                setDirtyDeal(true);
                setValueDraft(e.target.value);
              }}
            />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Stage</label>
            <Select
              value={deal.stage ?? "lead"}
              onValueChange={(v) =>
                updateDeal.mutate(
                  { id: deal.id, stage: v },
                  {
                    onSuccess: () => toast.success("Stage updated"),
                    onError: (e) => toast.error(e.message),
                  },
                )
              }
            >
              <SelectTrigger className="w-48">
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
          {dirtyDeal && (
            <Button
              className="w-fit motion-press"
              disabled={updateDeal.isPending}
              onClick={() =>
                updateDeal.mutate(
                  { id: deal.id, title: titleDraft || deal.title, value: valueDraft },
                  {
                    onSuccess: () => {
                      toast.success("Deal updated");
                      setDirtyDeal(false);
                    },
                    onError: (e) => toast.error(e.message),
                  },
                )
              }
            >
              {updateDeal.isPending ? "Saving…" : "Save changes"}
            </Button>
          )}
        </div>

        <div className="mt-10">
          <h2 className="text-sm font-medium text-muted-foreground">Activity</h2>
          <ActivityFeed
            className="mt-3"
            items={[
              { who: "Team", what: `Deal created at stage "${deal.stage ?? "lead"}"`, at: deal.created_at ?? new Date() },
            ]}
            empty="No activity recorded yet."
          />
        </div>
      </div>
    );
  }

  if (table === "accounts" && account) {
    const notes = dirtyAccount ? notesDraft : account.notes ?? "";
    const website = dirtyAccount ? websiteDraft : account.website ?? "";

    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Button variant="ghost" className="mb-4" onClick={() => navigate({ to: "/records" })}>
          Back to records
        </Button>
        <RecordHeader title={account.name} subtitle="Shared account" />

        <div className="mt-8 grid gap-6">
          <div className="grid gap-2">
            <label className="text-sm font-medium">Website</label>
            <Input
              value={website}
              onChange={(e) => {
                setDirtyAccount(true);
                setWebsiteDraft(e.target.value);
              }}
            />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Notes</label>
            <Textarea
              rows={5}
              value={notes}
              onChange={(e) => {
                setDirtyAccount(true);
                setNotesDraft(e.target.value);
              }}
            />
          </div>
          {dirtyAccount && (
            <Button
              className="w-fit motion-press"
              disabled={updateAccount.isPending}
              onClick={() =>
                updateAccount.mutate(
                  { id: account.id, website: websiteDraft, notes: notesDraft },
                  {
                    onSuccess: () => {
                      toast.success("Account updated");
                      setDirtyAccount(false);
                    },
                    onError: (e) => toast.error(e.message),
                  },
                )
              }
            >
              {updateAccount.isPending ? "Saving…" : "Save changes"}
            </Button>
          )}
        </div>

        <div className="mt-10">
          <h2 className="text-sm font-medium text-muted-foreground">Activity</h2>
          <ActivityFeed
            className="mt-3"
            items={[{ who: "Team", what: "Account added to the shared list", at: account.created_at ?? new Date() }]}
            empty="No activity recorded yet."
          />
        </div>
      </div>
    );
  }

  return null;
}
