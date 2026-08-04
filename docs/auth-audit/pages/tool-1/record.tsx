import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { useMember, useRows, useUpdateRow, useDeleteRow, type Row } from "@/lib/rows";
import { ActivityFeed } from "@/components/ui/activity-feed";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RecordHeader } from "@/components/ui/record-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";

export const Route = createFileRoute("/record")({
  component: RecordPage,
  validateSearch: (search: Record<string, unknown>): { id?: string } => ({
    id: typeof search.id === "string" ? search.id : undefined,
  }),
});

type Deal = Row & { title: string; value: string | null; stage: string | null };

const STAGES = ["lead", "qualified", "proposal", "negotiation", "won", "lost"];

function stageState(stage: string | null): "success" | "warning" | "neutral" | "error" {
  if (stage === "won") return "success";
  if (stage === "lost") return "error";
  if (stage === "negotiation" || stage === "proposal") return "warning";
  return "neutral";
}

const dealSchema = z.object({
  title: z.string().min(2, "Give the deal a name"),
  value: z.string().optional(),
  stage: z.string().min(1, "Pick a stage"),
});

type DealForm = z.infer<typeof dealSchema>;

function RecordPage() {
  const { id } = Route.useSearch();
  const member = useMember();
  const deals = useRows<Deal>("deals", { order: "id", dir: "desc" });
  const update = useUpdateRow<Deal>("deals");
  const del = useDeleteRow("deals");
  const [trail, setTrail] = useState<{ id: string; text: string; at: string }[]>([]);

  const record = deals.data?.find((d) => d.id === id) ?? null;

  const form = useForm<DealForm>({
    resolver: zodResolver(dealSchema),
    defaultValues: { title: "", value: "", stage: "lead" },
  });

  useEffect(() => {
    if (record) {
      form.reset({ title: record.title, value: record.value ?? "", stage: record.stage ?? "lead" });
    }
  }, [record?.id]);

  const onSubmit = (values: DealForm) => {
    if (!id) return;
    update.mutate(
      { id, ...values },
      {
        onSuccess: () => {
          toast.success("Saved");
          setTrail((t) => [
            { id: crypto.randomUUID(), text: "Deal updated", at: new Date().toLocaleString() },
            ...t,
          ]);
        },
        onError: (e: Error) => toast.error(e.message),
      },
    );
  };

  const onDelete = () => {
    if (!id) return;
    del.mutate(id, {
      onSuccess: () => toast.success("Deal removed"),
      onError: (e: Error) => toast.error(e.message),
    });
  };

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-56 flex-col gap-1 border-r border-border bg-muted/30 p-4 md:flex">
        <p className="px-2 text-lg font-semibold tracking-tight">Halyard</p>
        <nav className="mt-6 flex flex-col gap-1 text-sm">
          <Link to="/records" className="rounded-md px-2 py-1.5 text-muted-foreground hover:bg-accent">
            Deals
          </Link>
        </nav>
      </aside>

      <main className="flex-1 p-6 md:p-8">
        {member.isPending && <Skeleton className="h-64 rounded-xl" />}

        {!member.isPending && !member.data && (
          <Card className="mx-auto mt-16 max-w-md motion-enter">
            <CardHeader>
              <CardTitle>Sign in to view this record</CardTitle>
            </CardHeader>
            <CardContent>
              <Button asChild className="mt-2">
                <Link to="/">Go to sign in</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {!member.isPending && member.data && !id && (
          <p className="text-sm text-muted-foreground">
            No record selected. Open one from{" "}
            <Link to="/records" className="underline">
              the records list
            </Link>
            .
          </p>
        )}

        {!member.isPending && member.data && id && deals.isPending && (
          <Skeleton className="h-64 rounded-xl" />
        )}

        {!member.isPending && member.data && id && deals.isError && (
          <p className="text-sm text-destructive">Couldn't load this record. Refresh and try again.</p>
        )}

        {!member.isPending && member.data && id && !deals.isPending && !deals.isError && !record && (
          <p className="text-sm text-muted-foreground">
            We couldn't find that deal. It may have been removed, or it isn't the team's.
          </p>
        )}

        {record && (
          <div className="max-w-2xl">
            <RecordHeader
              title={record.title}
              subtitle="Shared with the team"
              actions={
                <Button variant="destructive" onClick={onDelete} disabled={del.isPending}>
                  {del.isPending ? "Removing…" : "Remove"}
                </Button>
              }
            />

            <div className="mt-4">
              <StatusBadge state={stageState(record.stage)}>{record.stage ?? "lead"}</StatusBadge>
            </div>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-base">Fields</CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
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
                                <SelectValue placeholder="Pick a stage" />
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
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-base">Activity</CardTitle>
              </CardHeader>
              <CardContent>
                {trail.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No activity yet this session — edits you make below will show up here.
                  </p>
                ) : (
                  <ActivityFeed
                    items={trail.map((t) => ({ id: t.id, description: t.text, timestamp: t.at }))}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
