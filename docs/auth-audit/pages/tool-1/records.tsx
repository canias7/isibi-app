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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { TableSearch } from "@/components/ui/table-search";
import { FilterBar } from "@/components/ui/filter-bar";
import { BulkActions } from "@/components/ui/bulk-actions";
import { StatusBadge } from "@/components/ui/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty } from "@/components/ui/empty";

export const Route = createFileRoute("/records")({ component: Records });

type Deal = Row & { title: string; value: string | null; stage: string | null };
type Account = Row & { name: string; website: string | null; notes: string | null };

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

function Records() {
  const member = useMember();
  const [view, setView] = useState<"deals" | "accounts">("deals");
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [selected, setSelected] = useState<string[]>([]);

  const deals = useRows<Deal>("deals", { order: "title", dir: "asc" });
  const accounts = useRows<Account>("accounts", { order: "name", dir: "asc" });
  const createDeal = useCreateRow<Deal>("deals");
  const createAccount = useCreateRow<Account>("accounts");
  const navigate = useNavigate();

  const dealForm = useForm<DealForm>({
    resolver: zodResolver(dealSchema),
    defaultValues: { title: "", value: "", stage: "new" },
  });
  const accountForm = useForm<AccountForm>({
    resolver: zodResolver(accountSchema),
    defaultValues: { name: "", website: "", notes: "" },
  });

  const [dealDialogOpen, setDealDialogOpen] = useState(false);
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);

  const filteredDeals = useMemo(() => {
    let rows = deals.data ?? [];
    if (stageFilter !== "all") rows = rows.filter((d) => d.stage === stageFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((d) => d.title.toLowerCase().includes(q));
    }
    return rows;
  }, [deals.data, stageFilter, search]);

  const filteredAccounts = useMemo(() => {
    let rows = accounts.data ?? [];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((a) => a.name.toLowerCase().includes(q));
    }
    return rows;
  }, [accounts.data, search]);

  const onCreateDeal = (values: DealForm) => {
    createDeal.mutate(values, {
      onSuccess: () => {
        toast.success("Deal added");
        dealForm.reset();
        setDealDialogOpen(false);
      },
      onError: (e) => toast.error(e.message),
    });
  };

  const onCreateAccount = (values: AccountForm) => {
    createAccount.mutate(values, {
      onSuccess: () => {
        toast.success("Account added");
        accountForm.reset();
        setAccountDialogOpen(false);
      },
      onError: (e) => toast.error(e.message),
    });
  };

  const dealColumns: DataTableColumn<Deal>[] = [
    {
      key: "title",
      header: "Deal",
      cell: (d) => (
        <Link to="/record" search={{ table: "deals", id: d.id }} className="font-medium hover:underline">
          {d.title}
        </Link>
      ),
    },
    { key: "value", header: "Value", cell: (d) => d.value ?? "—" },
    {
      key: "stage",
      header: "Stage",
      cell: (d) => <StatusBadge state={stageState(d.stage)}>{d.stage ?? "new"}</StatusBadge>,
    },
  ];

  const accountColumns: DataTableColumn<Account>[] = [
    {
      key: "name",
      header: "Account",
      cell: (a) => (
        <Link to="/record" search={{ table: "accounts", id: a.id }} className="font-medium hover:underline">
          {a.name}
        </Link>
      ),
    },
    { key: "website", header: "Website", cell: (a) => a.website ?? "—" },
    { key: "notes", header: "Notes", cell: (a) => a.notes ?? "—" },
  ];

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
        <h1 className="text-2xl font-semibold tracking-tight">Sign in to see the records</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          The team's deals and accounts are only visible to signed-in members.
        </p>
        <Button asChild>
          <Link to="/">Go to sign in</Link>
        </Button>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-56 shrink-0 border-r border-border p-6 md:block">
        <p className="text-lg font-semibold tracking-tight">Halyard</p>
        <nav className="mt-8 flex flex-col gap-1 text-sm">
          <button
            className={`rounded-md px-3 py-2 text-left ${view === "deals" ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted/60"}`}
            onClick={() => {
              setView("deals");
              setSelected([]);
            }}
          >
            Deals
          </button>
          <button
            className={`rounded-md px-3 py-2 text-left ${view === "accounts" ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted/60"}`}
            onClick={() => {
              setView("accounts");
              setSelected([]);
            }}
          >
            Accounts
          </button>
          <Link to="/records" search={{ table: "playbook" } as never} className="rounded-md px-3 py-2 text-left text-muted-foreground hover:bg-muted/60">
            Playbook
          </Link>
        </nav>
      </aside>

      <main className="flex-1 p-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">
            {view === "deals" ? "The team's deals" : "Shared accounts"}
          </h1>
          {view === "deals" ? (
            <Dialog open={dealDialogOpen} onOpenChange={setDealDialogOpen}>
              <DialogTrigger asChild>
                <Button className="motion-press">New deal</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New deal</DialogTitle>
                </DialogHeader>
                <Form {...dealForm}>
                  <form onSubmit={dealForm.handleSubmit(onCreateDeal)} className="grid gap-4">
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
                    <Button type="submit" className="motion-press" disabled={createDeal.isPending}>
                      {createDeal.isPending ? "Adding…" : "Add deal"}
                    </Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          ) : (
            <Dialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen}>
              <DialogTrigger asChild>
                <Button className="motion-press">New account</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New account</DialogTitle>
                </DialogHeader>
                <Form {...accountForm}>
                  <form onSubmit={accountForm.handleSubmit(onCreateAccount)} className="grid gap-4">
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
                    <Button type="submit" className="motion-press" disabled={createAccount.isPending}>
                      {createAccount.isPending ? "Adding…" : "Add account"}
                    </Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <TableSearch value={search} onChange={setSearch} placeholder={view === "deals" ? "Search deals…" : "Search accounts…"} />
          {view === "deals" && (
            <FilterBar
              filters={[
                {
                  key: "stage",
                  label: "Stage",
                  value: stageFilter,
                  options: [{ value: "all", label: "All stages" }, ...STAGES.map((s) => ({ value: s, label: s }))],
                  onChange: setStageFilter,
                },
              ]}
            />
          )}
        </div>

        {view === "deals" && selected.length > 0 && (
          <BulkActions
            className="mt-4"
            count={selected.length}
            actions={[{ label: "Clear selection", onClick: () => setSelected([]) }]}
          />
        )}

        <div className="mt-6">
          {view === "deals" ? (
            <>
              {deals.isPending && <Skeleton className="h-64 rounded-xl" />}
              {deals.isError && (
                <p className="text-sm text-destructive">Couldn't load the deals. Refresh and try again.</p>
              )}
              {!deals.isPending && !deals.isError && filteredDeals.length === 0 && (
                <Empty
                  title="No deals yet"
                  description="Add the first deal your team is working and it'll show up here."
                />
              )}
              {!!filteredDeals.length && (
                <DataTable
                  data={filteredDeals}
                  columns={dealColumns}
                  getRowId={(d) => d.id}
                  selected={selected}
                  onSelectedChange={setSelected}
                  onRowClick={(d) => navigate({ to: "/record", search: { table: "deals", id: d.id } })}
                />
              )}
            </>
          ) : (
            <>
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
              {!!filteredAccounts.length && (
                <DataTable
                  data={filteredAccounts}
                  columns={accountColumns}
                  getRowId={(a) => a.id}
                  onRowClick={(a) => navigate({ to: "/record", search: { table: "accounts", id: a.id } })}
                />
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
