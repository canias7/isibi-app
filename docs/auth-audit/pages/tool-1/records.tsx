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
import { DataTable } from "@/components/ui/data-table";
import { TableSearch } from "@/components/ui/table-search";
import { FilterBar } from "@/components/ui/filter-bar";
import { BulkActions } from "@/components/ui/bulk-actions";
import { StatusBadge } from "@/components/ui/status-badge";
import { SideNav } from "@/components/ui/side-nav";
import { Empty } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/records")({
  component: Records,
  validateSearch: (search: Record<string, unknown>): { tab?: string } => ({
    tab: typeof search.tab === "string" ? search.tab : undefined,
  }),
});

type Deal = Row & { title: string; value: string | null; stage: string | null };
type Account = Row & { name: string; website: string | null; notes: string | null };

const STAGES = ["New", "Qualifying", "Proposal", "Negotiation", "Won", "Lost"];

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

function stageState(stage: string | null): "success" | "warning" | "danger" | "neutral" {
  if (stage === "Won") return "success";
  if (stage === "Lost") return "danger";
  if (stage === "Negotiation" || stage === "Proposal") return "warning";
  return "neutral";
}

function Records() {
  const member = useMember();
  const { tab } = Route.useSearch();
  const active = tab === "accounts" ? "accounts" : "deals";
  const navigate = useNavigate();

  const deals = useRows<Deal>("deals", { order: "id", dir: "desc" });
  const accounts = useRows<Account>("accounts", { order: "id", dir: "desc" });
  const createDeal = useCreateRow<Deal>("deals");
  const createAccount = useCreateRow<Account>("accounts");

  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
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

  if (member.isPending) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Checking your sign-in…</p>
      </main>
    );
  }

  if (!member.data) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 text-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sign in to see the pipeline</h1>
          <p className="mt-2 text-muted-foreground">Deals and accounts are only visible to the team, signed in.</p>
          <Button asChild className="mt-6">
            <Link to="/">Go to sign in</Link>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 shrink-0 border-r border-border bg-muted/30 p-6">
        <p className="text-lg font-semibold tracking-tight">Halyard</p>
        <SideNav
          className="mt-6"
          active={active === "accounts" ? "accounts" : "deals"}
          sections={[
            {
              title: "Records",
              items: [
                { label: "Deals", href: "/records" },
                { label: "Accounts", href: "/records?tab=accounts" },
                { label: "Playbook", href: "/playbook" },
              ],
            },
          ]}
        />
      </aside>

      <main className="flex-1 overflow-x-hidden p-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {active === "accounts" ? "Accounts" : "Deals"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {active === "accounts"
                ? "The team's shared list of accounts."
                : "The deals our team is working right now."}
            </p>
          </div>
          {active === "accounts" ? (
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
          ) : (
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
                            <Input placeholder="£" {...field} />
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
                          <FormControl>
                            <select
                              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
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
                    <Button type="submit" className="motion-press" disabled={createDeal.isPending}>
                      {createDeal.isPending ? "Adding…" : "Add deal"}
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
            placeholder={active === "accounts" ? "Search accounts" : "Search deals"}
            count={active === "accounts" ? filteredAccounts.length : filteredDeals.length}
            total={active === "accounts" ? accounts.data?.length : deals.data?.length}
          />
          {active === "deals" && (
            <FilterBar
              filters={stageFilter ? [{ key: "stage", label: stageFilter }] : []}
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
        </div>

        {active === "deals" && selected.length > 0 && (
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

        <div className="mt-6">
          {active === "accounts" ? (
            <>
              {accounts.isPending && <Skeleton className="h-64 rounded-xl" />}
              {accounts.isError && (
                <p className="text-sm text-destructive">Couldn't load accounts. Refresh and try again.</p>
              )}
              {accounts.data?.length === 0 && (
                <Empty title="No accounts yet" description="Add the first account the team is working with." />
              )}
              {!!accounts.data?.length && (
                <DataTable
                  rows={filteredAccounts}
                  rowKey={(r) => r.id}
                  columns={[
                    { key: "name", header: "Name", cell: (r) => r.name },
                    { key: "website", header: "Website", cell: (r) => r.website ?? "—" },
                    { key: "notes", header: "Notes", cell: (r) => r.notes ?? "—" },
                  ]}
                />
              )}
            </>
          ) : (
            <>
              {deals.isPending && <Skeleton className="h-64 rounded-xl" />}
              {deals.isError && (
                <p className="text-sm text-destructive">Couldn't load deals. Refresh and try again.</p>
              )}
              {deals.data?.length === 0 && (
                <Empty title="No deals yet" description="Add the first deal the team is working." />
              )}
              {!!deals.data?.length && (
                <DataTable
                  rows={filteredDeals}
                  rowKey={(r) => r.id}
                  onRowClick={(r) => navigate({ to: "/record", search: { id: String(r.id) } })}
                  columns={[
                    { key: "title", header: "Title", cell: (r) => r.title },
                    { key: "value", header: "Value", cell: (r) => r.value ?? "—" },
                    {
                      key: "stage",
                      header: "Stage",
                      cell: (r) => <StatusBadge state={stageState(r.stage)}>{r.stage ?? "New"}</StatusBadge>,
                    },
                  ]}
                />
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
