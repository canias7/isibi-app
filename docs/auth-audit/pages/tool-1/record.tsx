import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { useMember, useRows, useUpdateRow, useDeleteRow, type Row } from "@/lib/rows";
import { Button } from "@/components/ui/button";
import { RecordHeader } from "@/components/ui/record-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { ActivityFeed } from "@/components/ui/activity-feed";
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

const editSchema = z.object({
  title: z.string().min(2, "Give the deal a name"),
  value: z.string().optional(),
  stage: z.string().min(1, "Pick a stage"),
});
type EditForm = z.infer<typeof editSchema>;

function RecordPage() {
  const member = useMember();
  const { id } = Route.useSearch();
  const navigate = useNavigate();
  const deals = useRows<Deal>("deals");
  const update = useUpdateRow<Deal>("deals");
  const remove = useDeleteRow("deals");
  const [editing, setEditing] = useState(false);

  if (member.isPending || deals.isPending) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="mt-6 h-48 w-full" />
      </div>
    );
  }

  if (!member.data) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Halyard</h1>
        <p className="mt-3 text-muted-foreground">Sign in to open this record.</p>
        <Button asChild className="mt-6">
          <Link to="/">Sign in</Link>
        </Button>
      </div>
    );
  }

  if (!id) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <p className="text-muted-foreground">
          No record chosen.{" "}
          <Link to="/records" className="underline">
            Back to the records
          </Link>
          .
        </p>
      </div>
    );
  }

  const deal = deals.data?.find((r) => String(r.id) === id);

  if (deals.isError) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <p className="text-sm text-destructive">Couldn't load this record. Refresh and try again.</p>
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <p className="text-muted-foreground">
          This record isn't there.{" "}
          <Link to="/records" className="underline">
            Back to the records
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Button variant="ghost" asChild className="mb-4">
        <Link to="/records">← Back to records</Link>
      </Button>

      <RecordHeader
        title={deal.title}
        subtitle={deal.value ?? undefined}
        status={<StatusBadge state={stageState(deal.stage)}>{deal.stage ?? "New"}</StatusBadge>}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditing((v) => !v)}>
              {editing ? "Cancel" : "Edit"}
            </Button>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() =>
                remove.mutate(deal.id, {
                  onSuccess: () => {
                    toast.success("Deal removed");
                    navigate({ to: "/records" });
                  },
                  onError: (e) => toast.error(e.message),
                })
              }
            >
              Delete
            </Button>
          </div>
        }
      />

      {editing ? (
        <EditForm
          deal={deal}
          onDone={() => setEditing(false)}
          update={update}
        />
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-border p-4">
            <p className="text-xs text-muted-foreground">Value</p>
            <p className="mt-1 text-lg font-medium">{deal.value ?? "—"}</p>
          </div>
          <div className="rounded-lg border border-border p-4">
            <p className="text-xs text-muted-foreground">Stage</p>
            <p className="mt-1 text-lg font-medium">{deal.stage ?? "New"}</p>
          </div>
        </div>
      )}

      <div className="mt-10">
        <h2 className="text-sm font-medium text-muted-foreground">Activity</h2>
        <div className="mt-3">
          <ActivityFeed
            items={[
              { who: member.data.name, what: "opened this record", at: new Date() },
            ]}
            empty="No activity recorded yet."
          />
        </div>
      </div>
    </div>
  );
}

function EditForm({
  deal,
  onDone,
  update,
}: {
  deal: Deal;
  onDone: () => void;
  update: ReturnType<typeof useUpdateRow<Deal>>;
}) {
  const form = useForm<EditForm>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      title: deal.title,
      value: deal.value ?? "",
      stage: deal.stage ?? "New",
    },
  });

  const onSubmit = (values: EditForm) => {
    update.mutate(
      { id: deal.id, ...values },
      {
        onSuccess: () => {
          toast.success("Saved");
          onDone();
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  return (
    <Form {...form}>
      <form className="mt-8 grid gap-4 sm:grid-cols-2" onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem className="sm:col-span-2">
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
        <div className="sm:col-span-2">
          <Button type="submit" className="motion-press" disabled={update.isPending}>
            {update.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
