import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableSearch } from "@/components/ui/table-search";
import { FilterBar } from "@/components/ui/filter-bar";
import { BulkActions } from "@/components/ui/bulk-actions";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { SideNav } from "@/components/ui/side-nav";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty } from "@/components/ui/empty";

export const Route = createFileRoute("/records")({ component: Records });

type Deal = Row & { title: string; value: string | null; stage: string | null };
type Account = Row & { name: string; website: string | null; notes: string | null };

const STAGES = ["New", "Qualifying", "Proposal", "Negotiation", "Won", "Lost"];

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

function Records() {
  const member = useMember();

  if (member.isPending) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Checking your sign-in…</div>;
  }

  if (!member.data) {
    return <Navigate to="/" />;
  }

  return <RecordsBoard />;
}

function RecordsBoard() {
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
    defaultValues: { title: "", value: "", stage: STAGES[0] },
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

  const onCreateDeal = (values: DealForm) => {
    createDeal.mutate(values, {
      onSuccess: () => {
        toast.success("Deal added to the pipeline.");
        dealForm.reset();
        setDealOpen(false);
      },
      onError: (e) => toast.error(e.message),
    });
  };

  const onCreateAccount = (values: AccountForm) => {
    createAccount.mutate(values, {
      onSuccess: () => {
        toast.success("Account added.");
        accountForm.reset();
        setAccountOpen(false);
      },
      onError: (e) => toast.error(e.message),
    });
  };

  const toggleSelected = (id: number) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r border-border bg-muted/30 p-4">
        <p className="px-2 text-lg font-semibold tracking-tight">Halyard</p>
        <SideNav
          className="mt-6"
          active={view === "deals" ? "deals" : "accounts"}
          sections={[
            {
              title: "Work",
              items: [
                { label: "Deals", href: "#deals" },
                { label: "Accounts", href: "#accounts" },
              ],
            },
          ]}
        />
        <div className="mt-6 flex flex-col gap-1 px-2">
          <button
            className="text-left text-sm text-muted-foreground hover:text-foreground"
            onClick={() => setView("deals")}
          >
            {view === "deals" ? "● " : ""}Deals
          </button>
          <button
            className="text-left text-sm text-muted-foreground hover:text-foreground"
            onClick={() => setView("accounts")}
          >
            {view === "accounts" ? "● " : ""}Accounts
          </button>
        </div>
      </aside>

      <main className="flex-1 p-8">
        {view === "deals" ? (
          <>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">The team's deals</h1>
                <p className="mt-1 text-sm text-muted-foreground">Everyone on the team reads and edits these.</p>
              </div>
              <Dialog open={dealOpen} onOpenChange={setDealOpen}>
                <DialogTrigger asChild>
                  <Button className="motion-press">New record</Button>
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
                filters={stageFilter ? [{ key: "stage", label: stageFilter }] : []}
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

            {selected.length > 0 && (
              <BulkActions
                className="mt-4"
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

            <div className="mt-6">
              {deals.isPending && <Skeleton className="h-72 rounded-xl" />}
              {deals.isError && (
                <p className="text-sm text-destructive">Couldn't load the deals. Refresh and try again.</p>
              )}
              {!deals.isPending && !deals.isError && filteredDeals.length === 0 && (
                <Empty
                  title="No deals here yet"
                  description="Add the team's first deal to get the pipeline moving."
                />
              )}
              {!deals.isPending && !deals.isError && filteredDeals.length > 0 && (
                <DataTable
                  data={filteredDeals}
                  columns={[
                    {
                      key: "select",
                      header: "",
                      cell: (row: Deal) => (
                        <input
                          type="checkbox"
                          checked={selected.includes(row.id as number)}
                          onChange={() => toggleSelected(row.id as number)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ),
                    },
                    { key: "title", header: "Deal", cell: (row: Deal) => row.title },
                    { key: "value", header: "Value", cell: (row: Deal) => row.value ?? "—" },
                    {
                      key: "stage",
                      header: "Stage",
                      cell: (row: Deal) => <StatusBadge state={stageState(row.stage)}>{row.stage ?? "New"}</StatusBadge>,
                    },
                  ]}
                  onRowClick={(row: Deal) => {
                    window.location.hash = `#/record?id=${row.id}`;
                  }}
                />
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Accounts</h1>
                <p className="mt-1 text-sm text-muted-foreground">Shared across the team — anyone signed in can add one.</p>
              </div>
              <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
                <DialogTrigger asChild>
                  <Button className="motion-press">New record</Button>
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
                              <Input placeholder="https://" {...field} />
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
            </div>

            <div className="mt-6">
              {accounts.isPending && <Skeleton className="h-72 rounded-xl" />}
              {accounts.isError && (
                <p className="text-sm text-destructive">Couldn't load the accounts. Refresh and try again.</p>
              )}
              {!accounts.isPending && !accounts.isError && (accounts.data?.length ?? 0) === 0 && (
                <Empty title="No accounts yet" description="Add the first account the team is working with." />
              )}
              {!accounts.isPending && !accounts.isError && (accounts.data?.length ?? 0) > 0 && (
                <DataTable
                  data={accounts.data ?? []}
                  columns={[
                    { key: "name", header: "Account", cell: (row: Account) => row.name },
                    { key: "website", header: "Website", cell: (row: Account) => row.website ?? "—" },
                    { key: "notes", header: "Notes", cell: (row: Account) => row.notes ?? "—" },
                  ]}
                />
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
