import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { useMember, useRows, useUpdateRow, useDeleteRow, type Row } from "@/lib/rows";
import { Button } from "@/components/ui/button";
import { RecordHeader } from "@/components/ui/record-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { ActivityFeed, type Activity } from "@/components/ui/activity-feed";
import { Skeleton } from "@/components/ui/skeleton";
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

function stageState(stage: string | null): "success" | "warning" | "danger" | "neutral" {
  if (stage === "Won") return "success";
  if (stage === "Lost") return "danger";
  if (stage === "Negotiation" || stage === "Proposal") return "warning";
  return "neutral";
}

const fields = z.object({
  title: z.string().min(2, "Give the deal a title"),
  value: z.string().min(1, "Add a value"),
  stage: z.string().min(1, "Pick a stage"),
});
type Fields = z.infer<typeof fields>;

function RecordPage() {
  const member = useMember();
  const { id } = Route.useSearch();
  const deals = useRows<Deal>("deals");
  const update = useUpdateRow<Deal>("deals");
  const remove = useDeleteRow("deals");
  const [editing, setEditing] = useState(false);

  const deal = deals.data?.find((d) => String(d.id) === id);

  const form = useForm<Fields>({
    resolver: zodResolver(fields),
    values: deal
      ? { title: deal.title, value: deal.value ?? "", stage: deal.stage ?? "New" }
      : undefined,
  });

  if (member.isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Checking your sign-in…</p>
      </div>
    );
  }

  if (!member.data) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sign in to view this record</h1>
          <Button asChild className="mt-6">
            <Link to="/">Go to sign in</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!id) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">No record selected</h1>
          <p className="mt-2 text-muted-foreground">Open a deal from the records list.</p>
          <Button asChild className="mt-6">
            <Link to="/records">Back to records</Link>
          </Button>
        </div>
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
        <p className="text-sm text-destructive">Couldn't load this deal. Refresh and try again.</p>
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">We couldn't find that deal</h1>
          <p className="mt-2 text-muted-foreground">It may have been removed by a teammate.</p>
          <Button asChild className="mt-6">
            <Link to="/records">Back to records</Link>
          </Button>
        </div>
      </div>
    );
  }

  const onSubmit = (values: Fields) => {
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

  const activity: Activity[] = [
    { who: "Team", what: `Deal created as "${deal.title}"`, at: deal.created_at },
  ];
  if (deal.updated_at && deal.updated_at !== deal.created_at) {
    activity.push({ who: "Team", what: `Stage set to ${deal.stage ?? "—"}`, at: deal.updated_at });
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link to="/records" className="text-sm text-muted-foreground underline underline-offset-4">
        ← Back to records
      </Link>

      <div className="mt-4">
        <RecordHeader
          title={deal.title}
          subtitle="Shared with the team"
          status={<StatusBadge state={stageState(deal.stage)}>{deal.stage ?? "—"}</StatusBadge>}
          actions={
            <div className="flex gap-2">
              {!editing && <Button onClick={() => setEditing(true)}>Edit</Button>}
              <Button variant="destructive" onClick={onDelete} disabled={remove.isPending}>
                {remove.isPending ? "Removing…" : "Delete"}
              </Button>
            </div>
          }
        />
      </div>

      {editing ? (
        <Form {...form}>
          <form className="mt-8 grid gap-4" onSubmit={form.handleSubmit(onSubmit)}>
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
                        <SelectValue />
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
            <div className="flex gap-3">
              <Button type="submit" className="motion-press" disabled={update.isPending}>
                {update.isPending ? "Saving…" : "Save"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      ) : (
        <div className="mt-8 grid gap-4 rounded-lg border border-border p-6">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <span className="text-muted-foreground">Value</span>
            <span className="col-span-2">{deal.value ?? "—"}</span>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <span className="text-muted-foreground">Stage</span>
            <span className="col-span-2">{deal.stage ?? "—"}</span>
          </div>
        </div>
      )}

      <div className="mt-10">
        <h2 className="text-lg font-medium">Activity</h2>
        <ActivityFeed className="mt-4" items={activity} empty="Nothing recorded yet" />
      </div>
    </div>
  );
}
