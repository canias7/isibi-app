import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { useMember, useRows, useUpdateRow, useDeleteRow, type Row } from "@/lib/rows";
import { Button } from "@/components/ui/button";
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
import { RecordHeader } from "@/components/ui/record-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { ActivityFeed } from "@/components/ui/activity-feed";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/record")({
  component: RecordPage,
  validateSearch: (search: Record<string, unknown>): { id?: string } => ({
    id: typeof search.id === "string" ? search.id : undefined,
  }),
});

type Deal = Row & { title: string; value: string | null; stage: string | null };

const STAGES = ["new", "qualifying", "proposal", "negotiation", "won", "lost"];

const editSchema = z.object({
  title: z.string().min(2, "Give the deal a name"),
  value: z.string().min(1, "Add an estimated value"),
  stage: z.string().min(1, "Pick a stage"),
});
type EditForm = z.infer<typeof editSchema>;

function stageState(stage: string | null): "success" | "warning" | "danger" | "neutral" {
  if (stage === "won") return "success";
  if (stage === "lost") return "danger";
  if (stage === "negotiation" || stage === "proposal") return "warning";
  return "neutral";
}

function RecordPage() {
  const { id } = Route.useSearch();
  const member = useMember();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);

  const deals = useRows<Deal>("deals");
  const update = useUpdateRow<Deal>("deals");
  const remove = useDeleteRow("deals");

  const deal = deals.data?.find((d) => d.id === id) ?? null;

  const form = useForm<EditForm>({
    resolver: zodResolver(editSchema),
    values: deal
      ? { title: deal.title, value: deal.value ?? "", stage: deal.stage ?? "new" }
      : { title: "", value: "", stage: "new" },
  });

  if (member.isPending) {
    return (
      <div className="p-10">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  if (!member.data) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-10 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in to open this record</h1>
        <p className="text-muted-foreground">The pipeline is private to your team.</p>
        <Button asChild>
          <Link to="/">Go to sign in</Link>
        </Button>
      </div>
    );
  }

  if (!id) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-10 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">No record selected</h1>
        <p className="text-muted-foreground">Open a deal from the table to see it here.</p>
        <Button asChild>
          <Link to="/records">Back to deals</Link>
        </Button>
      </div>
    );
  }

  if (deals.isPending) {
    return (
      <div className="mx-auto max-w-3xl p-10">
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  if (deals.isError) {
    return (
      <div className="mx-auto max-w-3xl p-10">
        <p className="text-sm text-destructive">Couldn't load this record. Refresh and try again.</p>
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-10 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Not found</h1>
        <p className="text-muted-foreground">
          This record isn't there any more — it may have been removed.
        </p>
        <Button asChild>
          <Link to="/records">Back to deals</Link>
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
        onError: (e: Error) => toast.error(e.message),
      },
    );
  };

  const onDelete = () => {
    remove.mutate(
      { id: deal.id },
      {
        onSuccess: () => {
          toast.success("Deal removed");
          navigate({ to: "/records" });
        },
        onError: (e: Error) => toast.error(e.message),
      },
    );
  };

  const activity = [
    {
      id: `${deal.id}-created`,
      title: "Record created",
      at: deal.created_at,
    },
    ...(deal.updated_at && deal.updated_at !== deal.created_at
      ? [{ id: `${deal.id}-updated`, title: "Last updated", at: deal.updated_at }]
      : []),
  ];

  return (
    <div className="mx-auto max-w-3xl p-6 md:p-10">
      <RecordHeader
        title={deal.title}
        subtitle={`Value: ${deal.value ?? "—"}`}
        status={<StatusBadge state={stageState(deal.stage)}>{deal.stage ?? "new"}</StatusBadge>}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditing((v) => !v)}>
              {editing ? "Cancel" : "Edit"}
            </Button>
            <Button variant="destructive" onClick={onDelete} disabled={remove.isPending}>
              {remove.isPending ? "Removing…" : "Remove"}
            </Button>
          </div>
        }
      />

      {editing ? (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSave)} className="mt-8 grid gap-4 rounded-xl border border-border bg-card p-6">
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
                  <FormLabel>Estimated value</FormLabel>
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
                        <SelectValue placeholder="Choose one" />
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
        <div className="mt-8 grid gap-3 rounded-xl border border-border bg-card p-6">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Title</span>
            <span className="font-medium">{deal.title}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Value</span>
            <span className="font-medium">{deal.value ?? "—"}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Stage</span>
            <StatusBadge state={stageState(deal.stage)}>{deal.stage ?? "new"}</StatusBadge>
          </div>
        </div>
      )}

      <div className="mt-10">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Activity
        </h2>
        <ActivityFeed className="mt-4" items={activity} empty="No activity recorded yet" />
      </div>

      <div className="mt-8">
        <Button variant="ghost" asChild>
          <Link to="/records">Back to all deals</Link>
        </Button>
      </div>
    </div>
  );
}
