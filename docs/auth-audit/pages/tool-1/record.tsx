import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { useMember, useRows, useUpdateRow, type Row } from "@/lib/rows";
import { RecordHeader } from "@/components/ui/record-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { ActivityFeed } from "@/components/ui/activity-feed";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { LoginForm } from "@/components/ui/login-form";
import { useLogin } from "@/lib/rows";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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

const STAGES = ["lead", "qualified", "proposal", "negotiation", "won", "lost"];

const editSchema = z.object({
  title: z.string().min(2, "Give it a name"),
  value: z.string().min(1, "Add a value"),
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
  const login = useLogin();
  const deals = useRows<Deal>("deals");
  const update = useUpdateRow<Deal>("deals");
  const [editing, setEditing] = useState(false);

  const deal = deals.data?.find((d) => String(d.id) === id);

  const form = useForm<EditForm>({
    resolver: zodResolver(editSchema),
    values: deal
      ? { title: deal.title, value: deal.value ?? "", stage: deal.stage ?? "lead" }
      : { title: "", value: "", stage: "lead" },
  });

  if (member.isPending) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <Skeleton className="h-40 rounded-xl" />
      </main>
    );
  }

  if (!member.data) {
    return (
      <main className="flex min-h-screen items-center justify-center p-10">
        <div className="w-full max-w-sm">
          <h1 className="mb-6 text-2xl font-semibold tracking-tight">Sign in to Halyard</h1>
          <LoginForm
            busy={login.isPending}
            error={login.error?.message ?? null}
            onSubmit={(v) => login.mutate(v, { onError: (e: Error) => toast.error(e.message) })}
          />
        </div>
      </main>
    );
  }

  if (!id) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-muted-foreground">
          No record chosen.{" "}
          <Link to="/records" className="underline">
            Back to records
          </Link>
          .
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link to="/records" className="text-sm text-muted-foreground underline">
        ← Back to records
      </Link>

      {deals.isPending && <Skeleton className="mt-6 h-64 rounded-xl" />}

      {deals.isError && (
        <p className="mt-6 text-sm text-destructive">Couldn't load this record. Refresh and try again.</p>
      )}

      {!deals.isPending && !deals.isError && !deal && (
        <p className="mt-6 text-muted-foreground">
          We couldn't find that deal. It may not be yours or your team's, or it's been removed.
        </p>
      )}

      {deal && (
        <div className="mt-6">
          <RecordHeader
            title={deal.title}
            subtitle="A deal the team is working"
            status={<StatusBadge state={stageState(deal.stage)}>{deal.stage ?? "lead"}</StatusBadge>}
            actions={
              !editing ? (
                <Button variant="outline" onClick={() => setEditing(true)}>
                  Edit
                </Button>
              ) : undefined
            }
          />

          {!editing && (
            <div className="mt-6 grid gap-4 rounded-lg border border-border bg-card p-6 sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Value</p>
                <p className="mt-1 text-sm">{deal.value ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Stage</p>
                <p className="mt-1 text-sm capitalize">{deal.stage ?? "lead"}</p>
              </div>
            </div>
          )}

          {editing && (
            <Form {...form}>
              <form
                className="mt-6 grid gap-4 rounded-lg border border-border bg-card p-6"
                onSubmit={form.handleSubmit((v) =>
                  update.mutate(
                    { id: deal.id, ...v },
                    {
                      onSuccess: () => {
                        toast.success("Deal updated");
                        setEditing(false);
                      },
                      onError: (e: Error) => toast.error(e.message),
                    },
                  ),
                )}
              >
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
                            <SelectItem key={s} value={s} className="capitalize">
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
                  <Button type="submit" disabled={update.isPending} className="motion-press">
                    {update.isPending ? "Saving…" : "Save changes"}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          )}

          <div className="mt-8">
            <h2 className="text-sm font-medium">Activity</h2>
            <div className="mt-3">
              <ActivityFeed
                items={[
                  {
                    who: "System",
                    what: `Record created${deal.value ? ` at ${deal.value}` : ""}`,
                    at: deal.created_at,
                  },
                  {
                    who: "System",
                    what: `Currently at stage "${deal.stage ?? "lead"}"`,
                    at: deal.updated_at ?? deal.created_at,
                  },
                ]}
                empty="No activity yet"
              />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
