import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { useMember, useRows, useUpdateRow, type Row } from "@/lib/rows";
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
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/record")({
  component: RecordPage,
  validateSearch: (search: Record<string, unknown>): { table?: string; id?: string } => ({
    table: typeof search.table === "string" ? search.table : undefined,
    id: typeof search.id === "string" ? search.id : undefined,
  }),
});

type Deal = Row & { title: string; value: string | null; stage: string | null };
type Account = Row & { name: string; website: string | null; notes: string | null };

const STAGES = ["New", "Qualifying", "Proposal", "Negotiation", "Won", "Lost"];

function stageState(stage: string | null): "success" | "warning" | "danger" | "neutral" | "quiet" {
  switch (stage) {
    case "Won":
      return "success";
    case "Lost":
      return "danger";
    case "Negotiation":
    case "Proposal":
      return "warning";
    default:
      return "neutral";
  }
}

const dealSchema = z.object({
  title: z.string().min(2, "Give the deal a name"),
  value: z.string().optional(),
  stage: z.string().min(1, "Pick a stage"),
});

const accountSchema = z.object({
  name: z.string().min(2, "Give the account a name"),
  website: z.string().optional(),
  notes: z.string().optional(),
});

type DealForm = z.infer<typeof dealSchema>;
type AccountForm = z.infer<typeof accountSchema>;

function RecordPage() {
  const { table, id } = Route.useSearch();
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
        <h1 className="text-2xl font-semibold tracking-tight">Sign in to open this record</h1>
        <Button asChild>
          <Link to="/">Sign in</Link>
        </Button>
      </main>
    );
  }

  if (!table || !id || (table !== "deals" && table !== "accounts")) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-10 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">No record chosen</h1>
        <p className="text-muted-foreground">Open a record from the table instead.</p>
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

  const record = deals.data?.find((d) => String(d.id) === id);

  const form = useForm<DealForm>({
    resolver: zodResolver(dealSchema),
    values: record
      ? { title: record.title, value: record.value ?? "", stage: record.stage ?? "New" }
      : undefined,
  });

  if (deals.isPending) return <Skeleton className="m-10 h-64 rounded-xl" />;
  if (deals.isError)
    return <p className="m-10 text-sm text-destructive">Couldn't load this deal. Refresh and try again.</p>;
  if (!record)
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-10 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">We couldn't find that deal</h1>
        <p className="text-muted-foreground">It may not be yours to see, or it's been removed.</p>
        <Button asChild>
          <Link to="/records">Back to records</Link>
        </Button>
      </main>
    );

  const activity: Activity[] = [
    { who: "You", what: "opened this record", at: new Date() },
  ];

  const onSave = (values: DealForm) => {
    update.mutate(
      { id: record.id, ...values },
      {
        onSuccess: () => {
          toast.success("Deal updated");
          setEditing(false);
        },
        onError: (e: Error) => toast.error(e.message),
      },
    );
  };

  return (
    <main className="mx-auto max-w-3xl p-6 md:p-10">
      <RecordHeader
        title={record.title}
        subtitle="Deal · shared with the team"
        status={<StatusBadge state={stageState(record.stage)}>{record.stage ?? "New"}</StatusBadge>}
        actions={
          !editing ? (
            <Button variant="outline" onClick={() => setEditing(true)}>
              Edit
            </Button>
          ) : undefined
        }
      />

      <div className="mt-8">
        {editing ? (
          <Form {...form}>
            <form className="grid gap-4" onSubmit={form.handleSubmit(onSave)}>
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
              <div className="flex gap-3">
                <Button type="submit" className="motion-press" disabled={update.isPending}>
                  {update.isPending ? "Saving…" : "Save changes"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </Form>
        ) : (
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase text-muted-foreground">Value</dt>
              <dd className="mt-1 text-sm">{record.value ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-muted-foreground">Stage</dt>
              <dd className="mt-1 text-sm">{record.stage ?? "New"}</dd>
            </div>
          </dl>
        )}
      </div>

      <div className="mt-10">
        <h2 className="text-sm font-medium text-muted-foreground">Activity</h2>
        <ActivityFeed className="mt-3" items={activity} />
      </div>

      <div className="mt-8">
        <Button asChild variant="ghost">
          <Link to="/records">Back to records</Link>
        </Button>
      </div>
    </main>
  );
}

function AccountRecord({ id }: { id: string }) {
  const accounts = useRows<Account>("accounts");
  const update = useUpdateRow<Account>("accounts");
  const [editing, setEditing] = useState(false);

  const record = accounts.data?.find((a) => String(a.id) === id);

  const form = useForm<AccountForm>({
    resolver: zodResolver(accountSchema),
    values: record
      ? { name: record.name, website: record.website ?? "", notes: record.notes ?? "" }
      : undefined,
  });

  if (accounts.isPending) return <Skeleton className="m-10 h-64 rounded-xl" />;
  if (accounts.isError)
    return <p className="m-10 text-sm text-destructive">Couldn't load this account. Refresh and try again.</p>;
  if (!record)
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-10 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">We couldn't find that account</h1>
        <p className="text-muted-foreground">It may have been removed.</p>
        <Button asChild>
          <Link to="/records">Back to records</Link>
        </Button>
      </main>
    );

  const activity: Activity[] = [
    { who: "You", what: "opened this record", at: new Date() },
  ];

  const onSave = (values: AccountForm) => {
    update.mutate(
      { id: record.id, ...values },
      {
        onSuccess: () => {
          toast.success("Account updated");
          setEditing(false);
        },
        onError: (e: Error) => toast.error(e.message),
      },
    );
  };

  return (
    <main className="mx-auto max-w-3xl p-6 md:p-10">
      <RecordHeader
        title={record.name}
        subtitle="Account · shared with everyone signed in"
        actions={
          !editing ? (
            <Button variant="outline" onClick={() => setEditing(true)}>
              Edit
            </Button>
          ) : undefined
        }
      />

      <div className="mt-8">
        {editing ? (
          <Form {...form}>
            <form className="grid gap-4" onSubmit={form.handleSubmit(onSave)}>
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
                  {update.isPending ? "Saving…" : "Save changes"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </Form>
        ) : (
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase text-muted-foreground">Website</dt>
              <dd className="mt-1 text-sm">{record.website ?? "—"}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase text-muted-foreground">Notes</dt>
              <dd className="mt-1 text-sm whitespace-pre-wrap">{record.notes ?? "—"}</dd>
            </div>
          </dl>
        )}
      </div>

      <div className="mt-10">
        <h2 className="text-sm font-medium text-muted-foreground">Activity</h2>
        <ActivityFeed className="mt-3" items={activity} />
      </div>

      <div className="mt-8">
        <Button asChild variant="ghost">
          <Link to="/records">Back to records</Link>
        </Button>
      </div>
    </main>
  );
}
