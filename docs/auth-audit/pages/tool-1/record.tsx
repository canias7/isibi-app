import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { useMember, useRows, useUpdateRow, type Row } from "@/lib/rows";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Empty } from "@/components/ui/empty";
import { RecordHeader } from "@/components/ui/record-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { ActivityFeed } from "@/components/ui/activity-feed";

export const Route = createFileRoute("/record")({
  component: RecordPage,
  validateSearch: (search: Record<string, unknown>): { id?: string } => ({
    id: typeof search.id === "string" ? search.id : undefined,
  }),
});

type Deal = Row & { title: string; value: string | null; stage: string | null };

const STAGES = ["lead", "qualified", "proposal", "won", "lost"];

function stageState(stage: string | null): "success" | "warning" | "danger" | "neutral" {
  if (stage === "won") return "success";
  if (stage === "lost") return "danger";
  if (stage === "proposal" || stage === "qualified") return "warning";
  return "neutral";
}

const editSchema = z.object({
  title: z.string().min(2, "Give the deal a name"),
  value: z.string().optional(),
  stage: z.string().min(1, "Pick a stage"),
});
type EditForm = z.infer<typeof editSchema>;

function RecordPage() {
  const member = useMember();
  const { id } = Route.useSearch();
  const deals = useRows<Deal>("deals", { order: "id", dir: "desc" });
  const update = useUpdateRow<Deal>("deals");
  const [editing, setEditing] = useState(false);

  if (member.isPending || deals.isPending) {
    return (
      <div className="p-10">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-6 h-48 w-full" />
      </div>
    );
  }

  if (!member.data) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-10 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Halyard</h1>
        <p className="text-muted-foreground">Sign in to see the team's deals.</p>
        <Button asChild>
          <Link to="/">Sign in</Link>
        </Button>
      </main>
    );
  }

  if (deals.isError) {
    return (
      <div className="p-10">
        <p className="text-sm text-destructive">Couldn't load this record. Refresh and try again.</p>
      </div>
    );
  }

  const deal = deals.data?.find((d) => d.id === id);

  if (!id || !deal) {
    return (
      <div className="p-10">
        <Empty title="Record not found" description="It may have been removed from the pipeline." />
        <Button asChild className="mt-4">
          <Link to="/records">Back to deals</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-6 md:p-10">
      <RecordHeader
        title={deal.title}
        subtitle={deal.value ? `Value ${deal.value}` : undefined}
        status={<StatusBadge state={stageState(deal.stage)}>{deal.stage ?? "lead"}</StatusBadge>}
        actions={
          <Button variant="outline" onClick={() => setEditing((e) => !e)}>
            {editing ? "Cancel" : "Edit"}
          </Button>
        }
      />

      {editing ? (
        <EditDeal deal={deal} update={update} onDone={() => setEditing(false)} />
      ) : (
        <div className="mt-8 grid gap-4 rounded-lg border border-border p-6">
          <Field label="Title" value={deal.title} />
          <Field label="Value" value={deal.value ?? "—"} />
          <Field label="Stage" value={deal.stage ?? "lead"} />
        </div>
      )}

      <div className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight">Activity</h2>
        <ActivityFeed
          className="mt-4"
          items={[
            { who: "Halyard", what: `Record created`, at: deal.created_at },
          ]}
          empty="Nothing logged yet"
        />
      </div>

      <Button asChild variant="ghost" className="mt-8">
        <Link to="/records">Back to deals</Link>
      </Button>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm">{value}</p>
    </div>
  );
}

function EditDeal({
  deal,
  update,
  onDone,
}: {
  deal: Deal;
  update: ReturnType<typeof useUpdateRow<Deal>>;
  onDone: () => void;
}) {
  const form = useForm<EditForm>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      title: deal.title,
      value: deal.value ?? "",
      stage: deal.stage ?? "lead",
    },
  });

  const onSubmit = (values: EditForm) => {
    update.mutate(
      { id: deal.id, ...values },
      {
        onSuccess: () => {
          toast.success("Deal updated");
          onDone();
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="mt-8 grid gap-4 rounded-lg border border-border p-6">
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
              <FormControl>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
                  {...field}
                >
                  {STAGES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="motion-press" disabled={update.isPending}>
          {update.isPending ? "Saving…" : "Save changes"}
        </Button>
      </form>
    </Form>
  );
}
