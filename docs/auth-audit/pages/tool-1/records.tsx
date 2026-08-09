import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { useMember, useRows, useCreateRow, type Row } from "@/lib/rows";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty } from "@/components/ui/empty";
import { DataTable, type Column } from "@/components/ui/data-table";
import { TableSearch } from "@/components/ui/table-search";
import { FilterBar } from "@/components/ui/filter-bar";
import { BulkActions } from "@/components/ui/bulk-actions";
import { StatusBadge } from "@/components/ui/status-badge";
import { SideNav } from "@/components/ui/side-nav";

export const Route = createFileRoute("/records")({ component: Records });

type Deal = Row & { title: string; value: string | null; stage: string | null };
type Account = Row & { name: string; website: string | null; notes: string | null };

const STAGES = ["lead", "qualified", "proposal", "won", "lost"];

const dealSchema = z.object({
  title: z.string().min(2, "Give the deal a name"),
  value: z.string().min(1, "Add a value"),
  stage: z.string().min(1, "Pick a stage"),
});
type DealForm = z.infer<typeof dealSchema>;

const accountSchema = z.object({
  name: z.string().min(2, "Give the account a name"),
  website: z.string().optional(),
  notes: z.string().optional(),
});
type AccountForm = z.infer<typeof accountSchema>;

function stageState(stage: string | null): "success" | "warning" | "danger" | "neutral" {
  switch (stage) {
    case "won":
      return "success";
    case "lost":
      return "danger";
    case "proposal":
      return "warning";
    default:
      return "neutral";
  }
}

