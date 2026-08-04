import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { useMember, useRows, useUpdateRow, type Row } from "@/lib/rows";
import { ActivityFeed } from "@/components/ui/activity-feed";
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
import { RecordHeader } from "@/components/ui/record-header";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/record")({
  component: RecordPage,
  validateSearch: (search: Record<string, unknown>): { id?: string; table?: string } => ({
    id: typeof search.id === "string" ? search.id : undefined,
    table: typeof search.table === "string" ? search.table : undefined,
  }),
});

type Deal = Row & { title: string; value: string | null; stage: string | null };
type Account = Row & { name: string; website: string | null; notes: string | null };

const STAGES = ["new", "qualifying", "proposal", "negotiation", "won", "lost"];

function stageState(stage: string | null): "success" | "warning" | "neutral" | "danger" {
  if (stage === "won") return "success";
  if (stage === "lost") return "danger";
  if (stage === "negotiation" || stage === "proposal") return "warning";
  return "neutral";
}

const dealSchema = z.object({
  title: z.string().min(2, "Give the deal a name"),
  value: z.string().optional(),
  stage: z.string().min(1, "Pick a stage"),
});
type DealForm = z.infer<typeof dealSchema>;

const accountSchema = z.object({
  name: z.string().min(2, "Give the account a name"),
  website: z.string().optional(),
  notes: z.string().optional(),
});
type AccountForm = z.infer<typeof accountSchema>;

function RecordPage() {
  const { id, table } = Route.useSearch();
  const member = useMember();

  if (member.isPending) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Checking your sign-in…</p>
      </main>
    );
  }

  if (!member.data) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-10 text-center">
        <p className="text-lg font-semibold tracking-tight">Halyard</p>
        <h1 className="text-2xl font-semibold tracking-tight">Sign in to open this record</h1>
        <Button asChild>
          <Link to="/">Go to sign in</Link>
        </Button>
      </main>
    );
  }

  if (!id || (table !== "deals" && table !== "accounts")) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-10 text-center">
        <p className="text-lg font-semibold tracking-tight">Halyard</p>
        <h1 className="text-2xl font-semibold tracking-tight">No record chosen</h1>
        <p className="max-w-sm text-muted-foreground">
          Open a record from the table instead of coming here directly.
        </p>
        <Button asChild>
          <Link to="/records">Back to records</Link>
        </Button>
      </main>
    );
  }

  return table === "deals" ? <DealRecord id={id} /> : <AccountRecord id={id} />;
}

