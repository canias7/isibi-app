import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { useMember, useRows, useCreateRow, useDeleteRow, type Row } from "@/lib/rows";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Empty } from "@/components/ui/empty";
import { FilterBar } from "@/components/ui/filter-bar";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { BulkActions } from "@/components/ui/bulk-actions";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TableSearch } from "@/components/ui/table-search";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/records")({ component: Records });

type Deal = Row & { title: string; value: string | null; stage: string | null };
type Account = Row & { name: string; website: string | null; notes: string | null };

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

function Records() {
  const member = useMember();

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-56 flex-col gap-1 border-r border-border bg-muted/30 p-4 md:flex">
        <p className="px-2 text-lg font-semibold tracking-tight">Halyard</p>
        <nav className="mt-6 flex flex-col gap-1 text-sm">
          <Link
            to="/records"
            className="rounded-md px-2 py-1.5 font-medium bg-accent text-accent-foreground"
          >
            Deals
          </Link>
          <a href="#accounts" className="rounded-md px-2 py-1.5 text-muted-foreground hover:bg-accent">
            Accounts
          </a>
          <a href="#playbook" className="rounded-md px-2 py-1.5 text-muted-foreground hover:bg-accent">
            Playbook
          </a>
        </nav>
      </aside>

      <main className="flex-1 p-6 md:p-8">
        {member.isPending && <Skeleton className="h-40 rounded-xl" />}

        {!member.isPending && !member.data && (
          <Card className="mx-auto mt-16 max-w-md motion-enter">
            <CardHeader>
              <CardTitle>Sign in to see the pipeline</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Deals, accounts and the playbook are all signed-in only.
              </p>
              <Button asChild className="mt-4">
                <Link to="/">Go to sign in</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {!member.isPending && member.data && (
          <div className="space-y-12">
            <DealsSection />
            <section id="accounts">
              <AccountsSection />
            </section>
            <section id="playbook">
              <PlaybookSection role={member.data.role} />
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

function DealsSection() {
  const deals = useRows<Deal>("deals", { order: "id", dir: "desc" });
  const create = useCreateRow<Deal>("deals");
  const del = useDeleteRow("deals");
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  const form = useForm<DealForm>({
    resolver: zodResolver(dealSchema),
    defaultValues: { title: "", value: "", stage: "lead" },
  });

  const filtered = useMemo(() => {
    const rows = deals.data ?? [];
    return rows.filter((d) => {
      const matchesQuery = query
        ? d.title.toLowerCase().includes(query.toLowerCase())
        : true;
      const matchesStage = stageFilter === "all" ? true : d.stage === stageFilter;
      return matchesQuery && matchesStage;
    });
  }, [deals.data, query, stageFilter]);

  const onSubmit = (values: DealForm) => {
    create.mutate(values, {
      onSuccess: () => {
        toast.success("Deal added");
        form.reset();
        setOpen(false);
      },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  const onBulkDelete = () => {
    selected.forEach((id) => del.mutate(id));
    toast.success(`Removed ${selected.length} deal${selected.length === 1 ? "" : "s"}`);
    setSelected([]);
  };

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">The team's deals</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Everyone on the team reads and edits these — add one, move a stage,
            or open a record for the detail.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="motion-press">New record</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New deal</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Acme — annual renewal" {...field} />
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
                        <Input placeholder="£12,000" {...field} />
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
                <Button type="submit" className="motion-press" disabled={create.isPending}>
                  {create.isPending ? "Adding…" : "Add deal"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <TableSearch value={query} onChange={setQuery} placeholder="Search deals…" />
        <FilterBar
          filters={[
            {
              label: "Stage",
              value: stageFilter,
              options: [{ label: "All stages", value: "all" }, ...STAGES.map((s) => ({ label: s, value: s }))],
              onChange: setStageFilter,
            },
          ]}
        />
      </div>

      {selected.length > 0 && (
        <BulkActions
          className="mt-4"
          count={selected.length}
          actions={[{ label: "Remove selected", onSelect: onBulkDelete, variant: "destructive" }]}
          onClear={() => setSelected([])}
        />
      )}

      <div className="mt-4">
        {deals.isPending && <Skeleton className="h-64 rounded-xl" />}
        {deals.isError && (
          <p className="text-sm text-destructive">Couldn't load the deals. Refresh and try again.</p>
        )}
        {deals.data?.length === 0 && (
          <Empty
            title="No deals yet"
            description="Add the first deal the team is working and it'll show up here."
          />
        )}
        {!!deals.data?.length && filtered.length === 0 && (
          <Empty title="No matches" description="Try a different search or stage." />
        )}
        {filtered.length > 0 && (
          <DataTable
            data={filtered}
            selected={selected}
            onSelectedChange={setSelected}
            getRowId={(d) => d.id}
            columns={[
              {
                header: "Title",
                cell: (d) => (
                  <Link to="/record" search={{ id: d.id }} className="font-medium hover:underline">
                    {d.title}
                  </Link>
                ),
              },
              { header: "Value", cell: (d) => d.value ?? "—" },
              {
                header: "Stage",
                cell: (d) => <StatusBadge state={stageState(d.stage)}>{d.stage ?? "lead"}</StatusBadge>,
              },
            ]}
          />
        )}
      </div>
    </section>
  );
}

const accountSchema = z.object({
  name: z.string().min(2, "Name the account"),
  website: z.string().optional(),
  notes: z.string().optional(),
});

type AccountForm = z.infer<typeof accountSchema>;

function AccountsSection() {
  const accounts = useRows<Account>("accounts", { order: "id", dir: "desc" });
  const create = useCreateRow<Account>("accounts");
  const [open, setOpen] = useState(false);

  const form = useForm<AccountForm>({
    resolver: zodResolver(accountSchema),
    defaultValues: { name: "", website: "", notes: "" },
  });

  const onSubmit = (values: AccountForm) => {
    create.mutate(values, {
      onSuccess: () => {
        toast.success("Account added");
        form.reset();
        setOpen(false);
      },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Accounts</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Shared across the team — anyone signed in can read and add to this list.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="motion-press">
              Add account
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New account</DialogTitle>
            </DialogHeader>
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
                        <Input placeholder="https://" {...field} />
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
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="motion-press" disabled={create.isPending}>
                  {create.isPending ? "Adding…" : "Add account"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-4">
        {accounts.isPending && <Skeleton className="h-40 rounded-xl" />}
        {accounts.isError && (
          <p className="text-sm text-destructive">Couldn't load the accounts. Refresh and try again.</p>
        )}
        {accounts.data?.length === 0 && (
          <Empty title="No accounts yet" description="Add the first company the team is talking to." />
        )}
        {!!accounts.data?.length && (
          <ul className="grid gap-3 sm:grid-cols-2 motion-stagger">
            {accounts.data.map((a) => (
              <li key={a.id} className="rounded-lg border border-border p-4">
                <p className="font-medium">{a.name}</p>
                {a.website && (
                  <a
                    href={a.website}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-muted-foreground underline underline-offset-4"
                  >
                    {a.website}
                  </a>
                )}
                {a.notes && <p className="mt-2 text-sm text-muted-foreground">{a.notes}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

type Playbook = Row & { title: string; body: string | null };

const playbookSchema = z.object({
  title: z.string().min(2, "Give it a title"),
  body: z.string().min(1, "Add the content"),
});

type PlaybookForm = z.infer<typeof playbookSchema>;

function PlaybookSection({ role }: { role: string }) {
  const entries = useRows<Playbook>("playbook", { order: "id", dir: "desc" });
  const create = useCreateRow<Playbook>("playbook");
  const [open, setOpen] = useState(false);
  const canWrite = role === "admin";

  const form = useForm<PlaybookForm>({
    resolver: zodResolver(playbookSchema),
    defaultValues: { title: "", body: "" },
  });

  const onSubmit = (values: PlaybookForm) => {
    create.mutate(values, {
      onSuccess: () => {
        toast.success("Playbook entry added");
        form.reset();
        setOpen(false);
      },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Playbook</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The team's shared reference. Only admins can edit it.
          </p>
        </div>
        {canWrite && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="motion-press">
                New entry
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New playbook entry</DialogTitle>
              </DialogHeader>
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
                    name="body"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Content</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="motion-press" disabled={create.isPending}>
                    {create.isPending ? "Adding…" : "Add entry"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="mt-4">
        {entries.isPending && <Skeleton className="h-32 rounded-xl" />}
        {entries.isError && (
          <p className="text-sm text-destructive">Couldn't load the playbook. Refresh and try again.</p>
        )}
        {entries.data?.length === 0 && (
          <Empty title="Nothing written yet" description="Admins can add the first entry here." />
        )}
        {!!entries.data?.length && (
          <ul className="space-y-3 motion-stagger">
            {entries.data.map((e) => (
              <li key={e.id} className="rounded-lg border border-border p-4">
                <p className="font-medium">{e.title}</p>
                {e.body && <p className="mt-1 text-sm text-muted-foreground">{e.body}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
