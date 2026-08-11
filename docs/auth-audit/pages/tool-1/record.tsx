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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
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

const editSchema = z.object({
  title: z.string().min(2, "Give the deal a name"),
  value: z.string().optional(),
});
type EditForm = z.infer<typeof editSchema>;

function RecordPage() {
  const member = useMember();
  const { id } = Route.useSearch();
  const deals = useRows<Deal>("deals");
  const update = useUpdateRow<Deal>("deals");
  const remove = useDeleteRow("deals");
  const [editing, setEditing] = useState(false);

  const record = deals.data?.find((d) => String(d.id) === id);

  const form = useForm<EditForm>({
    resolver: zodResolver(editSchema),
    values: { title: record?.title ?? "", value: record?.value ?? "" },
  });

  if (member.isPending) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Checking your sign-in…</p>
      </main>
    );
  }

  if (!member.data) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 text-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sign in to open this record</h1>
          <Button asChild className="mt-6">
            <Link to="/">Go to sign in</Link>
          </Button>
        </div>
      </main>
    );
  }

  if (!id) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 text-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">No record chosen</h1>
          <p className="mt-2 text-muted-foreground">Open a deal from the records table.</p>
          <Button asChild className="mt-6">
            <Link to="/records">Back to records</Link>
          </Button>
        </div>
      </main>
    );
  }

  if (deals.isPending) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <Skeleton className="h-48 rounded-xl" />
      </main>
    );
  }

  if (deals.isError) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-sm text-destructive">Couldn't load this record. Refresh and try again.</p>
      </main>
    );
  }

  if (!record) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Not found</h1>
        <p className="mt-2 text-muted-foreground">
          This record doesn't exist, or isn't one the team can see.
        </p>
        <Button asChild className="mt-6">
          <Link to="/records">Back to records</Link>
        </Button>
      </main>
    );
  }

  const activity: Activity[] = [
    { who: "Team", what: `Record created as "${record.title}"`, at: record.created_at },
    { who: "Team", what: `Stage set to ${record.stage ?? "New"}`, at: record.updated_at ?? record.created_at },
  ];

  const onSave = (values: EditForm) => {
    update.mutate(
      { id: record.id, title: values.title, value: values.value },
      {
        onSuccess: () => {
          toast.success("Saved");
          setEditing(false);
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  const onStageChange = (stage: string) => {
    update.mutate({ id: record.id, stage }, {
      onSuccess: () => toast.success("Stage updated"),
      onError: (e) => toast.error(e.message),
    });
  };

  const onDelete = () => {
    remove.mutate(record.id, {
      onSuccess: () => toast.success("Deal deleted"),
      onError: (e) => toast.error(e.message),
    });
  };

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link to="/records" className="text-sm text-muted-foreground underline">
        ← Back to records
      </Link>

      <RecordHeader
        className="mt-4"
        title={record.title}
        subtitle={record.value ?? undefined}
        status={<StatusBadge state={stageState(record.stage)}>{record.stage ?? "New"}</StatusBadge>}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditing((v) => !v)}>
              {editing ? "Cancel" : "Edit"}
            </Button>
            <Button variant="destructive" onClick={onDelete} disabled={remove.isPending}>
              {remove.isPending ? "Deleting…" : "Delete"}
            </Button>
          </div>
        }
      />

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <div>
          <p className="text-sm font-medium">Stage</p>
          <Select value={record.stage ?? "New"} onValueChange={onStageChange}>
            <SelectTrigger className="mt-2">
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

      {editing && (
        <Form {...form}>
          <form className="mt-6 grid gap-4 sm:grid-cols-2" onSubmit={form.handleSubmit(onSave)}>
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
            <div className="sm:col-span-2">
              <Button type="submit" className="motion-press" disabled={update.isPending}>
                {update.isPending ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </form>
        </Form>
      )}

      <div className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight">Activity</h2>
        <ActivityFeed className="mt-4" items={activity} empty="No activity yet" />
      </div>
    </main>
  );
}
