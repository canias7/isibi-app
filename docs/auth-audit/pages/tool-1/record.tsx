import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useMember, useRows, useUpdateRow, useDeleteRow, type Row } from "@/lib/rows";
import { ActivityFeed, type Activity } from "@/components/ui/activity-feed";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { RecordHeader } from "@/components/ui/record-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SiteChrome } from "@/components/ui/site-chrome";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";

export const Route = createFileRoute("/record")({
  component: RecordPage,
  validateSearch: (search: Record<string, unknown>): { id?: string } => ({
    id: typeof search.id === "string" ? search.id : undefined,
  }),
});

type Deal = Row & { title: string; value: string | null; stage: string | null };

const STAGES = ["new", "qualified", "proposal", "negotiation", "won", "lost"];

function stageState(stage: string | null): "success" | "warning" | "danger" | "neutral" {
  if (stage === "won") return "success";
  if (stage === "lost") return "danger";
  if (stage === "negotiation" || stage === "proposal") return "warning";
  return "neutral";
}

const CHROME = {
  name: "Halyard",
  tagline: "The team's shared pipeline",
  links: [{ label: "Records", href: "#/records" }],
  action: { label: "New record", href: "#/records" },
};

function RecordPage() {
  const member = useMember();
  const navigate = useNavigate();
  const { id } = Route.useSearch();
  const deals = useRows<Deal>("deals");
  const update = useUpdateRow<Deal>("deals");
  const del = useDeleteRow("deals");

  const [titleDraft, setTitleDraft] = useState("");
  const [valueDraft, setValueDraft] = useState("");
  const [editingFields, setEditingFields] = useState(false);
  const [activity, setActivity] = useState<Activity[]>([]);

  useEffect(() => {
    if (!member.isPending && !member.data) {
      navigate({ to: "/" });
    }
  }, [member.isPending, member.data, navigate]);

  const deal = deals.data?.find((d) => String(d.id) === id);

  useEffect(() => {
    if (deal) {
      setTitleDraft(deal.title);
      setValueDraft(deal.value ?? "");
    }
  }, [deal?.id]);

  if (member.isPending) {
    return (
      <SiteChrome {...CHROME}>
        <div className="px-6 py-10">
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </SiteChrome>
    );
  }

  if (!member.data) {
    return null;
  }

  if (!id) {
    return (
      <SiteChrome {...CHROME}>
        <div className="px-6 py-14">
          <Empty
            title="No record chosen"
            description="Open a deal from the records table to see it here."
          />
          <Button asChild className="mt-4">
            <Link to="/records">Back to records</Link>
          </Button>
        </div>
      </SiteChrome>
    );
  }

  if (deals.isPending) {
    return (
      <SiteChrome {...CHROME}>
        <div className="px-6 py-10">
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </SiteChrome>
    );
  }

  if (deals.isError) {
    return (
      <SiteChrome {...CHROME}>
        <div className="px-6 py-10">
          <p className="text-sm text-destructive">Couldn't load this record. Refresh and try again.</p>
        </div>
      </SiteChrome>
    );
  }

  if (!deal) {
    return (
      <SiteChrome {...CHROME}>
        <div className="px-6 py-14">
          <Empty
            title="Not found"
            description="This deal isn't in the team's pipeline, or it's been removed."
          />
          <Button asChild className="mt-4">
            <Link to="/records">Back to records</Link>
          </Button>
        </div>
      </SiteChrome>
    );
  }

  const logActivity = (what: string) => {
    setActivity((prev) => [{ who: "You", what, at: new Date() }, ...prev]);
  };

  const onStageChange = (stage: string) => {
    update.mutate(
      { id: deal.id, stage },
      {
        onSuccess: () => {
          toast.success("Stage updated");
          logActivity(`moved the deal to ${stage}`);
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  const onSaveFields = () => {
    update.mutate(
      { id: deal.id, title: titleDraft, value: valueDraft },
      {
        onSuccess: () => {
          toast.success("Saved");
          logActivity("updated the deal details");
          setEditingFields(false);
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  const onDelete = () => {
    del.mutate(deal.id, {
      onSuccess: () => {
        toast.success("Deal deleted");
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
          subtitle="Shared with the team"
          status={<StatusBadge state={stageState(deal.stage)}>{deal.stage ?? "new"}</StatusBadge>}
          actions={
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditingFields((v) => !v)}>
                {editingFields ? "Cancel" : "Edit"}
              </Button>
              <Button variant="destructive" onClick={onDelete} disabled={del.isPending}>
                {del.isPending ? "Deleting…" : "Delete"}
              </Button>
            </div>
          }
        />

        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Title</p>
            {editingFields ? (
              <Input
                className="mt-1"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
              />
            ) : (
              <p className="mt-1">{deal.title}</p>
            )}
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Value</p>
            {editingFields ? (
              <Input
                className="mt-1"
                value={valueDraft}
                onChange={(e) => setValueDraft(e.target.value)}
              />
            ) : (
              <p className="mt-1">{deal.value ?? "—"}</p>
            )}
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Stage</p>
            <Select value={deal.stage ?? "new"} onValueChange={onStageChange}>
              <SelectTrigger className="mt-1 w-full">
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

        {editingFields && (
          <Button className="mt-4 motion-press" onClick={onSaveFields} disabled={update.isPending}>
            {update.isPending ? "Saving…" : "Save changes"}
          </Button>
        )}

        <div className="mt-10">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Activity
          </h2>
          <div className="mt-3">
            <ActivityFeed items={activity} empty="No activity yet on this deal." />
          </div>
        </div>
      </div>
    </SiteChrome>
  );
}
