import { createFileRoute, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { useMember, useRows, useUpdateRow, type Row } from "@/lib/rows";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RecordHeader } from "@/components/ui/record-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { ActivityFeed } from "@/components/ui/activity-feed";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty } from "@/components/ui/empty";

export const Route = createFileRoute("/record")({
  component: RecordPage,
  validateSearch: (search: Record<string, unknown>): { table?: string; id?: string } => ({
    table: typeof search.table === "string" ? search.table : undefined,
    id: typeof search.id === "string" ? search.id : undefined,
  }),
});

type Deal = Row & { title: string; value: string | null; stage: string | null };
type Account = Row & { name: string; website: string | null; notes: string | null };
type Playbook = Row & { title: string; body: string | null };

const STAGES = ["new", "qualified", "proposal", "won", "lost"] as const;

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

function stageState(stage: string | null): "success" | "warning" | "neutral" | "danger" {
  if (stage === "won") return "success";
  if (stage === "lost") return "danger";
  if (stage === "proposal") return "warning";
  return "neutral";
}

function RecordPage() {
  const { table, id } = Route.useSearch();
  const member = useMember();

  if (member.isPending) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Checking your sign-in…</p>
      </main>
    );
  }

  if (!member.data) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-10 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in to view this record</h1>
        <Button asChild>
          <Link to="/">Go to sign in</Link>
        </Button>
      </main>
    );
  }

  if (!table || !id) {
    return (
      <main className="p-10">
        <Empty title="No record chosen" description="Open a record from the table to see it here." />
        <Button asChild className="mt-4">
          <Link to="/records">Back to records</Link>
        </Button>
      </main>
    );
  }

  if (table === "deals") return <DealRecord id={id} />;
  if (table === "accounts") return <AccountRecord id={id} />;
  if (table === "playbook") return <PlaybookRecord id={id} />;

  return (
    <main className="p-10">
      <Empty title="Unknown record type" description="That link doesn't point at a table this tool knows." />
    </main>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-56 shrink-0 border-r border-border p-6 md:block">
        <Link to="/" className="text-lg font-semibold tracking-tight">
          Halyard
        </Link>
        <nav className="mt-8 flex flex-col gap-1 text-sm text-muted-foreground">
          <Link to="/records" className="rounded-md px-3 py-2 text-left hover:bg-muted/60">
            Back to records
          </Link>
        </nav>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}

function DealRecord({ id }: { id: string }) {
  const deals = useRows<Deal>("deals");
  const update = useUpdateRow<Deal>("deals");
  const deal = deals.data?.find((d) => d.id === id);

  const form = useForm<DealForm>({
    resolver: zodResolver(dealSchema),
    values: deal ? { title: deal.title, value: deal.value ?? "", stage: deal.stage ?? "new" } : undefined,
  });

  if (deals.isPending) {
    return (
      <Shell>
        <Skeleton className="h-96 rounded-xl" />
      </Shell>
    );
  }

  if (deals.isError) {
    return (
      <Shell>
        <p className="text-sm text-destructive">Couldn't load this deal. Refresh and try again.</p>
      </Shell>
    );
  }

  if (!deal) {
    return (
      <Shell>
        <Empty title="Not found" description="This deal isn't in the team's pipeline, or it's been removed." />
      </Shell>
    );
  }

  const onSave = (values: DealForm) => {
    update.mutate(
      { id: deal.id, ...values },
      {
        onSuccess: () => toast.success("Deal updated"),
        onError: (e) => toast.error(e.message),
      },
    );
  };

  return (
    <Shell>
      <RecordHeader
        title={deal.title}
        subtitle="Deal"
        badge={<StatusBadge state={stageState(deal.stage)}>{deal.stage ?? "new"}</StatusBadge>}
      />
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fields</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSave)} className="grid gap-4">
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
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityFeed
              items={[
                { id: "created", title: "Deal created", timestamp: deal.created_at },
                { id: "updated", title: "Last updated", timestamp: deal.updated_at ?? deal.created_at },
              ]}
            />
          </CardContent>
        </Card>
      </div>
    </Shell>
  );
}

function AccountRecord({ id }: { id: string }) {
  const accounts = useRows<Account>("accounts");
  const update = useUpdateRow<Account>("accounts");
  const account = accounts.data?.find((a) => a.id === id);
  const member = useMember();

  const form = useForm<AccountForm>({
    resolver: zodResolver(accountSchema),
    values: account
      ? { name: account.name, website: account.website ?? "", notes: account.notes ?? "" }
      : undefined,
  });

  if (accounts.isPending) {
    return (
      <Shell>
        <Skeleton className="h-96 rounded-xl" />
      </Shell>
    );
  }

  if (accounts.isError) {
    return (
      <Shell>
        <p className="text-sm text-destructive">Couldn't load this account. Refresh and try again.</p>
      </Shell>
    );
  }

  if (!account) {
    return (
      <Shell>
        <Empty title="Not found" description="This account isn't in the shared list, or it's been removed." />
      </Shell>
    );
  }

  const isOwner = member.data && account.owner_id === member.data.id;

  const onSave = (values: AccountForm) => {
    update.mutate(
      { id: account.id, ...values },
      {
        onSuccess: () => toast.success("Account updated"),
        onError: (e) => toast.error(e.message),
      },
    );
  };

  return (
    <Shell>
      <RecordHeader title={account.name} subtitle="Account" />
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fields</CardTitle>
          </CardHeader>
          <CardContent>
            {isOwner ? (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSave)} className="grid gap-4">
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
            ) : (
              <div className="grid gap-3 text-sm">
                <p>
                  <span className="text-muted-foreground">Website: </span>
                  {account.website || "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">Notes: </span>
                  {account.notes || "—"}
                </p>
                <p className="text-xs text-muted-foreground">Only the teammate who added this account can edit it.</p>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityFeed
              items={[
                { id: "created", title: "Account added", timestamp: account.created_at },
                { id: "updated", title: "Last updated", timestamp: account.updated_at ?? account.created_at },
              ]}
            />
          </CardContent>
        </Card>
      </div>
    </Shell>
  );
}

function PlaybookRecord({ id }: { id: string }) {
  const playbook = useRows<Playbook>("playbook");
  const entry = playbook.data?.find((p) => p.id === id);

  if (playbook.isPending) {
    return (
      <Shell>
        <Skeleton className="h-64 rounded-xl" />
      </Shell>
    );
  }

  if (playbook.isError) {
    return (
      <Shell>
        <p className="text-sm text-destructive">Couldn't load the playbook. Refresh and try again.</p>
      </Shell>
    );
  }

  if (!entry) {
    return (
      <Shell>
        <Empty title="Not found" description="This playbook entry isn't there any more." />
      </Shell>
    );
  }

  return (
    <Shell>
      <RecordHeader title={entry.title} subtitle="Playbook" />
      <Card className="mt-6">
        <CardContent className="pt-6 whitespace-pre-wrap text-sm text-foreground">
          {entry.body || "No content yet."}
        </CardContent>
      </Card>
    </Shell>
  );
}
