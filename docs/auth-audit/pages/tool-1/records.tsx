import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import {
  useMember,
  useRows,
  useCreateRow,
  type Row,
} from "@/lib/rows";
import { DataTable } from "@/components/ui/data-table";
import { TableSearch } from "@/components/ui/table-search";
import { FilterBar } from "@/components/ui/filter-bar";
import { BulkActions } from "@/components/ui/bulk-actions";
import { StatusBadge } from "@/components/ui/status-badge";
import { SideNav } from "@/components/ui/side-nav";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty } from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
type PlaybookEntry = Row & { title: string; body: string | null };

const STAGES = ["lead", "qualified", "proposal", "negotiation", "won", "lost"];

const dealSchema = z.object({
  title: z.string().min(2, "Give the deal a title"),
  value: z.string().min(1, "Add a value"),
  stage: z.string().min(1, "Pick a stage"),
});
type DealForm = z.infer<typeof dealSchema>;

const accountSchema = z.object({
  name: z.string().min(2, "Name the account"),
  website: z.string().optional(),
  notes: z.string().optional(),
});
type AccountForm = z.infer<typeof accountSchema>;

function NewDealDialog() {
  const create = useCreateRow<Deal>("deals");
  const [open, setOpen] = useState(false);
  const form = useForm<DealForm>({
    resolver: zodResolver(dealSchema),
    defaultValues: { title: "", value: "", stage: "lead" },
  });

  const onSubmit = (values: DealForm) => {
    create.mutate(values, {
      onSuccess: () => {
        toast.success("Deal added");
        form.reset();
        setOpen(false);
      },
      onError: (e) => toast.error(e.message),
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>New record</Button>
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
  );
}

function NewAccountDialog() {
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
      onError: (e) => toast.error(e.message),
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">New account</Button>
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
                    <Input placeholder="https://…" {...field} />
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
                    <Textarea rows={3} {...field} />
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
  );
}

function stageState(stage: string | null): "success" | "warning" | "danger" | "neutral" {
  if (stage === "won") return "success";
  if (stage === "lost") return "danger";
  if (stage === "negotiation" || stage === "proposal") return "warning";
  return "neutral";
}

function Records() {
  const member = useMember();
  const navigate = useNavigate();
  const [view, setView] = useState<"deals" | "accounts" | "playbook">("deals");
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  const deals = useRows<Deal>("deals", { order: "id", dir: "desc" });
  const accounts = useRows<Account>("accounts", { order: "id", dir: "desc" });
  const playbook = useRows<PlaybookEntry>("playbook", { order: "id", dir: "desc" });

  const filteredDeals = useMemo(() => {
    let rows = deals.data ?? [];
    if (stageFilter) rows = rows.filter((d) => d.stage === stageFilter);
    if (query.trim()) {
      const q = query.toLowerCase();
      rows = rows.filter((d) => d.title.toLowerCase().includes(q));
    }
    return rows;
  }, [deals.data, stageFilter, query]);

  const filteredAccounts = useMemo(() => {
    let rows = accounts.data ?? [];
    if (query.trim()) {
      const q = query.toLowerCase();
      rows = rows.filter(
        (a) => a.name.toLowerCase().includes(q) || (a.website ?? "").toLowerCase().includes(q),
      );
    }
    return rows;
  }, [accounts.data, query]);

  if (member.isPending) {
    return (
      <div className="p-10">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-6 h-96 w-full" />
      </div>
    );
  }

  if (!member.data) {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in required</h1>
        <p className="mt-3 text-muted-foreground">
          The team's pipeline is only visible to signed-in members.
        </p>
        <Button asChild className="mt-6">
          <Link to="/">Go to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen md:grid-cols-[220px_1fr]">
      <aside className="border-r border-border bg-muted/30 p-6">
        <p className="text-lg font-semibold tracking-tight">Halyard</p>
        <SideNav
          className="mt-8"
          active={view}
          sections={[
            {
              items: [
                { label: "Deals", href: "#deals" },
                { label: "Accounts", href: "#accounts" },
                { label: "Playbook", href: "#playbook" },
              ],
            },
          ]}
        />
        <div className="mt-8 flex flex-col gap-2">
          <Button variant={view === "deals" ? "default" : "ghost"} onClick={() => setView("deals")}>
            Deals
          </Button>
          <Button
            variant={view === "accounts" ? "default" : "ghost"}
            onClick={() => setView("accounts")}
          >
            Accounts
          </Button>
          <Button
            variant={view === "playbook" ? "default" : "ghost"}
            onClick={() => setView("playbook")}
          >
            Playbook
          </Button>
        </div>
      </aside>

      <main className="p-8">
        {view === "deals" && (
          <>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">The team's deals</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Every deal the team is working, shared across the whole team.
                </p>
              </div>
              <NewDealDialog />
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <TableSearch
                value={query}
                onChange={setQuery}
                placeholder="Search deals"
                count={filteredDeals.length}
                total={deals.data?.length ?? 0}
              />
              <FilterBar
                filters={stageFilter ? [{ key: stageFilter, label: stageFilter }] : []}
                onRemove={() => setStageFilter(null)}
                onClear={() => setStageFilter(null)}
              >
                <Select value={stageFilter ?? ""} onValueChange={(v) => setStageFilter(v || null)}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="All stages" />
                  </SelectTrigger>
                  <SelectContent>
                    {STAGES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterBar>
            </div>

            {selected.length > 0 && (
              <BulkActions
                count={selected.length}
                onClear={() => setSelected([])}
                actions={[
                  {
                    label: "Clear selection",
                    onSelect: () => setSelected([]),
                  },
                ]}
              />
            )}

            <div className="mt-4">
              {deals.isPending && <Skeleton className="h-72 w-full rounded-xl" />}
              {deals.isError && (
                <p className="text-sm text-destructive">
                  Couldn't load the deals. Refresh and try again.
                </p>
              )}
              {!deals.isPending && !deals.isError && filteredDeals.length === 0 && (
                <Empty
                  title="No deals yet"
                  description="Add the first deal the team is working and it will show up here."
                />
              )}
              {!deals.isPending && !deals.isError && filteredDeals.length > 0 && (
                <DataTable
                  rows={filteredDeals}
                  rowKey={(d) => d.id}
                  onRowClick={(d) => navigate({ to: "/record", search: { table: "deals", id: String(d.id) } })}
                  columns={[
                    { key: "title", header: "Title", cell: (d) => d.title },
                    { key: "value", header: "Value", cell: (d) => d.value ?? "—" },
                    {
                      key: "stage",
                      header: "Stage",
                      cell: (d) => <StatusBadge state={stageState(d.stage)}>{d.stage ?? "lead"}</StatusBadge>,
                    },
                  ]}
                />
              )}
            </div>
          </>
        )}

        {view === "accounts" && (
          <>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Accounts</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Shared across the team — anyone signed in can read and add.
                </p>
              </div>
              <NewAccountDialog />
            </div>

            <div className="mt-6">
              <TableSearch
                value={query}
                onChange={setQuery}
                placeholder="Search accounts"
                count={filteredAccounts.length}
                total={accounts.data?.length ?? 0}
              />
            </div>

            <div className="mt-4">
              {accounts.isPending && <Skeleton className="h-72 w-full rounded-xl" />}
              {accounts.isError && (
                <p className="text-sm text-destructive">
                  Couldn't load accounts. Refresh and try again.
                </p>
              )}
              {!accounts.isPending && !accounts.isError && filteredAccounts.length === 0 && (
                <Empty
                  title="No accounts yet"
                  description="Add the first account and the whole team will see it."
                />
              )}
              {!accounts.isPending && !accounts.isError && filteredAccounts.length > 0 && (
                <DataTable
                  rows={filteredAccounts}
                  rowKey={(a) => a.id}
                  onRowClick={(a) =>
                    navigate({ to: "/record", search: { table: "accounts", id: String(a.id) } })
                  }
                  columns={[
                    { key: "name", header: "Name", cell: (a) => a.name },
                    { key: "website", header: "Website", cell: (a) => a.website ?? "—" },
                    { key: "notes", header: "Notes", cell: (a) => a.notes ?? "—" },
                  ]}
                />
              )}
            </div>
          </>
        )}

        {view === "playbook" && (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">Playbook</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Kept up to date by the business — read-only here.
            </p>
            <div className="mt-6">
              {playbook.isPending && <Skeleton className="h-72 w-full rounded-xl" />}
              {playbook.isError && (
                <p className="text-sm text-destructive">
                  Couldn't load the playbook. Refresh and try again.
                </p>
              )}
              {!playbook.isPending && !playbook.isError && (playbook.data?.length ?? 0) === 0 && (
                <Empty title="Nothing here yet" description="The playbook hasn't been written yet." />
              )}
              {!playbook.isPending && !playbook.isError && (playbook.data?.length ?? 0) > 0 && (
                <ul className="motion-stagger grid gap-4">
                  {playbook.data!.map((p) => (
                    <li key={p.id} className="rounded-xl border border-border bg-card p-5">
                      <h2 className="font-medium">{p.title}</h2>
                      <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">{p.body}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
