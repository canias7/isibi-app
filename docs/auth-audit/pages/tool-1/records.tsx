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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable } from "@/components/ui/data-table";
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

const dealSchema = z.object({
  title: z.string().min(2, "Give the deal a name"),
  value: z.string().min(1, "Enter a value"),
  stage: z.string().min(1, "Pick a stage"),
});
type DealForm = z.infer<typeof dealSchema>;

const accountSchema = z.object({
  name: z.string().min(2, "Name the account"),
  website: z.string().min(1, "Add a website"),
  notes: z.string().max(1000).optional(),
});
type AccountForm = z.infer<typeof accountSchema>;

function stageState(stage: string | null): "success" | "warning" | "danger" | "neutral" {
  if (stage === "Won") return "success";
  if (stage === "Lost") return "danger";
  if (stage === "Negotiation" || stage === "Proposal") return "warning";
  return "neutral";
}

function Records() {
  const member = useMember();
  const [view, setView] = useState<"deals" | "accounts">("deals");
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<Array<string | number>>([]);
  const navigate = useNavigate();

  const deals = useRows<Deal>("deals", { order: "id", dir: "desc" });
  const accounts = useRows<Account>("accounts", { order: "id", dir: "desc" });
  const createDeal = useCreateRow<Deal>("deals");
  const createAccount = useCreateRow<Account>("accounts");
  const [dealOpen, setDealOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

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

  const onCreateDeal = (values: DealForm) => {
    createDeal.mutate(values, {
      onSuccess: () => {
        toast.success("Deal added");
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
        <h1 className="text-2xl font-semibold tracking-tight">Halyard</h1>
        <p className="text-muted-foreground">Sign in to see the team's records.</p>
        <Button asChild>
          <Link to="/">Sign in</Link>
        </Button>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r border-border bg-muted/30 p-4">
        <p className="px-2 text-sm font-semibold tracking-tight">Halyard</p>
        <SideNav
          className="mt-6"
          active={view}
          sections={[
            {
              title: "Records",
              items: [
                { label: "Deals", href: "#" },
                { label: "Accounts", href: "#" },
              ],
            },
          ]}
        />
        <div className="mt-6 grid gap-2 px-2">
          <Button
            variant={view === "deals" ? "default" : "outline"}
            onClick={() => {
              setView("deals");
              setSelected([]);
            }}
          >
            Deals
          </Button>
          <Button
            variant={view === "accounts" ? "default" : "outline"}
            onClick={() => {
              setView("accounts");
              setSelected([]);
            }}
          >
            Accounts
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {view === "deals" ? "The team's deals" : "Accounts"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {view === "deals"
                ? "Everyone on the team reads and edits the same rows."
                : "Shared across the team — anyone signed in can add one."}
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
          <FilterBar
            className="mt-3"
            filters={stageFilter ? [{ key: stageFilter, label: stageFilter }] : []}
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
        )}

        {view === "deals" && selected.length > 0 && (
          <BulkActions
            className="mt-3"
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
          {view === "deals" ? (
            <>
              {deals.isPending && <Skeleton className="h-72 rounded-xl" />}
              {deals.isError && (
                <p className="text-sm text-destructive">
                  Couldn't load the team's deals. Refresh and try again.
                </p>
              )}
              {!deals.isPending && !deals.isError && filteredDeals.length === 0 && (
                <Empty
                  title="No deals yet"
                  description="Add the team's first deal to start the pipeline."
                />
              )}
              {!deals.isPending && !deals.isError && filteredDeals.length > 0 && (
                <DataTable<Deal>
                  rowKey={(r) => r.id}
                  onRowClick={(r) => navigate({ to: "/record", search: { id: String(r.id) } })}
                  columns={[
                    { key: "title", header: "Title", cell: (r) => r.title },
                    {
                      key: "stage",
                      header: "Stage",
                      cell: (r) => (
                        <StatusBadge state={stageState(r.stage)}>{r.stage ?? "New"}</StatusBadge>
                      ),
                    },
                    {
                      key: "value",
                      header: "Value",
                      numeric: true,
                      cell: (r) => r.value ?? "—",
                    },
                  ]}
                  rows={filteredDeals}
                />
              )}
            </>
          ) : (
            <>
              {accounts.isPending && <Skeleton className="h-72 rounded-xl" />}
              {accounts.isError && (
                <p className="text-sm text-destructive">
                  Couldn't load accounts. Refresh and try again.
                </p>
              )}
              {!accounts.isPending && !accounts.isError && filteredAccounts.length === 0 && (
                <Empty
                  title="No accounts yet"
                  description="Add the first account the team is working with."
                />
              )}
              {!accounts.isPending && !accounts.isError && filteredAccounts.length > 0 && (
                <DataTable<Account>
                  rowKey={(r) => r.id}
                  columns={[
                    { key: "name", header: "Name", cell: (r) => r.name },
                    { key: "website", header: "Website", cell: (r) => r.website ?? "—" },
                    { key: "notes", header: "Notes", cell: (r) => r.notes ?? "—" },
                  ]}
                  rows={filteredAccounts}
                />
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
