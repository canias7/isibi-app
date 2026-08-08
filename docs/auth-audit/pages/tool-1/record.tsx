import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useMember, useRows, useUpdateRow, type Row } from "@/lib/rows";
import { RecordHeader } from "@/components/ui/record-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { ActivityFeed, type Activity } from "@/components/ui/activity-feed";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty } from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

const STAGES = ["new", "qualified", "proposal", "won", "lost"];

function RecordPage() {
  const { id } = Route.useSearch();
  const member = useMember();
  const deals = useRows<Deal>("deals");
  const updateDeal = useUpdateRow<Deal>("deals");

  const deal = deals.data?.find((d) => String(d.id) === id);

  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [stage, setStage] = useState("new");
  const [log, setLog] = useState<Activity[]>([]);

  useEffect(() => {
    if (deal) {
      setTitle(deal.title);
      setValue(deal.value ?? "");
      setStage(deal.stage ?? "new");
    }
  }, [deal?.id]);

  if (member.isPending || deals.isPending) {
    return (
      <div className="p-10">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-4 h-48 rounded-xl" />
      </div>
    );
  }

  if (!member.data) {
    return (
      <div className="flex min-h-screen items-center justify-center p-10">
        <Card className="max-w-sm text-center">
          <CardHeader>
            <CardTitle>Sign in to view this record</CardTitle>
          </CardHeader>
          <CardContent>
            <Button asChild className="mt-2">
              <Link to="/">Go to sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!id) {
    return (
      <div className="p-10">
        <Empty title="No record chosen" description="Open a deal from the records table." />
        <Button asChild className="mt-4">
          <Link to="/records">Back to records</Link>
        </Button>
      </div>
    );
  }

  if (deals.isError) {
    return (
      <div className="p-10">
        <p className="text-sm text-destructive">Couldn't load this record. Refresh and try again.</p>
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="p-10">
        <Empty title="We couldn't find that deal" description="It may have been removed, or you don't have access." />
        <Button asChild className="mt-4">
          <Link to="/records">Back to records</Link>
        </Button>
      </div>
    );
  }

  const save = () => {
    updateDeal.mutate(
      { id: deal.id, values: { title, value, stage } },
      {
        onSuccess: () => {
          toast.success("Saved");
          setLog((prev) => [
            { who: member.data!.name ?? member.data!.email, what: `updated the deal to stage "${stage}"`, at: new Date() },
            ...prev,
          ]);
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  return (
    <div className="mx-auto max-w-3xl p-8">
      <Button asChild variant="ghost" size="sm">
        <Link to="/records">← Back to records</Link>
      </Button>

      <RecordHeader
        className="mt-4"
        title={deal.title}
        subtitle="Shared deal — visible to the whole team"
        status={
          <StatusBadge
            state={
              deal.stage === "won"
                ? "success"
                : deal.stage === "lost"
                  ? "danger"
                  : deal.stage === "proposal"
                    ? "warning"
                    : "neutral"
            }
          >
            {deal.stage ?? "new"}
          </StatusBadge>
        }
        actions={
          <Button onClick={save} disabled={updateDeal.isPending} className="motion-press">
            {updateDeal.isPending ? "Saving…" : "Save changes"}
          </Button>
        }
      />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Fields</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="deal-title">Title</Label>
            <Input id="deal-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="deal-value">Value</Label>
            <Input id="deal-value" value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="deal-stage">Stage</Label>
            <Select value={stage} onValueChange={setStage}>
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
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityFeed items={log} empty="No activity yet in this session." />
        </CardContent>
      </Card>
    </div>
  );
}