function Records() {
  const member = useMember();
  const [view, setView] = useState<"deals" | "accounts">("deals");
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [dealOpen, setDealOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const navigate = useNavigate();

  const deals = useRows<Deal>("deals", { order: "id", dir: "desc" });
  const accounts = useRows<Account>("accounts", { order: "id", dir: "desc" });
  const createDeal = useCreateRow<Deal>("deals");
  const createAccount = useCreateRow<Account>("accounts");

  const dealForm = useForm<DealForm>({
    resolver: zodResolver(dealSchema),
    defaultValues: { title: "", value: "", stage: "lead" },
  });

  const accountForm = useForm<AccountForm>({
    resolver: zodResolver(accountSchema),
    defaultValues: { name: "", website: "", notes: "" },
  });

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

  const onCreateDeal = (values: DealForm) => {
    createDeal.mutate(values, {
      onSuccess: () => {
        toast.success("Deal added");
        dealForm.reset();
        setDealOpen(false);
      },
      onError: (e) => toast.error(e.message),
    });
  };

  const onCreateAccount = (values: AccountForm) => {
    createAccount.mutate(values, {
      onSuccess: () => {
        toast.success("Account added");
        accountForm.reset();
        setAccountOpen(false);
      },
      onError: (e) => toast.error(e.message),
    });
  };

  const dealColumns: Column<Deal>[] = [
    { key: "title", header: "Deal" },
    { key: "value", header: "Value", cell: (r) => r.value ?? "—" },
    {
      key: "stage",
      header: "Stage",
      cell: (r) => <StatusBadge state={stageState(r.stage)}>{r.stage ?? "lead"}</StatusBadge>,
    },
  ];

  const accountColumns: Column<Account>[] = [
    { key: "name", header: "Account" },
    { key: "website", header: "Website", cell: (r) => r.website ?? "—" },
    { key: "notes", header: "Notes", cell: (r) => r.notes ?? "—" },
  ];

  if (member.isPending) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Checking your sign-in…</p>
      </main>
    );
  }

  if (!member.data) {
    return (
      <main className="flex min-h-screen items-center justify-center p-10">
        <div className="max-w-sm text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Sign in to see the pipeline</h1>
          <p className="mt-2 text-muted-foreground">
            Deals and accounts are only visible to signed-in team members.
          </p>
          <Button asChild className="mt-6">
            <Link to="/">Sign in</Link>
          </Button>
        </div>
      </main>
    );
  }

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 shrink-0 border-r border-border p-6">
        <p className="text-lg font-semibold tracking-tight">Halyard</p>
        <SideNav
          className="mt-8"
          active={view}
          sections={[
            {
              items: [
                { label: "Deals", href: "#deals" },
                { label: "Accounts", href: "#accounts" },
              ],
            },
          ]}
        />
        <div className="mt-8 grid gap-2">
          <Button size="sm" variant={view === "deals" ? "default" : "outline"} onClick={() => setView("deals")}>
            Deals
          </Button>
          <Button size="sm" variant={view === "accounts" ? "default" : "outline"} onClick={() => setView("accounts")}>
            Accounts
          </Button>
        </div>
        <p className="mt-8 text-xs text-muted-foreground">Signed in as {member.data.name}</p>
      </aside>

      <main className="flex-1 p-8">
        {view === "deals" && (
          <>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">The team's deals</h1>
                <p className="text-muted-foreground">Everyone on the team reads and edits the same pipeline.</p>
              </div>
              <Dialog open={dealOpen} onOpenChange={setDealOpen}>
                <DialogTrigger asChild>
                  <Button className="motion-press">New deal</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>New deal</DialogTitle>
                  </DialogHeader>
                  <Form {...dealForm}>
                    <form className="grid gap-4" onSubmit={dealForm.handleSubmit(onCreateDeal)}>
                      <FormField
                        control={dealForm.control}
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
                        control={dealForm.control}
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
                        control={dealForm.control}
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
                      <Button type="submit" disabled={createDeal.isPending}>
                        {createDeal.isPending ? "Adding…" : "Add deal"}
                      </Button>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <TableSearch
                value={query}
                onChange={setQuery}
                placeholder="Search deals"
                count={filteredDeals.length}
                total={deals.data?.length ?? 0}
              />
            </div>

            <FilterBar
              className="mt-3"
              filters={stageFilter ? [{ key: "stage", label: `Stage: ${stageFilter}` }] : []}
              onRemove={() => setStageFilter(null)}
              onClear={() => setStageFilter(null)}
            >
              {STAGES.map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={stageFilter === s ? "default" : "outline"}
                  onClick={() => setStageFilter(stageFilter === s ? null : s)}
                >
                  {s}
                </Button>
              ))}
            </FilterBar>

            {selected.size > 0 && (
              <BulkActions
                className="mt-4"
                count={selected.size}
                onClear={() => setSelected(new Set())}
                actions={[
                  {
                    label: "Clear selection",
                    onSelect: () => setSelected(new Set()),
                  },
                ]}
              />
            )}

            <div className="mt-6">
              {deals.isPending && <Skeleton className="h-64 rounded-xl" />}
              {deals.isError && (
                <p className="text-sm text-destructive">Couldn't load the deals. Refresh and try again.</p>
              )}
              {!deals.isPending && !deals.isError && filteredDeals.length === 0 && (
                <Empty
                  title="No deals yet"
                  description="Add the team's first deal to get the pipeline started."
                />
              )}
              {!deals.isPending && !deals.isError && filteredDeals.length > 0 && (
                <DataTable
                  columns={dealColumns}
                  rows={filteredDeals}
                  rowKey={(r) => r.id}
                  onRowClick={(r) => navigate({ to: "/record", search: { id: String(r.id) } })}
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
                <p className="text-muted-foreground">Shared across the whole team — anyone can add one.</p>
              </div>
              <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
                <DialogTrigger asChild>
                  <Button className="motion-press">New account</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>New account</DialogTitle>
                  </DialogHeader>
                  <Form {...accountForm}>
                    <form className="grid gap-4" onSubmit={accountForm.handleSubmit(onCreateAccount)}>
                      <FormField
                        control={accountForm.control}
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
                        control={accountForm.control}
                        name="website"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Website</FormLabel>
                            <FormControl>
                              <Input placeholder="acme.com" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={accountForm.control}
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
                      <Button type="submit" disabled={createAccount.isPending}>
                        {createAccount.isPending ? "Adding…" : "Add account"}
                      </Button>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
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

            <div className="mt-6">
              {accounts.isPending && <Skeleton className="h-64 rounded-xl" />}
              {accounts.isError && (
                <p className="text-sm text-destructive">Couldn't load the accounts. Refresh and try again.</p>
              )}
              {!accounts.isPending && !accounts.isError && filteredAccounts.length === 0 && (
                <Empty
                  title="No accounts yet"
                  description="Add the first account the team is talking to."
                />
              )}
              {!accounts.isPending && !accounts.isError && filteredAccounts.length > 0 && (
                <DataTable columns={accountColumns} rows={filteredAccounts} rowKey={(r) => r.id} />
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
