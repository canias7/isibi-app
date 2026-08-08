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
import { Textarea } from "@/components/ui/textarea";
import { DataTable, type Column } from "@/components/ui/data-table";
import { TableSearch } from "@/components/ui/table-search";
import { FilterBar } from "@/components/ui/filter-bar";
import { BulkActions } from "@/components/ui/bulk-actions";
import { StatusBadge } from "@/components/ui/status-badge";
import { SideNav } from "@/components/ui/side-nav";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty } from "@/components/ui/empty";

export const Route = createFileRoute("/records")({ component: Records });

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

function Records() {
  const member = useMember();
  const navigate = useNavigate();
  const [view, setView] = useState<"deals" | "accounts">("deals");
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [dealOpen, setDealOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  const deals = useRows<Deal>("deals", { order: "id", dir: "desc" });
  const accounts = useRows<Account>("accounts", { order: "id", dir: "desc" });
  const createDeal = useCreateRow<Deal>("deals");
  const createAccount = useCreateRow<Account>("accounts");

  const dealForm = useForm<DealForm>({
    resolver: zodResolver(dealSchema),
    defaultValues: { title: "", value: "", stage: "New" },
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

  const dealColumns: Column<Deal>[] = [
    { key: "title", header: "Deal", cell: (r) => <span className="font-medium">{r.title}</span> },
    { key: "value", header: "Value", cell: (r) => r.value ?? "—" },
    {
      key: "stage",
      header: "Stage",
      cell: (r) => <StatusBadge state={stageState(r.stage)}>{r.stage ?? "New"}</StatusBadge>,
    },
  ];

  const accountColumns: Column<Account>[] = [
    { key: "name", header: "Account", cell: (r) => <span className="font-medium">{r.name}</span> },
    { key: "website", header: "Website", cell: (r) => r.website ?? "—" },
    { key: "notes", header: "Notes", cell: (r) => (r.notes ? r.notes.slice(0, 60) : "—") },
  ];

  const onCreateDeal = (values: DealForm) => {
    createDeal.mutate(values, {
      onSuccess: () => {
        toast.success("Deal added to the pipeline");
        dealForm.reset();
        setDealOpen(false);
      },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  const onCreateAccount = (values: AccountForm) => {
    createAccount.mutate(values, {
      onSuccess: () => {
        toast.success("Account added");
        accountForm.reset();
        setAccountOpen(false);
      },
      onError: (e: Error) => toast.error(e.message),
    });
  };

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
        <h1 className="text-2xl font-semibold tracking-tight">Sign in to see the pipeline</h1>
        <p className="text-muted-foreground max-w-sm">
          Halyard's records are private to your team — sign in first.
        </p>
        <Button asChild>
          <Link to="/">Sign in</Link>
        </Button>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-56 shrink-0 border-r border-border p-6 md:block">
        <p className="text-lg font-semibold tracking-tight">Halyard</p>
        <div className="mt-8">
          <SideNav
            active={view === "deals" ? "deals" : "accounts"}
            sections={[
              {
                items: [
                  { label: "Deals", href: "#deals" },
                  { label: "Accounts", href: "#accounts" },
                ],
              },
            ]}
          />
          <div className="mt-4 flex flex-col gap-1">
            <button
              className={`rounded-md px-3 py-2 text-left text-sm ${view === "deals" ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted/50"}`}
              onClick={() => {
                setView("deals");
                setSelected([]);
              }}
            >
              Deals
            </button>
            <button
              className={`rounded-md px-3 py-2 text-left text-sm ${view === "accounts" ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted/50"}`}
              onClick={() => {
                setView("accounts");
                setSelected([]);
              }}
            >
              Accounts
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 p-6 md:p-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {view === "deals" ? "The team's deals" : "Shared accounts"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {view === "deals"
                ? "Everything the team is working, in one table."
                : "Every company anyone on the team has talked to."}
            </p>
          </div>
          {view === "deals" ? (
            <Dialog open={dealOpen} onOpenChange={setDealOpen}>
              <DialogTrigger asChild>
                <Button>New record</Button>
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
            <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
              <DialogTrigger asChild>
                <Button>New record</Button>
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
                            <Input placeholder="https://…" {...field} />
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
                            <Textarea rows={3} {...field} />
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
          <TableSearch
            value={query}
            onChange={setQuery}
            placeholder={view === "deals" ? "Search deals…" : "Search accounts…"}
            count={view === "deals" ? filteredDeals.length : filteredAccounts.length}
            total={view === "deals" ? deals.data?.length ?? 0 : accounts.data?.length ?? 0}
          />
        </div>

        {view === "deals" && (
          <div className="mt-3">
            <FilterBar
              filters={stageFilter ? [{ key: stageFilter, label: stageFilter }] : []}
              onRemove={() => setStageFilter(null)}
              onClear={() => setStageFilter(null)}
            >
              <Select value={stageFilter ?? "__all"} onValueChange={(v) => setStageFilter(v === "__all" ? null : v)}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Stage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">All stages</SelectItem>
                  {STAGES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterBar>
          </div>
        )}

        {view === "deals" && selected.length > 0 && (
          <div className="mt-3">
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
          </div>
        )}

        <div className="mt-6">
          {view === "deals" ? (
            <>
              {deals.isPending && <Skeleton className="h-72 rounded-xl" />}
              {deals.isError && (
                <p className="text-sm text-destructive">Couldn't load the deals. Refresh and try again.</p>
              )}
              {!deals.isPending && !deals.isError && filteredDeals.length === 0 && (
                <Empty
                  title="No deals yet"
                  description="Add the first deal the team is working and it'll show up here for everyone."
                />
              )}
              {!deals.isPending && !deals.isError && filteredDeals.length > 0 && (
                <DataTable
                  columns={dealColumns}
                  rows={filteredDeals}
                  rowKey={(r) => r.id}
                  onRowClick={(r) => navigate({ to: "/record", search: { table: "deals", id: String(r.id) } })}
                />
              )}
            </>
          ) : (
            <>
              {accounts.isPending && <Skeleton className="h-72 rounded-xl" />}
              {accounts.isError && (
                <p className="text-sm text-destructive">Couldn't load the accounts. Refresh and try again.</p>
              )}
              {!accounts.isPending && !accounts.isError && filteredAccounts.length === 0 && (
                <Empty
                  title="No accounts yet"
                  description="Add the first company the team has spoken to."
                />
              )}
              {!accounts.isPending && !accounts.isError && filteredAccounts.length > 0 && (
                <DataTable
                  columns={accountColumns}
                  rows={filteredAccounts}
                  rowKey={(r) => r.id}
                  onRowClick={(r) => navigate({ to: "/record", search: { table: "accounts", id: String(r.id) } })}
                />
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
