import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { RecordHeader } from "@/components/ui/record-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { ActivityFeed, type Activity } from "@/components/ui/activity-feed";

export const Route = createFileRoute("/record")({
  component: RecordPage,
  validateSearch: (search: Record<string, unknown>): { id?: string } => ({
    id: typeof search.id === "string" ? search.id : undefined,
  }),
});

type Deal = Row & { title: string; value: string | null; stage: string | null };

const STAGES = ["new", "qualifying", "proposal", "negotiation", "won", "lost"];

function stageState(stage: string | null): "success" | "warning" | "danger" | "neutral" {
  if (stage === "won") return "success";
  if (stage === "lost") return "danger";
  if (stage === "negotiation" || stage === "proposal") return "warning";
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

  if (member.isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Checking your sign-in…</p>
      </div>
    );
  }

  if (!member.data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-10 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in to view this record</h1>
        <p className="max-w-sm text-muted-foreground">
          Deals are only visible to signed-in team members.
        </p>
        <Button asChild>
          <Link to="/">Go to sign in</Link>
        </Button>
      </div>
    );
  }

  return <RecordDetail />;
}

function RecordDetail() {
  const { id } = Route.useSearch();
  const deals = useRows<Deal>("deals", { limit: 100 });
  const update = useUpdateRow<Deal>("deals");
  const [editing, setEditing] = useState(false);
  const [activity, setActivity] = useState<Activity[]>([]);

  const deal = deals.data?.find((d) => d.id === id);

  const form = useForm<EditForm>({
    resolver: zodResolver(editSchema),
    defaultValues: { title: "", value: "", stage: "new" },
  });

  useEffect(() => {
    if (deal) {
      form.reset({ title: deal.title, value: deal.value ?? "", stage: deal.stage ?? "new" });
    }
  }, [deal]);

  if (!id) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-10 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">No record chosen</h1>
        <p className="max-w-sm text-muted-foreground">Open a deal from the pipeline table.</p>
        <Button asChild>
          <Link to="/records">Back to records</Link>
        </Button>
      </div>
    );
  }

  if (deals.isPending) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }

  if (deals.isError) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <p className="text-sm text-destructive">Couldn't load this record. Refresh and try again.</p>
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-10 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">We couldn't find that record</h1>
        <p className="max-w-sm text-muted-foreground">
          It may have been removed, or it belongs to a different team.
        </p>
        <Button asChild>
          <Link to="/records">Back to records</Link>
        </Button>
      </div>
    );
  }

  const onSubmit = (values: EditForm) => {
    update.mutate(
      { id: deal.id, ...values },
      {
        onSuccess: () => {
          toast.success("Record updated.");
          setActivity((prev) => [
            { who: "You", what: `updated the deal — now ${values.stage}`, at: new Date() },
            ...prev,
          ]);
          setEditing(false);
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  return (
    <div className="mx-auto max-w-3xl p-8">
      <Link to="/records" className="text-sm text-muted-foreground underline underline-offset-4">
        Back to records
      </Link>

      <div className="mt-4">
        <RecordHeader
          title={deal.title}
          subtitle={deal.value ? `Value: ${deal.value}` : "No value recorded yet"}
          status={<StatusBadge state={stageState(deal.stage)}>{deal.stage ?? "new"}</StatusBadge>}
          actions={
            <Button variant="outline" onClick={() => setEditing((v) => !v)}>
              {editing ? "Cancel" : "Edit"}
            </Button>
          }
        />
      </div>

      {editing && (
        <Form {...form}>
          <form className="mt-6 grid gap-4 rounded-lg border border-border p-6" onSubmit={form.handleSubmit(onSubmit)}>
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
      )}

      <section className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight">Activity</h2>
        <div className="mt-4">
          <ActivityFeed items={activity} empty="No changes logged yet in this session." />
        </div>
      </section>
    </div>
  );
}
