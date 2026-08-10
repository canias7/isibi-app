import { createFileRoute, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useState } from "react";

import { useMember, useRows, useUpdateRow, useDeleteRow, type Row } from "@/lib/rows";
import { Button } from "@/components/ui/button";
import { RecordHeader } from "@/components/ui/record-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { ActivityFeed } from "@/components/ui/activity-feed";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty } from "@/components/ui/empty";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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

type Deal = Row & { title: string; value: string | null; stage: string | null };

const STAGES = ["New", "Qualifying", "Proposal", "Negotiation", "Won", "Lost"];

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

const editSchema = z.object({
  title: z.string().min(2, "Give the deal a name"),
  value: z.string().optional(),
  stage: z.string().min(1, "Pick a stage"),
});

type EditForm = z.infer<typeof editSchema>;

function RecordPage() {
  const { id } = Route.useSearch();
  const member = useMember();
  const deals = useRows<Deal>("deals", { order: "id", dir: "desc" });
  const update = useUpdateRow<Deal>("deals");
  const remove = useDeleteRow("deals");
  const [editing, setEditing] = useState(false);

  const deal = deals.data?.find((r) => String(r.id) === id);

  const form = useForm<EditForm>({
    resolver: zodResolver(editSchema),
    values: deal
      ? { title: deal.title, value: deal.value ?? "", stage: deal.stage ?? "New" }
      : { title: "", value: "", stage: "New" },
  });

  if (member.isPending) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Checking your sign-in…</div>;
  }

  if (!member.data) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sign in to open this record</h1>
          <Button asChild className="mt-6">
            <Link to="/">Sign in</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!id) {
    return (
      <div className="mx-auto max-w-lg px-6 py-16">
        <Empty title="No record chosen" description="Open a deal from the records table." />
        <Button asChild className="mt-4">
          <Link to="/records">Back to records</Link>
        </Button>
      </div>
    );
  }

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

  if (!deal) {
    return (
      <div className="mx-auto max-w-lg px-6 py-16">
        <Empty title="Not found" description="This deal doesn't exist or isn't the team's." />
        <Button asChild className="mt-4">
          <Link to="/records">Back to records</Link>
        </Button>
      </div>
    );
  }

  const onSave = (values: EditForm) => {
    update.mutate(
      { id: deal.id, ...values },
      {
        onSuccess: () => {
          toast.success("Saved");
          setEditing(false);
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  const onDelete = () => {
    remove.mutate(deal.id, {
      onSuccess: () => toast.success("Deal removed"),
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
        subtitle="A deal the team is working"
        status={<StatusBadge state={stageState(deal.stage)}>{deal.stage ?? "New"}</StatusBadge>}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditing((e) => !e)}>
              {editing ? "Cancel" : "Edit"}
            </Button>
            <Button variant="destructive" onClick={onDelete} disabled={remove.isPending}>
              {remove.isPending ? "Removing…" : "Delete"}
            </Button>
          </div>
        }
      />

      {editing ? (
        <Form {...form}>
          <form className="mt-6 grid gap-4 rounded-xl border border-border p-4" onSubmit={form.handleSubmit(onSave)}>
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="value"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Value</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="stage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Stage</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a stage" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {STAGES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="motion-press" disabled={update.isPending}>
              {update.isPending ? "Saving…" : "Save changes"}
            </Button>
          </form>
        </Form>
      ) : (
        <dl className="mt-6 grid gap-4 rounded-xl border border-border p-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase text-muted-foreground">Value</dt>
            <dd className="mt-1">{deal.value ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-muted-foreground">Stage</dt>
            <dd className="mt-1">{deal.stage ?? "New"}</dd>
          </div>
        </dl>
      )}

      <div className="mt-8">
        <h2 className="text-lg font-semibold tracking-tight">Activity</h2>
        <ActivityFeed
          className="mt-3"
          items={[
            { who: "System", what: `Record created as "${deal.title}"`, at: deal.created_at },
          ]}
          empty="No activity recorded yet."
        />
      </div>
    </div>
  );
}
