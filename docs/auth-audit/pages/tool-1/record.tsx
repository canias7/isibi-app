import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  useMember,
  useRows,
  useUpdateRow,
  useDeleteRow,
  type Row,
} from "@/lib/rows";
import { useLogin } from "@/lib/rows";
import { LoginForm } from "@/components/ui/login-form";
import { RecordHeader } from "@/components/ui/record-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { ActivityFeed } from "@/components/ui/activity-feed";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/record")({
  component: RecordPage,
  validateSearch: (search: Record<string, unknown>): { id?: string } => ({
    id: typeof search.id === "string" ? search.id : undefined,
  }),
});

type Deal = Row & { title: string; value: string | null; stage: string | null };
type Playbook = Row & { title: string; body: string | null };

const STAGES = ["New", "Qualifying", "Proposal", "Negotiation", "Won", "Lost"];

function stageState(stage: string | null): "success" | "warning" | "danger" | "neutral" {
  if (stage === "Won") return "success";
  if (stage === "Lost") return "danger";
  if (stage === "Negotiation" || stage === "Proposal") return "warning";
  return "neutral";
}

function RecordPage() {
  const member = useMember();
  const login = useLogin();

  if (member.isPending) {
    return (
      <div className="p-10">
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!member.data) {
    return (
      <main className="flex min-h-screen items-center justify-center p-10">
        <div className="w-full max-w-sm">
          <h1 className="mb-6 text-center text-2xl font-semibold tracking-tight">Halyard</h1>
          <LoginForm
            busy={login.isPending}
            error={login.error?.message}
            onSubmit={(v) => login.mutate(v, { onError: (e) => toast.error(e.message) })}
          />
        </div>
      </main>
    );
  }

  return <RecordView />;
}

function RecordView() {
  const { id } = Route.useSearch();
  const navigate = useNavigate();
  const deals = useRows<Deal>("deals");
  const playbook = useRows<Playbook>("playbook", { order: "id", dir: "asc" });
  const update = useUpdateRow<Deal>("deals");
  const remove = useDeleteRow("deals");

  const deal = deals.data?.find((d) => String(d.id) === id);

  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [dirty, setDirty] = useState(false);

  if (!id) {
    return (
      <div className="mx-auto max-w-lg px-6 py-16 text-center">
        <p className="text-muted-foreground">
          No record selected. <Link to="/records" className="underline">Back to records</Link>
        </p>
      </div>
    );
  }

  if (deals.isPending) {
    return (
      <div className="p-10">
        <Skeleton className="h-72 rounded-xl" />
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
        <Empty
          title="Not found"
          description="This deal doesn't exist, or has been removed."
        />
        <Button variant="outline" className="mt-4" onClick={() => navigate({ to: "/records" })}>
          Back to records
        </Button>
      </div>
    );
  }

  const startEdit = () => {
    setTitle(deal.title);
    setValue(deal.value ?? "");
    setDirty(true);
  };

  const saveEdit = () => {
    update.mutate(
      { id: deal.id, title, value },
      {
        onSuccess: () => {
          toast.success("Saved");
          setDirty(false);
        },
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
        toast.success("Deleted");
        navigate({ to: "/records" });
      },
      onError: (e) => toast.error(e.message),
    });
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link to="/records" className="text-sm text-muted-foreground underline">
        Back to records
      </Link>

      <RecordHeader
        className="mt-4"
        title={deal.title}
        subtitle={deal.value ? `Worth ${deal.value}` : "No value set"}
        status={<StatusBadge state={stageState(deal.stage)}>{deal.stage ?? "New"}</StatusBadge>}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={startEdit}>
              Edit
            </Button>
            <Button variant="destructive" size="sm" onClick={onDelete} disabled={remove.isPending}>
              {remove.isPending ? "Deleting…" : "Delete"}
            </Button>
          </div>
        }
      />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Fields</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {dirty ? (
            <>
              <div className="grid gap-1.5">
                <Label htmlFor="deal-title">Title</Label>
                <Input id="deal-title" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="deal-value">Value</Label>
                <Input id="deal-value" value={value} onChange={(e) => setValue(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button onClick={saveEdit} disabled={update.isPending} className="motion-press">
                  {update.isPending ? "Saving…" : "Save"}
                </Button>
                <Button variant="ghost" onClick={() => setDirty(false)}>
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="grid gap-1.5">
                <Label>Title</Label>
                <p className="text-sm">{deal.title}</p>
              </div>
              <div className="grid gap-1.5">
                <Label>Value</Label>
                <p className="text-sm">{deal.value ?? "—"}</p>
              </div>
            </>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="deal-stage">Stage</Label>
            <Select value={deal.stage ?? "New"} onValueChange={onStage}>
              <SelectTrigger id="deal-stage" className="w-56">
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
          <ActivityFeed
            items={[
              { who: "This deal", what: "was created", at: deal.created_at },
              { who: "This deal", what: "was last updated", at: deal.updated_at },
            ]}
            empty="No activity yet"
          />
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Team playbook</CardTitle>
        </CardHeader>
        <CardContent>
          {playbook.isPending && <Skeleton className="h-24 rounded-md" />}
          {playbook.isError && (
            <p className="text-sm text-destructive">Couldn't load the playbook.</p>
          )}
          {playbook.data?.length === 0 && (
            <p className="text-sm text-muted-foreground">Nothing published yet.</p>
          )}
          <div className="space-y-4 motion-stagger">
            {playbook.data?.map((p) => (
              <div key={p.id}>
                <p className="text-sm font-medium">{p.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{p.body}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
