import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { useMember, useRows, useUpdateRow, type Row } from "@/lib/rows";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RecordHeader } from "@/components/ui/record-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { ActivityFeed } from "@/components/ui/activity-feed";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty } from "@/components/ui/empty";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/record")({
  component: RecordPage,
  validateSearch: (search: Record<string, unknown>): { id: string; type: "deal" | "account" } => ({
    id: typeof search.id === "string" ? search.id : "",
    type: search.type === "account" ? "account" : "deal",
  }),
});

type Deal = Row & { title: string; value: string | null; stage: string | null };
type Account = Row & { name: string; website: string | null; notes: string | null };
type Playbook = Row & { title: string; body: string | null };

const STAGES = ["new", "qualifying", "proposal", "negotiation", "won", "lost"];

function stageState(stage: string | null): "success" | "warning" | "danger" | "neutral" {
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
  const { id, type } = Route.useSearch();
  const member = useMember();
  const navigate = useNavigate();

  if (member.isPending) {
    return (
      <main className="p-10">
        <Skeleton className="h-64 w-full rounded-xl" />
      </main>
    );
  }

  if (!member.data) {
    return (
      <main className="grid min-h-screen place-items-center p-10">
        <Card className="w-full max-w-sm text-center">
          <CardHeader>
            <CardTitle>Sign in required</CardTitle>
            <CardDescription>Records are only visible to signed-in team members.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/">Go to sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!id) {
    return (
      <main className="p-10">
        <Empty title="No record selected" description="Open a row from the records table to see it here." />
        <Button asChild className="mt-4">
          <Link to="/records">Back to records</Link>
        </Button>
      </main>
    );
  }

  return type === "deal" ? <DealRecord id={id} /> : <AccountRecord id={id} />;
}

function DealRecord({ id }: { id: string }) {
  const deals = useRows<Deal>("deals");
  const playbook = useRows<Playbook>("playbook", { order: "id", dir: "desc", limit: 5 });
  const update = useUpdateRow<Deal>("deals");
  const [editing, setEditing] = useState(false);

  const deal = deals.data?.find((d) => d.id === id);

  const form = useForm<DealForm>({
    resolver: zodResolver(dealSchema),
    values: deal
      ? { title: deal.title, value: deal.value ?? "", stage: deal.stage ?? "new" }
      : undefined,
  });

  const onSubmit = (values: DealForm) => {
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
      <main className="p-10">
        <Skeleton className="h-64 w-full rounded-xl" />
      </main>
    );
  }

  if (deals.isError) {
    return (
      <main className="p-10">
        <p className="text-sm text-destructive">Couldn't load this deal. Refresh and try again.</p>
      </main>
    );
  }

  if (!deal) {
    return (
      <main className="p-10">
        <Empty title="Not found" description="This deal doesn't exist, or has moved." />
        <Button asChild className="mt-4">
          <Link to="/records">Back to records</Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl p-6 md:p-10">
      <Link to="/records" className="text-sm text-muted-foreground underline underline-offset-4">
        ← Back to records
      </Link>

      <div className="mt-4">
        <RecordHeader
          title={deal.title}
          subtitle={deal.value ? `Value: ${deal.value}` : "No value set"}
          status={<StatusBadge state={stageState(deal.stage)}>{deal.stage ?? "new"}</StatusBadge>}
          actions={
            <Button variant="outline" onClick={() => setEditing((v) => !v)}>
              {editing ? "Cancel" : "Edit"}
            </Button>
          }
        />
      </div>

      {editing ? (
        <Card className="mt-6">
          <CardContent className="pt-6">
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
                      <FormControl>
                        <select
                          className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm capitalize"
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
          </CardContent>
        </Card>
      ) : (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Fields</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div className="flex justify-between border-b border-border pb-2">
              <span className="text-muted-foreground">Title</span>
              <span>{deal.title}</span>
            </div>
            <div className="flex justify-between border-b border-border pb-2">
              <span className="text-muted-foreground">Value</span>
              <span>{deal.value ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Stage</span>
              <StatusBadge state={stageState(deal.stage)}>{deal.stage ?? "new"}</StatusBadge>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="mt-8">
        <h2 className="text-sm font-medium">Activity</h2>
        <ActivityFeed
          className="mt-3"
          items={[
            {
              id: "created",
              title: `${deal.title} added to the pipeline`,
              at: deal.created_at,
            },
          ]}
          empty="No activity yet on this deal."
        />
      </div>

      <div className="mt-8 border-t border-border pt-6">
        <h2 className="text-sm font-medium">From the playbook</h2>
        {playbook.isPending && <Skeleton className="mt-3 h-24 w-full rounded-xl" />}
        {playbook.isError && (
          <p className="mt-3 text-sm text-destructive">Couldn't load the playbook.</p>
        )}
        {playbook.data?.length === 0 && (
          <p className="mt-3 text-sm text-muted-foreground">Nothing in the playbook yet.</p>
        )}
        {!!playbook.data?.length && (
          <ul className="mt-3 space-y-3 motion-stagger">
            {playbook.data.map((p) => (
              <li key={p.id} className="rounded-md border border-border p-3">
                <p className="text-sm font-medium">{p.title}</p>
                {p.body && <p className="mt-1 text-sm text-muted-foreground">{p.body}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

function AccountRecord({ id }: { id: string }) {
  const accounts = useRows<Account>("accounts");
  const update = useUpdateRow<Account>("accounts");
  const [editing, setEditing] = useState(false);

  const account = accounts.data?.find((a) => a.id === id);

  const form = useForm<AccountForm>({
    resolver: zodResolver(accountSchema),
    values: account
      ? { name: account.name, website: account.website ?? "", notes: account.notes ?? "" }
      : undefined,
  });

  const onSubmit = (values: AccountForm) => {
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
      <main className="p-10">
        <Skeleton className="h-64 w-full rounded-xl" />
      </main>
    );
  }

  if (accounts.isError) {
    return (
      <main className="p-10">
        <p className="text-sm text-destructive">Couldn't load this account. Refresh and try again.</p>
      </main>
    );
  }

  if (!account) {
    return (
      <main className="p-10">
        <Empty title="Not found" description="This account doesn't exist, or has moved." />
        <Button asChild className="mt-4">
          <Link to="/records">Back to records</Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl p-6 md:p-10">
      <Link to="/records" className="text-sm text-muted-foreground underline underline-offset-4">
        ← Back to records
      </Link>

      <div className="mt-4">
        <RecordHeader
          title={account.name}
          subtitle={account.website ?? "No website on file"}
          actions={
            <Button variant="outline" onClick={() => setEditing((v) => !v)}>
              {editing ? "Cancel" : "Edit"}
            </Button>
          }
        />
      </div>

      {editing ? (
        <Card className="mt-6">
          <CardContent className="pt-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
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
                <Button type="submit" className="motion-press" disabled={update.isPending}>
                  {update.isPending ? "Saving…" : "Save changes"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      ) : (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Fields</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div className="flex justify-between border-b border-border pb-2">
              <span className="text-muted-foreground">Name</span>
              <span>{account.name}</span>
            </div>
            <div className="flex justify-between border-b border-border pb-2">
              <span className="text-muted-foreground">Website</span>
              <span>{account.website ?? "—"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Notes</span>
              <p className="mt-1">{account.notes ?? "—"}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="mt-8">
        <h2 className="text-sm font-medium">Activity</h2>
        <ActivityFeed
          className="mt-3"
          items={[
            {
              id: "created",
              title: `${account.name} added to the shared list`,
              at: account.created_at,
            },
          ]}
          empty="No activity yet on this account."
        />
      </div>
    </main>
  );
}