function DealRecord({ id }: { id: string }) {
  const deals = useRows<Deal>("deals");
  const update = useUpdateRow<Deal>("deals");
  const [editing, setEditing] = useState(false);

  const form = useForm<DealForm>({
    resolver: zodResolver(dealSchema),
    defaultValues: { title: "", value: "", stage: "new" },
  });

  const deal = deals.data?.find((d) => d.id === id);

  const startEdit = () => {
    if (!deal) return;
    form.reset({ title: deal.title, value: deal.value ?? "", stage: deal.stage ?? "new" });
    setEditing(true);
  };

  const onSave = (values: DealForm) => {
    update.mutate(
      { id, title: values.title, value: values.value || null, stage: values.stage },
      {
        onSuccess: () => {
          toast.success("Deal updated");
          setEditing(false);
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  if (deals.isPending) {
    return (
      <main className="p-6">
        <Skeleton className="h-10 w-64 rounded-md" />
        <Skeleton className="mt-4 h-48 rounded-xl" />
      </main>
    );
  }

  if (deals.isError) {
    return (
      <main className="p-6">
        <p className="text-sm text-destructive">Couldn't load this deal. Refresh and try again.</p>
      </main>
    );
  }

  if (!deal) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-10 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">We couldn't find that deal</h1>
        <p className="max-w-sm text-muted-foreground">
          It may have been removed, or the link is wrong.
        </p>
        <Button asChild>
          <Link to="/records">Back to records</Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <Link to="/records" className="text-sm text-muted-foreground underline underline-offset-4">
        ← Back to records
      </Link>

      <RecordHeader
        className="mt-4"
        title={deal.title}
        subtitle="A deal the team is working together"
        badge={<StatusBadge state={stageState(deal.stage)}>{deal.stage ?? "new"}</StatusBadge>}
        actions={
          !editing ? (
            <Button variant="outline" onClick={startEdit}>
              Edit
            </Button>
          ) : undefined
        }
      />

      {!editing ? (
        <div className="mt-6 grid gap-4 rounded-xl border border-border p-5">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Title</p>
            <p className="mt-1 text-sm">{deal.title}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Value</p>
            <p className="mt-1 text-sm">{deal.value ?? "Not set"}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Stage</p>
            <p className="mt-1 text-sm capitalize">{deal.stage ?? "new"}</p>
          </div>
        </div>
      ) : (
        <Form {...form}>
          <form className="mt-6 grid gap-4 rounded-xl border border-border p-5" onSubmit={form.handleSubmit(onSave)}>
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
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm capitalize"
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
            <div className="flex gap-3">
              <Button type="submit" className="motion-press" disabled={update.isPending}>
                {update.isPending ? "Saving…" : "Save"}
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
        <ActivityFeed
          className="mt-3"
          items={[
            { title: "Record created", timestamp: deal.created_at ?? undefined },
            { title: "Last updated", timestamp: deal.updated_at ?? undefined },
          ]}
        />
      </div>
    </main>
  );
}

function AccountRecord({ id }: { id: string }) {
  const accounts = useRows<Account>("accounts");
  const update = useUpdateRow<Account>("accounts");
  const [editing, setEditing] = useState(false);

  const form = useForm<AccountForm>({
    resolver: zodResolver(accountSchema),
    defaultValues: { name: "", website: "", notes: "" },
  });

  const account = accounts.data?.find((a) => a.id === id);

  const startEdit = () => {
    if (!account) return;
    form.reset({ name: account.name, website: account.website ?? "", notes: account.notes ?? "" });
    setEditing(true);
  };

  const onSave = (values: AccountForm) => {
    update.mutate(
      { id, name: values.name, website: values.website || null, notes: values.notes || null },
      {
        onSuccess: () => {
          toast.success("Account updated");
          setEditing(false);
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  if (accounts.isPending) {
    return (
      <main className="p-6">
        <Skeleton className="h-10 w-64 rounded-md" />
        <Skeleton className="mt-4 h-48 rounded-xl" />
      </main>
    );
  }

  if (accounts.isError) {
    return (
      <main className="p-6">
        <p className="text-sm text-destructive">Couldn't load this account. Refresh and try again.</p>
      </main>
    );
  }

  if (!account) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-10 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">We couldn't find that account</h1>
        <p className="max-w-sm text-muted-foreground">
          It may have been removed, or the link is wrong.
        </p>
        <Button asChild>
          <Link to="/records">Back to records</Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <Link to="/records" className="text-sm text-muted-foreground underline underline-offset-4">
        ← Back to records
      </Link>

      <RecordHeader
        className="mt-4"
        title={account.name}
        subtitle="A shared account — anyone on the team can add to this"
        actions={
          !editing ? (
            <Button variant="outline" onClick={startEdit}>
              Edit
            </Button>
          ) : undefined
        }
      />

      {!editing ? (
        <div className="mt-6 grid gap-4 rounded-xl border border-border p-5">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Website</p>
            <p className="mt-1 text-sm">{account.website ?? "Not set"}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Notes</p>
            <p className="mt-1 whitespace-pre-wrap text-sm">{account.notes ?? "Nothing noted yet."}</p>
          </div>
        </div>
      ) : (
        <Form {...form}>
          <form className="mt-6 grid gap-4 rounded-xl border border-border p-5" onSubmit={form.handleSubmit(onSave)}>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="website"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Website</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea rows={4} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex gap-3">
              <Button type="submit" className="motion-press" disabled={update.isPending}>
                {update.isPending ? "Saving…" : "Save"}
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
        <ActivityFeed
          className="mt-3"
          items={[
            { title: "Record created", timestamp: account.created_at ?? undefined },
            { title: "Last updated", timestamp: account.updated_at ?? undefined },
          ]}
        />
      </div>
    </main>
  );
}
