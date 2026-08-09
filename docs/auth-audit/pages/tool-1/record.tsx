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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

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

const editForm = z.object({
  title: z.string().min(2, "Give the deal a name"),
  value: z.string().optional(),
  stage: z.string().min(1, "Pick a stage"),
});

type EditForm = z.infer<typeof editForm>;

function RecordPage() {
  const { id } = Route.useSearch();
  const member = useMember();
  const navigate = useNavigate();
  const deals = useRows<Deal>("deals", { order: "id", dir: "desc" });
  const update = useUpdateRow<Deal>("deals");
  const remove = useDeleteRow("deals");
  const [activity, setActivity] = useState<Activity[]>([]);

  const deal = deals.data?.find((d) => String(d.id) === id);

  const form = useForm<EditForm>({
    resolver: zodResolver(editForm),
    values: deal
      ? { title: deal.title, value: deal.value ?? "", stage: deal.stage ?? "New" }
      : { title: "", value: "", stage: "New" },
  });

  if (member.isPending) {
    return <main className="flex min-h-screen items-center justify-center text-muted-foreground">Checking your sign-in…</main>;
  }

  if (!member.data) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Halyard</h1>
        <p className="text-muted-foreground">Sign in to view this record.</p>
        <Button asChild>
          <Link to="/">Sign in</Link>
        </Button>
      </main>
    );
  }

  if (!id) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16 text-center">
        <p className="text-muted-foreground">
          No record selected. Go back to{" "}
          <Link to="/records" className="underline">
            the records
          </Link>
          .
        </p>
      </main>
    );
  }

  if (deals.isPending) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <Skeleton className="h-40 rounded-xl" />
      </main>
    );
  }

  if (deals.isError) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16 text-center">
        <p className="text-sm text-destructive">Couldn't load this record. Refresh and try again.</p>
      </main>
    );
  }

  if (!deal) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16 text-center">
        <p className="text-muted-foreground">
          We couldn't find that record. It may not be yours, or the team's.{" "}
          <Link to="/records" className="underline">
            Back to records
          </Link>
        </p>
      </main>
    );
  }

  const onSubmit = (values: EditForm) => {
    update.mutate(
      { id: deal.id, ...values },
      {
        onSuccess: () => {
          toast.success("Saved");
          setActivity((prev) => [
            { who: member.data!.name ?? member.data!.email, what: "updated this deal", at: new Date() },
            ...prev,
          ]);
        },
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
    <main className="mx-auto max-w-3xl px-6 py-10">
      <RecordHeader
        title={deal.title}
        subtitle="A deal the whole team shares"
        status={<StatusBadge state={stageState(deal.stage)}>{deal.stage ?? "New"}</StatusBadge>}
        actions={
          <Button variant="destructive" onClick={onDelete} disabled={remove.isPending}>
            {remove.isPending ? "Deleting…" : "Delete"}
          </Button>
        }
      />

      <section className="mt-8 rounded-xl border border-border p-6">
        <h2 className="text-sm font-medium text-muted-foreground">Fields</h2>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-4 grid gap-4 sm:grid-cols-2">
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
            <div className="sm:col-span-2">
              <Button type="submit" className="motion-press" disabled={update.isPending}>
                {update.isPending ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </form>
        </Form>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-medium text-muted-foreground">Activity</h2>
        <ActivityFeed
          className="mt-4"
          items={activity}
          empty="No activity yet on this record — edits made here will show up."
        />
      </section>
    </main>
  );
}
