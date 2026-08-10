import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { useMember, useRows, useUpdateRow, useDeleteRow, type Row } from "@/lib/rows";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RecordHeader } from "@/components/ui/record-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { ActivityFeed } from "@/components/ui/activity-feed";
import { SideNav } from "@/components/ui/side-nav";
import { Skeleton } from "@/components/ui/skeleton";
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
  const remove = useDeleteRow("deals");
  const [titleDraft, setTitleDraft] = useState<string | null>(null);

  if (!member.isPending && !member.data) {
    return (
      <main className="flex min-h-screen items-center justify-center p-10">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Sign in required</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Sign in to view this record.</p>
            <Button asChild className="mt-4">
              <Link to="/">Go to sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const deal = deals.data?.find((r) => String(r.id) === id);

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-56 shrink-0 border-r border-border p-6 md:block">
        <p className="mb-6 text-lg font-semibold tracking-tight">Halyard</p>
        <SideNav
          sections={[
            {
              items: [
                { label: "Deals", href: "/records" },
                { label: "Accounts", href: "/accounts" },
                { label: "Playbook", href: "/playbook" },
              ],
            },
          ]}
          active="/records"
        />
      </aside>

      <main className="flex-1 p-8">
        {!id && (
          <p className="text-sm text-muted-foreground">
            No record chosen. <Link to="/records" className="underline">Back to deals</Link>.
          </p>
        )}

        {id && deals.isPending && <Skeleton className="h-64 rounded-xl" />}

        {id && deals.isError && (
          <p className="text-sm text-destructive">Couldn't load this deal. Refresh and try again.</p>
        )}

        {id && !deals.isPending && !deals.isError && !deal && (
          <p className="text-sm text-muted-foreground">
            We couldn't find that deal. <Link to="/records" className="underline">Back to deals</Link>.
          </p>
        )}

        {deal && (
          <>
            <RecordHeader
              title={deal.title}
              subtitle={`Deal #${deal.id}`}
              status={<StatusBadge state={stageState(deal.stage)}>{deal.stage ?? "New"}</StatusBadge>}
              actions={
                <Button
                  variant="destructive"
                  disabled={remove.isPending}
                  onClick={() =>
                    remove.mutate(deal.id, {
                      onSuccess: () => toast.success("Deal removed"),
                      onError: (e: Error) => toast.error(e.message),
                    })
                  }
                >
                  {remove.isPending ? "Removing…" : "Delete"}
                </Button>
              }
            />

            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="deal-title">Title</Label>
                <Input
                  id="deal-title"
                  value={titleDraft ?? deal.title}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onBlur={() => {
                    if (titleDraft !== null && titleDraft !== deal.title) {
                      update.mutate(
                        { id: deal.id, title: titleDraft },
                        {
                          onSuccess: () => toast.success("Saved"),
                          onError: (e: Error) => toast.error(e.message),
                        },
                      );
                    }
                  }}
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="deal-value">Value</Label>
                <Input
                  id="deal-value"
                  defaultValue={deal.value ?? ""}
                  onBlur={(e) => {
                    if (e.target.value !== deal.value) {
                      update.mutate(
                        { id: deal.id, value: e.target.value },
                        {
                          onSuccess: () => toast.success("Saved"),
                          onError: (e2: Error) => toast.error(e2.message),
                        },
                      );
                    }
                  }}
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="deal-stage">Stage</Label>
                <Select
                  value={deal.stage ?? "New"}
                  onValueChange={(v) =>
                    update.mutate(
                      { id: deal.id, stage: v },
                      {
                        onSuccess: () => toast.success("Stage updated"),
                        onError: (e: Error) => toast.error(e.message),
                      },
                    )
                  }
                >
                  <SelectTrigger id="deal-stage">
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
                items={[
                  { who: "You", what: `Opened this record`, at: new Date() },
                ]}
                empty="No activity recorded yet."
              />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
